/**
 * Unit tests for the in-flight SSE credential redactor.
 *
 * Focus areas:
 *   - Single-chunk and split-across-chunks redaction for the canonical
 *     anthropic `sk-ant-` pattern.
 *   - Flush-on-end behavior for credentials that only arrive in the
 *     final chunk.
 *   - No-credential passthrough is byte-identical (we must not mangle
 *     UTF-8 content in the happy path).
 *   - UTF-8 safety: a chunk boundary that bisects a multi-byte rune
 *     must not emit replacement characters.
 *   - Multiple independent credentials in one stream are each redacted.
 *   - Mixed credential patterns (bearer + github) are both redacted.
 */
import { describe, expect, it } from 'vitest';

import {
  createCredentialRedactingTransform,
  type StreamingCredentialRedactorOptions,
} from '../streaming-credential-redactor';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');

/**
 * Run a sequence of input chunks through the transformer and return
 * the concatenated output as a decoded string. Also returns the list
 * of redaction log invocations for assertion purposes.
 */
async function runThrough(
  chunks: (Uint8Array | string)[],
  opts: StreamingCredentialRedactorOptions = {},
): Promise<{ output: string; logs: string[][]; outputBytes: Uint8Array }> {
  const logs: string[][] = [];
  const transform = createCredentialRedactingTransform({
    ...opts,
    onRedactionLog: (patterns) => {
      logs.push([...patterns]);
    },
  });

  const input = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(typeof c === 'string' ? te.encode(c) : c);
      }
      controller.close();
    },
  });

  const piped = input.pipeThrough(transform);
  const reader = piped.getReader();
  const collected: Uint8Array[] = [];
  let totalLen = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      collected.push(value);
      totalLen += value.byteLength;
    }
  }

  const outputBytes = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of collected) {
    outputBytes.set(c, offset);
    offset += c.byteLength;
  }
  return { output: td.decode(outputBytes), logs, outputBytes };
}

describe('createCredentialRedactingTransform', () => {
  it('[1] single-chunk: redacts an anthropic sk-ant key in one chunk', async () => {
    // Pattern: \bsk-ant-[A-Za-z0-9_-]{40,}\b — needs ≥40 post-prefix chars.
    const key = 'sk-ant-api03-' + 'A'.repeat(45);
    const input = `leaked ${key}_key trailing`;
    const { output, logs } = await runThrough([input]);

    expect(output).toContain('[REDACTED:anthropic_api_key]');
    expect(output).not.toContain(key);
    // Telemetry fired once and mentions the pattern.
    expect(logs.length).toBeGreaterThan(0);
    const seen = new Set(logs.flat());
    expect(seen.has('anthropic_api_key')).toBe(true);
  });

  it('[2] split-across-chunks: a credential bisected at chunk boundary is still redacted', async () => {
    // Same key split between two chunks mid-body. Without the rolling
    // buffer this would escape detection because each chunk on its own
    // contains no match.
    const head = 'sk-ant-api03-ABC';
    const tail = 'DEFghijkl' + 'M'.repeat(40) + '_suffix';
    const fullKey = head + tail;
    const { output, logs } = await runThrough(['prefix ', head, tail, ' end']);

    expect(output).not.toContain(fullKey);
    expect(output).toContain('[REDACTED:anthropic_api_key]');
    expect(output.startsWith('prefix ')).toBe(true);
    expect(output.endsWith(' end')).toBe(true);
    expect(new Set(logs.flat()).has('anthropic_api_key')).toBe(true);
  });

  it('[3] flush-on-end: a credential only visible at stream end is redacted', async () => {
    // With safeTailBytes default=512 the whole payload stays buffered
    // until flush() — the test verifies flush actually scans + redacts.
    const key = 'ghp_' + 'X'.repeat(40);
    const { output, logs } = await runThrough([`final chunk ${key} done`]);

    expect(output).not.toContain(key);
    expect(output).toContain('[REDACTED:github_pat]');
    expect(new Set(logs.flat()).has('github_pat')).toBe(true);
  });

  it('[4] no-credential passthrough: benign text emerges byte-identical', async () => {
    const benign =
      'data: {"delta":"Hello, friend. This is a normal reply with no secrets."}\n\n' +
      'data: {"delta":"Another chunk, still no secrets."}\n\ndata: [DONE]\n\n';
    const { output, outputBytes, logs } = await runThrough([benign]);

    expect(output).toBe(benign);
    expect(logs.length).toBe(0);
    // Byte-identity check to guard against any silent re-encoding bugs.
    const expected = te.encode(benign);
    expect(outputBytes.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(outputBytes[i]).toBe(expected[i]);
    }
  });

  it('[5] UTF-8 safety: a multi-byte rune split across chunks does not garble output', async () => {
    // 𝄞 (U+1D11E, musical G clef) is 4 UTF-8 bytes: F0 9D 84 9E. We
    // feed 2 bytes in one chunk and 2 in the next. Without
    // `decoder.decode({stream:true})` sticky mode, the first half
    // would become a U+FFFD replacement and corrupt the output.
    const clef = '𝄞';
    const bytes = te.encode(clef);
    expect(bytes.length).toBe(4);
    const chunk1 = bytes.slice(0, 2);
    const chunk2 = bytes.slice(2, 4);

    const { output, logs } = await runThrough([
      te.encode('pre '),
      chunk1,
      chunk2,
      te.encode(' post'),
    ]);

    expect(output).toBe(`pre ${clef} post`);
    expect(output).not.toContain('\uFFFD');
    expect(logs.length).toBe(0);
  });

  it('[6] multiple credentials in one stream: each one redacted independently', async () => {
    const anthKey = 'sk-ant-api03-' + 'B'.repeat(45);
    const ghKey = 'ghp_' + 'C'.repeat(40);
    const input = `first ${anthKey} mid ${ghKey} last`;
    const { output, logs } = await runThrough([input]);

    expect(output).not.toContain(anthKey);
    expect(output).not.toContain(ghKey);
    expect(output).toContain('[REDACTED:anthropic_api_key]');
    expect(output).toContain('[REDACTED:github_pat]');
    // Both patterns show up in the telemetry set.
    const seen = new Set(logs.flat());
    expect(seen.has('anthropic_api_key')).toBe(true);
    expect(seen.has('github_pat')).toBe(true);
  });

  it('[7] bearer + github patterns mixed: both redacted in the same stream', async () => {
    const bearer = 'Bearer ' + 'Z'.repeat(40) + '_tok';
    const ghKey = 'ghp_' + 'D'.repeat(40);
    const { output, logs } = await runThrough([`auth=${bearer}\n`, `other=${ghKey}\n`]);

    expect(output).not.toContain(bearer);
    expect(output).not.toContain(ghKey);
    expect(output).toContain('[REDACTED:bearer_long]');
    expect(output).toContain('[REDACTED:github_pat]');
    const seen = new Set(logs.flat());
    expect(seen.has('bearer_long')).toBe(true);
    expect(seen.has('github_pat')).toBe(true);
  });

  it('[8] preserves SSE framing: newlines and `data:` prefixes pass through untouched', async () => {
    const key = 'sk-ant-api03-' + 'E'.repeat(45);
    const sse = `data: {"delta":"leaked ${key} oops"}\n\ndata: [DONE]\n\n`;
    const { output } = await runThrough([sse]);

    // Framing bytes survive.
    expect(output).toContain('data: {"delta":"');
    expect(output).toContain('\n\ndata: [DONE]\n\n');
    // Credential is gone; redaction marker is present.
    expect(output).not.toContain(key);
    expect(output).toContain('[REDACTED:anthropic_api_key]');
  });
});
