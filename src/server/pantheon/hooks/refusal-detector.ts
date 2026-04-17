/**
 * Refusal detector — post-LLM heuristic.
 *
 * Ported from hooks.py REFUSAL_PATTERNS / is_refusal (lines 298-308).
 *
 * ⚠️ Examines only the first 500 chars of `text.strip()`. This window is
 *    intentional: Python `text.strip()[:500]` — mid-response "I cannot"
 *    occurrences must NOT be flagged (fixture refusal-neg-04).
 */

export const REFUSAL_PATTERNS: readonly RegExp[] = [
  // Python anchors each with `^`; in JS without the `m` flag, `^` matches
  // only string start — same behavior.
  /^(I cannot|I'm unable|I can't|I'm sorry, but I can't)/i,
  /^(As an AI|I'm an AI)/i,
  /I don't feel comfortable (discussing|providing|answering)/i,
  /Unfortunately, I (can't|cannot|am unable)/i,
];

export function isRefusal(text: string): boolean {
  const head = text.trim().slice(0, 500);
  return REFUSAL_PATTERNS.some((p) => p.test(head));
}
