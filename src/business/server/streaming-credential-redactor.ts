/**
 * streaming-credential-redactor — in-flight credential scrubber for SSE
 * response bodies. Resolves the Phase 3.3 tradeoff: LobeHub v2's
 * `onChatFinal` fires AFTER the stream has already been consumed by the
 * HTTP client, so the post-hook can only log leaks — it cannot remove
 * them from the bytes the user already saw. This transformer sits on the
 * outgoing Response body pipeline so credentials are stripped before the
 * client observes them.
 *
 * Design (verdict from Phase 3.3 research):
 *   - Wrap the outbound ReadableStream with `pipeThrough(transform)` at
 *     the single HTTP choke point (route handler). No invasive patches
 *     to any provider's stream internals.
 *   - Rolling buffer keeps at least `MAX_CREDENTIAL_LEN` bytes unemitted
 *     so a credential split across two TCP chunks is still caught on the
 *     join.
 *   - Text (UTF-8) decoding uses `TextDecoder({ fatal: false }).decode(…,
 *     { stream: true })` sticky mode, which defers any trailing
 *     incomplete multi-byte sequence to the next decode() call. This
 *     prevents mid-rune garble when a chunk ends partway through a
 *     multi-byte character.
 *   - SSE framing (`data: <payload>\n\n`) is PRESERVED verbatim. We do
 *     not parse the JSON payload — we scan the entire decoded text for
 *     credential matches and replace them with `[REDACTED:<pattern>]`.
 *     Since the pattern classes (sk-ant-…, ghp_…, Bearer …, etc.) are
 *     narrow enough that they can't collide with SSE syntax characters
 *     (`data:`, `\n`, `:`), this is safe. Structural bytes like newlines
 *     and `data:` framing pass through untouched.
 *   - Redaction log format matches the post-hook for telemetry parity:
 *       `[pantheon-pipeline] stream-redact leaked=[…]`
 *
 * LIMITATIONS (explicit, documented):
 *   - Binary (non-UTF-8) response bodies would be decoded as replacement
 *     characters and re-encoded; we only wrap when the route actually
 *     serves a text stream (the integration point gates on that).
 *   - A credential longer than the rolling buffer window (512 B) CAN be
 *     bisected at a window boundary and escape detection. The longest
 *     pattern in CRED_PATTERNS caps at ~60-80 printable chars; 512 is a
 *     comfortable margin.
 *   - Non-streaming responses (JSON completions) do NOT flow through
 *     this transform. The existing `onChatFinal` log-only alert remains
 *     in place as the secondary safety net for that path.
 */
import { CRED_PATTERNS } from '@/server/pantheon/hooks/credential-redactor';

/**
 * Rolling-buffer window. Must be strictly larger than the longest
 * credential pattern. Research note: the longest legitimate match is the
 * anthropic key family (`sk-ant-api03-[A-Za-z0-9_-]{40,}`) which can
 * run to ~60-80 chars in practice — the floor is 47, the observed
 * ceiling around 108. 512 bytes leaves ample overlap margin and keeps
 * the per-chunk scan cost trivial.
 */
export const DEFAULT_SAFE_TAIL_BYTES = 512;

export interface StreamingCredentialRedactorOptions {
  /**
   * Injectable logger for test assertions. Default `console.error`,
   * matching the post-hook's leak-alert severity.
   */
  onRedactionLog?: (patterns: readonly string[]) => void;
  /**
   * Bytes to retain at the tail of the rolling buffer between scans.
   * Must be larger than the longest credential pattern. Default 512.
   */
  safeTailBytes?: number;
}

/**
 * Scan `text` for every credential pattern, replace each match with
 * `[REDACTED:<pattern-name>]`, and return both the sanitized text and
 * the list of pattern names that fired. Mirrors
 * `redactCredentials` from credential-redactor.ts but kept local so the
 * streaming path doesn't depend on the TurnEnvelope type.
 */
function redactOnce(text: string): { text: string; redacted: string[] } {
  const redacted: string[] = [];
  let out = text;
  for (const [name, pat] of CRED_PATTERNS) {
    const globalPat = pat.flags.includes('g') ? pat : new RegExp(pat.source, pat.flags + 'g');
    out = out.replace(globalPat, () => {
      redacted.push(name);
      return `[REDACTED:${name}]`;
    });
  }
  return { text: out, redacted };
}

/**
 * Build a TransformStream<Uint8Array, Uint8Array> that redacts leaked
 * credentials from an SSE-style response body as it flows to the
 * client. Uses a rolling UTF-8-safe buffer so credentials that straddle
 * chunk boundaries are still caught.
 *
 * Use like:
 *   response.body.pipeThrough(createCredentialRedactingTransform())
 */
export function createCredentialRedactingTransform(
  opts: StreamingCredentialRedactorOptions = {},
): TransformStream<Uint8Array, Uint8Array> {
  const safeTailBytes = opts.safeTailBytes ?? DEFAULT_SAFE_TAIL_BYTES;
  const logRedaction =
    opts.onRedactionLog ??
    ((patterns) => {
      // Mirrors pantheon-pipeline post-hook log shape so telemetry can
      // dedupe / join on the same key.

      console.error(
        `[pantheon-pipeline] stream-redact leaked=[${[...new Set(patterns)].join(',')}]`,
      );
    });

  // `stream: true` defers any incomplete trailing UTF-8 sequence to the
  // next decode() call — our UTF-8 safety mechanism.
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const encoder = new TextEncoder();

  // Pending decoded-but-not-yet-emitted text. We hold at least
  // `safeTailBytes` chars in the tail before emitting so a split
  // credential reassembles.
  let pending = '';

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      // Decode in streaming mode so we never split a multi-byte char.
      const decoded = decoder.decode(chunk, { stream: true });
      if (decoded.length === 0) return;

      pending += decoded;

      // Emit only while the pending buffer is long enough that the tail
      // overlap is preserved. Below threshold we just accumulate.
      if (pending.length <= safeTailBytes) return;

      // Split pending into [emittable | tail]. Scan the emittable prefix
      // for credentials, redact, emit. Retain the tail verbatim for the
      // next transform() call — it may yet form the prefix of a cred.
      const emittable = pending.slice(0, pending.length - safeTailBytes);
      const tail = pending.slice(pending.length - safeTailBytes);

      const { text: safe, redacted } = redactOnce(emittable);
      if (redacted.length > 0) logRedaction(redacted);
      controller.enqueue(encoder.encode(safe));
      pending = tail;
    },

    flush(controller) {
      // Drain any decoder state (trailing replacement char if the stream
      // truly ended mid-rune; this is not a broken mid-chunk split).
      const trailing = decoder.decode();
      if (trailing.length > 0) pending += trailing;

      if (pending.length === 0) return;
      const { text: safe, redacted } = redactOnce(pending);
      if (redacted.length > 0) logRedaction(redacted);
      controller.enqueue(encoder.encode(safe));
      pending = '';
    },
  });
}

/**
 * Convenience helper: wrap a `Response` so its body is passed through
 * the credential-redacting transform. Copies headers + status. If the
 * incoming response has no body (or is not a ReadableStream), returns
 * the original response unchanged.
 *
 * Gated at the call site by `PANTHEON_PIPELINE_ENABLED === '1'`.
 */
export function wrapResponseWithCredentialRedactor(
  response: Response,
  opts?: StreamingCredentialRedactorOptions,
): Response {
  if (!response.body) return response;
  const transformed = response.body.pipeThrough(createCredentialRedactingTransform(opts));
  return new Response(transformed, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}
