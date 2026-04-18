/**
 * Integration tests for the PantheonChatPipeline adapter (Phase 3.3).
 *
 * Exercises the real hook modules from src/server/pantheon/hooks — no
 * mocks of the pipeline stages themselves. Uses vitest's spyOn for the
 * console logger so we can assert telemetry without capturing real stderr.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatStreamPayload, OpenAIChatMessage } from '@lobechat/model-runtime';

import {
  PantheonChatPipeline,
  PantheonReviewGateError,
} from '../pantheon-pipeline';

function makePayload(
  messages: OpenAIChatMessage[],
  overrides: Partial<ChatStreamPayload> = {},
): ChatStreamPayload {
  return {
    messages,
    model: 'claude-opus-4-7',
    provider: 'anthropic',
    ...overrides,
  } as ChatStreamPayload;
}

describe('PantheonChatPipeline.buildPreHook', () => {
  let logInfo: ReturnType<typeof vi.spyOn>;
  let logWarn: ReturnType<typeof vi.spyOn>;
  let logErr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    logWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logInfo.mockRestore();
    logWarn.mockRestore();
    logErr.mockRestore();
  });

  it('redacts an anthropic sk-ant credential from the last user message', async () => {
    const pipeline = new PantheonChatPipeline('user-1', 'anthropic');
    const pre = pipeline.buildPreHook();

    const credential =
      'sk-ant-' + 'A'.repeat(45); // passes \bsk-ant-[A-Za-z0-9_-]{40,}\b
    const payload = makePayload([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: `please use this key: ${credential} thanks` },
    ]);

    await pre(payload);

    const last = payload.messages[payload.messages.length - 1]!;
    expect(typeof last.content).toBe('string');
    expect(last.content as string).not.toContain(credential);
    expect(last.content as string).toContain('[REDACTED:anthropic_api_key]');
    // Telemetry must surface the credential count (names are deliberately
    // omitted from stdout — see pantheon-pipeline.ts PHI-log redaction fix).
    const infoCall = logInfo.mock.calls.find((c) =>
      String(c[0]).startsWith('[pantheon-pipeline] pre'),
    );
    expect(infoCall).toBeDefined();
    expect(String(infoCall![0])).toContain('creds_count=1');
  });

  it('throws PantheonReviewGateError on strict-mode PHI', async () => {
    // Strict PHI triggered via default_mode=strict; review_required fires
    // because the pre-hook adds it whenever phi_guard_mode === 'strict'.
    const pipeline = new PantheonChatPipeline('clinician-42', 'anthropic', {
      phiGuard: { default_mode: 'strict' },
      reviewGate: {
        registry: { 'clinician-42': { role: 'clinical' } },
      },
    });
    const pre = pipeline.buildPreHook();

    const payload = makePayload([
      {
        role: 'user',
        content:
          'Patient MRN: 123456 needs follow-up on their dose of Lisinopril 20 mg',
      },
    ]);

    await expect(pre(payload)).rejects.toBeInstanceOf(PantheonReviewGateError);
    // Logger must emit the BLOCKED telemetry line before the throw.
    const warnCall = logWarn.mock.calls.find((c) =>
      String(c[0]).startsWith('[pantheon-pipeline] pre BLOCKED'),
    );
    expect(warnCall).toBeDefined();
  });

  it('passes through clean text unchanged', async () => {
    const pipeline = new PantheonChatPipeline('user-2', 'anthropic');
    const pre = pipeline.buildPreHook();

    const original = 'Hi! What is the capital of France?';
    const payload = makePayload([{ role: 'user', content: original }]);

    await pre(payload);

    expect(payload.messages[0]!.content).toBe(original);
    const infoCall = logInfo.mock.calls.find((c) =>
      String(c[0]).startsWith('[pantheon-pipeline] pre'),
    );
    expect(infoCall).toBeDefined();
    // Clean text → both counts are zero.
    expect(String(infoCall![0])).toContain('phi_count=0');
    expect(String(infoCall![0])).toContain('creds_count=0');
  });
});

describe('PantheonChatPipeline.buildPostHook', () => {
  let logInfo: ReturnType<typeof vi.spyOn>;
  let logErr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    logErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logInfo.mockRestore();
    logErr.mockRestore();
  });

  it('logs a leak alert when the response contains a detectable credential', async () => {
    const pipeline = new PantheonChatPipeline('user-3', 'anthropic');
    const post = pipeline.buildPostHook();

    // openai_api_key pattern: \bsk-[A-Za-z0-9]{32,}\b — hyphens break it,
    // so build a hyphen-free key body (see credential-redactor.ts quirk note).
    const leaked = 'sk-' + 'A'.repeat(40);
    const text = `here you go: ${leaked} — good luck`;

    const payload = makePayload([{ role: 'user', content: 'give me a key' }]);
    await post({ text } as never, { payload });

    const errCall = logErr.mock.calls.find((c) =>
      String(c[0]).startsWith('[pantheon-pipeline] post-redact leaked'),
    );
    expect(errCall).toBeDefined();
    expect(String(errCall![0])).toContain('openai_api_key');
  });

  it('identifies refusal text', async () => {
    const pipeline = new PantheonChatPipeline('user-4', 'anthropic');
    const post = pipeline.buildPostHook();

    const text = "I cannot help with that request.";
    const payload = makePayload([{ role: 'user', content: 'do something bad' }]);
    await post({ text } as never, { payload });

    const infoCall = logInfo.mock.calls.find((c) =>
      String(c[0]).startsWith('[pantheon-pipeline] post'),
    );
    expect(infoCall).toBeDefined();
    expect(String(infoCall![0])).toContain('refusal=true');
  });
});
