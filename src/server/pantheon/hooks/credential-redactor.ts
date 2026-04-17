/**
 * Credential redactor — pattern-based scan + replacement (both directions).
 *
 * Ported from hooks.py CRED_PATTERNS / scan_credentials / redact_credentials
 * (lines 264-291).
 *
 * ⚠️ REGEX QUIRK PRESERVED (fixture openai-quirk-01): the OpenAI pattern is
 *    `\bsk-[A-Za-z0-9]{32,}\b`, which does NOT accept hyphens in the key
 *    body. Modern `sk-proj-...` keys therefore fail to match. Python behavior;
 *    TS port must replicate. Do not widen the character class.
 */
import type { TurnEnvelope } from './types';

export const CRED_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ['anthropic_api_key', /\bsk-ant-[A-Za-z0-9_-]{40,}\b/],
  ['openai_api_key', /\bsk-[A-Za-z0-9]{32,}\b/],
  ['github_pat', /\bghp_[A-Za-z0-9]{36,}\b/],
  ['cloudflare_token', /\bcf[a-z]{2,3}_[A-Za-z0-9_-]{40,}\b/],
  ['bearer_long', /\bBearer\s+[A-Za-z0-9._-]{32,}\b/],
  ['ssh_private_key', /-----BEGIN (?:RSA |OPENSSH |DSA |EC )?PRIVATE KEY-----/],
  ['matrix_access_token', /\bsyt_[A-Za-z0-9_-]{40,}\b/],
  ['postgres_uri', /postgres(?:ql)?:\/\/[^/\s:]+:[^@\s]+@/],
];

/** Returns list of matched credential pattern names. */
export function scanCredentials(text: string): string[] {
  const found: string[] = [];
  for (const [name, pat] of CRED_PATTERNS) {
    if (pat.test(text)) found.push(name);
  }
  return found;
}

/**
 * Strips all credentials from `text` and returns (redacted_text, pattern_names).
 * Each replaced match appends its pattern name to `redacted_tokens` (so the
 * same pattern can appear multiple times if it matched multiple spans — mirrors
 * the Python closure-based behavior).
 */
export function redactCredentials(text: string): {
  text: string;
  redacted: string[];
} {
  const redacted: string[] = [];
  let out = text;
  for (const [name, pat] of CRED_PATTERNS) {
    // Each pattern may match multiple times; replaceAll needs a global variant.
    // The Python version uses re.sub which replaces all occurrences by default.
    const globalPat = pat.flags.includes('g')
      ? pat
      : new RegExp(pat.source, pat.flags + 'g');
    out = out.replace(globalPat, () => {
      redacted.push(name);
      return `[REDACTED:${name}]`;
    });
  }
  return { text: out, redacted };
}

/**
 * Apply credential redaction to the appropriate side of the envelope.
 *
 * @param env       envelope (mutated)
 * @param outbound  false = inbound (user_text), true = outbound (caller
 *                  handles response text separately and passes it to
 *                  `redactCredentials` directly). Kept for symmetry with
 *                  the Python pipeline where inbound scan + redact happen
 *                  inside preprocess_turn (hooks.py:376-379).
 *
 * On inbound, populates `env.credential_patterns_found` and rewrites
 * `env.user_text` in place.
 */
export function applyCredentialRedactor(
  env: TurnEnvelope,
  outbound = false,
): TurnEnvelope {
  if (outbound) return env; // outbound is handled by caller on response_text
  const found = scanCredentials(env.user_text);
  env.credential_patterns_found = found;
  if (found.length > 0) {
    const { text } = redactCredentials(env.user_text);
    env.user_text = text;
  }
  return env;
}
