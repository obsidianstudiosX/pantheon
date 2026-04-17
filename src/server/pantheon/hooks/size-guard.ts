/**
 * Size guard — token-budget clamp on (system_prompt + user_text).
 *
 * Ported from hooks.py approx_tokens / apply_size_guard (lines 222-238).
 *
 * Approximation: ~3.5 chars per token for mixed content. Conservative, not
 * a substitute for a real tokenizer. Matches Python's `int(len(text)/3.5)`.
 */
import type { TurnEnvelope } from './types';

const TRUNCATION_MARKER =
  '\n\n[... TRUNCATED BY pantheon-size-guard ...]\n\n';

const DEFAULT_MAX_INPUT_TOKENS = 32_000;
const BUFFER_TOKENS = 500;
const CHARS_PER_TOKEN = 3.5;

export function approxTokens(text: string): number {
  // Math.trunc matches Python `int()` for non-negative values.
  return Math.trunc(text.length / CHARS_PER_TOKEN);
}

/**
 * Clamp envelope input to `maxInputTokens` by middle-truncating user_text.
 * Leaves system_prompt intact; if system_prompt alone exceeds budget, the
 * allowed-user budget becomes negative and truncation is skipped (matches
 * Python behavior — an overlarge system prompt is the caller's problem).
 */
export function applySizeGuard(
  env: TurnEnvelope,
  maxInputTokens: number = DEFAULT_MAX_INPUT_TOKENS,
): TurnEnvelope {
  const total = approxTokens(env.system_prompt) + approxTokens(env.user_text);
  env.input_tokens_approx = total;
  if (total > maxInputTokens) {
    const allowedUser =
      maxInputTokens - approxTokens(env.system_prompt) - BUFFER_TOKENS;
    const userBudgetChars = Math.trunc(allowedUser * CHARS_PER_TOKEN);
    if (env.user_text.length > userBudgetChars) {
      // Python: `half = user_budget_chars // 2` (floor division)
      const half = Math.trunc(userBudgetChars / 2);
      env.user_text =
        env.user_text.slice(0, half) +
        TRUNCATION_MARKER +
        env.user_text.slice(env.user_text.length - half);
      env.truncated = true;
    }
  }
  return env;
}
