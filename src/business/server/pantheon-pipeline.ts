/**
 * PantheonChatPipeline — glue between the LobeHub v2 ModelRuntime hook
 * contract (`ModelRuntimeHooks`) and the clinical-grade Pantheon hook
 * pipeline ported in Phase 3.2 (`@/server/pantheon/hooks`).
 *
 * Pipeline (HANDOFF §8, see src/server/pantheon/hooks/types.ts):
 *   REQUEST  → router → phi-guard → credential-redactor → size-guard → review-gate → LLM
 *   RESPONSE ← credential-redactor (egress-scan) ← refusal-detector ← LLM
 *
 * Activation is gated by `PANTHEON_PIPELINE_ENABLED=1` in the environment;
 * default off. Clinical operator sign-off is required before enabling in
 * any environment touching real users. See model-runtime.ts for the gate.
 *
 * Response mutation limitation (streaming): the ModelRuntime calls
 * `onChatFinal` after the stream has already been consumed by the caller,
 * so we cannot mutate the already-delivered bytes. The post-hook therefore
 * runs scan-only redaction against the finalized text and emits a
 * structured `post-redact leaked=[...]` log line when new credentials
 * appear in the response — this is a leak alert, important telemetry for
 * the security team. A follow-up phase can route this through a proper
 * audit sink.
 */
import type {
  ChatMethodOptions,
  ChatStreamPayload,
  OnFinishData,
  OpenAIChatMessage,
} from '@lobechat/model-runtime';

import {
  applyCredentialRedactor,
  applyPhiGuard,
  applyReviewGatePre,
  applyRouter,
  applySizeGuard,
  createTurnEnvelope,
  isRefusal,
  redactCredentials,
  type PhiGuardConfig,
  type ReviewGateConfig,
  type TurnEnvelope,
} from '@/server/pantheon/hooks';

export interface PantheonPipelineConfig {
  /** PHI guard trigger config — defaults to informational mode. */
  phiGuard?: PhiGuardConfig;
  /** Review gate registry + roles — defaults to the Python constant set. */
  reviewGate?: ReviewGateConfig;
  /** Max input token budget for size-guard. */
  maxInputTokens?: number;
}

/**
 * Error thrown by `beforeChat` when strict-mode PHI is detected. Callers
 * (LobeHub chat route) re-raise this as a 4xx to the client.
 */
export class PantheonReviewGateError extends Error {
  public readonly code = 'PANTHEON_REVIEW_REQUIRED';
  constructor(message: string) {
    super(message);
    this.name = 'PantheonReviewGateError';
  }
}

/** Pull the final user-authored message content as a string. */
function extractLastUserText(messages: OpenAIChatMessage[]): {
  text: string;
  index: number;
} {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    const c = m.content;
    if (typeof c === 'string') return { text: c, index: i };
    if (Array.isArray(c)) {
      // Multimodal: concatenate text parts only, leave non-text parts in place.
      const text = c
        .filter((p) => p?.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text ?? '')
        .join('\n');
      return { text, index: i };
    }
  }
  return { text: '', index: -1 };
}

/**
 * Write `newText` back into the last user message while preserving any
 * non-text multimodal parts. If the original content was a string we keep
 * it as a string; if it was an array we swap only the text parts.
 */
function replaceLastUserText(
  messages: OpenAIChatMessage[],
  index: number,
  newText: string,
): void {
  if (index < 0) return;
  const m = messages[index];
  const c = m.content;
  if (typeof c === 'string') {
    m.content = newText;
    return;
  }
  if (Array.isArray(c)) {
    // Replace the first text part with the full redacted text and drop
    // any other text parts so we don't duplicate content.
    let placed = false;
    const next = c
      .map((p) => {
        if (p?.type !== 'text') return p;
        if (!placed) {
          placed = true;
          return { ...p, text: newText };
        }
        return null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
    if (!placed) next.unshift({ type: 'text', text: newText });
    m.content = next;
  }
}

export class PantheonChatPipeline {
  private readonly userId: string;
  private readonly provider: string | undefined;
  private readonly config: PantheonPipelineConfig;

  constructor(
    userId: string,
    provider: string | undefined,
    config: PantheonPipelineConfig = {},
  ) {
    this.userId = userId;
    this.provider = provider;
    this.config = config;
  }

  /** Build a TurnEnvelope from a ChatStreamPayload and run the pre-hook chain. */
  private buildEnvelope(payload: ChatStreamPayload): {
    env: TurnEnvelope;
    userIndex: number;
    originalText: string;
  } {
    const { text, index } = extractLastUserText(payload.messages ?? []);
    const systemMsg = (payload.messages ?? []).find((m) => m.role === 'system');
    const systemText =
      systemMsg && typeof systemMsg.content === 'string' ? systemMsg.content : '';

    const env = createTurnEnvelope({
      agent_id: this.userId,
      user_text: text,
      system_prompt: systemText,
      model: payload.model ?? null,
      provider: this.provider ?? payload.provider ?? null,
    });
    return { env, userIndex: index, originalText: text };
  }

  /**
   * Pre-LLM hook. Runs router → phi-guard → credential-redactor (inbound)
   * → size-guard → review-gate in order. Mutates `payload.messages` when
   * redaction/truncation changed the user text.
   */
  buildPreHook(): NonNullable<
    import('@lobechat/model-runtime').ModelRuntimeHooks['beforeChat']
  > {
    return async (payload: ChatStreamPayload, _options?: ChatMethodOptions) => {
      const { env, userIndex, originalText } = this.buildEnvelope(payload);

      applyRouter(env);
      applyPhiGuard(env, this.config.phiGuard);
      applyCredentialRedactor(env, false);
      applySizeGuard(env, this.config.maxInputTokens);
      applyReviewGatePre(env, this.config.reviewGate);

      // Enforcement point: strict PHI + review_required => abort before LLM call.
      if (env.review_required && env.phi_guard_mode === 'strict') {
        // Log BEFORE throwing so operators see the block in telemetry.
        // eslint-disable-next-line no-console
        console.warn(
          `[pantheon-pipeline] pre BLOCKED turn_type=${env.turn_type} stakes=${env.stakes} phi_types=[${env.phi_types.join(',')}] creds_found=[${env.credential_patterns_found.join(',')}] review_required=${env.review_required} reason=${env.review_reason ?? ''}`,
        );
        throw new PantheonReviewGateError(
          'Pantheon review gate: PHI detected in strict mode — operator sign-off required before this turn can execute',
        );
      }

      // If inbound mutated the text (credential redaction or size-guard
      // truncation), write it back into the payload so the LLM sees the
      // sanitized version.
      if (env.user_text !== originalText) {
        replaceLastUserText(payload.messages ?? [], userIndex, env.user_text);
      }

      // eslint-disable-next-line no-console
      console.info(
        `[pantheon-pipeline] pre turn_type=${env.turn_type} stakes=${env.stakes} phi_types=[${env.phi_types.join(',')}] creds_found=[${env.credential_patterns_found.join(',')}] review_required=${env.review_required}`,
      );
    };
  }

  /**
   * Post-LLM hook. Scans the finalized response for leaked credentials and
   * flags refusals. Log-only: we cannot mutate already-streamed bytes.
   */
  buildPostHook(): NonNullable<
    import('@lobechat/model-runtime').ModelRuntimeHooks['onChatFinal']
  > {
    return async (data: OnFinishData, context) => {
      const text = data?.text ?? '';
      if (!text) return;

      const { redacted } = redactCredentials(text);
      const refused = isRefusal(text);

      if (redacted.length > 0) {
        // LEAK ALERT — response already streamed to the user, we can only
        // log. A future phase should route this to the clinical audit sink.
        // eslint-disable-next-line no-console
        console.error(
          `[pantheon-pipeline] post-redact leaked=[${[...new Set(redacted)].join(',')}] userId=${this.userId} provider=${this.provider ?? ''} model=${context?.payload?.model ?? ''}`,
        );
      }

      // Best-effort turn_type — we rebuild the envelope from the payload
      // rather than threading state through closures, so post-hook reasoning
      // matches the pre-hook classification deterministically.
      const { env } = this.buildEnvelope(context.payload);
      applyRouter(env);

      // eslint-disable-next-line no-console
      console.info(
        `[pantheon-pipeline] post turn_type=${env.turn_type} refusal=${refused}`,
      );
    };
  }

  /** Error hook — log-only, does not suppress the error. */
  buildErrorHook(): NonNullable<
    import('@lobechat/model-runtime').ModelRuntimeHooks['onChatError']
  > {
    return (error, context) => {
      const msg = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[pantheon-pipeline] chat-error userId=${this.userId} provider=${this.provider ?? ''} model=${context?.payload?.model ?? ''} error=${msg}`,
      );
    };
  }
}
