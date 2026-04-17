/**
 * PHI guard — detects HIPAA-style indirect + direct identifiers.
 *
 * Ported from hooks.py PHI_PATTERNS / detect_phi / select_phi_guard_mode /
 * apply_phi_guard (lines 138-215). Pattern order is preserved — callers that
 * iterate rely on the name order for deterministic output.
 *
 * ⚠️ REGEX QUIRKS PRESERVED BY DESIGN (clinical fixture ground truth requires
 *    bit-for-bit match with Python; see /opt/obsidian-pantheon/tests/phi-fixtures.json):
 *
 *   - patient_name: case-SENSITIVE — "Patient: John Smith" does NOT match
 *     because the Python regex lacks re.I. Fixture patient-name-03 codifies
 *     this behavior. Do not add an `i` flag.
 *   - insurance_id: case-INSENSITIVE `[A-Z0-9]{6,}` matches common lowercase
 *     English words >= 6 chars (fixture insurance-fp-01 for "policy change
 *     next month").
 *   - address: "version 1.0 Beta Ave" matches (fixture address-neg-02).
 */
import type {
  PhiGuardConfig,
  PhiGuardMode,
  TurnEnvelope,
} from './types';

export const PHI_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  // --- Direct identifiers ---------------------------------------------------
  ['mrn', /\bMRN[:\s#]*\d{4,}\b/i],
  ['ssn', /\b\d{3}-\d{2}-\d{4}\b/],
  [
    'dob',
    /\b(DOB|date of birth|born|D\.O\.B)[:\s.]+\d{1,2}[/-]\d{1,2}[/-](?:19|20)\d{2}\b/i,
  ],
  ['phone', /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/],
  // Email allowlist mirrors Python's negative lookahead exactly.
  [
    'email',
    /\b[A-Za-z0-9._%+-]+@(?!example\.com|test\.com|pantheon)[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  ],
  ['npi', /\bNPI[:\s#]*\d{10}\b/i],

  // --- Names ----------------------------------------------------------------
  // INTENTIONALLY case-sensitive. See module docstring.
  ['patient_name', /\b(patient|pt)[:\s]+[A-Z][a-z]+\s+[A-Z][a-z]+\b/],
  [
    'full_name_with_title',
    /\b(Mr|Mrs|Ms|Miss|Dr|Prof)\.\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/,
  ],

  // --- Address --------------------------------------------------------------
  [
    'address',
    /\d{1,5}\s+[A-Z][a-z]+\s+(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place)\b/i,
  ],

  // --- Insurance / records --------------------------------------------------
  // Known FP on phrases like "policy change"; see module docstring.
  [
    'insurance_id',
    /\b(policy|member|subscriber|group|plan)\s*#?\s*:?\s*[A-Z0-9]{6,}\b/i,
  ],
  [
    'med_record_alt',
    /\b(MR#|Med\s*Rec|Chart\s*#|Acct\s*#)\s*:?\s*\d{4,}\b/i,
  ],

  // --- Clinical -------------------------------------------------------------
  ['diagnosis_explicit', /\b(diagnos(?:is|ed with)|dx[:\s])/i],
  [
    'med_dose',
    /\b[A-Z][a-z]+(?:ine|olol|pine|pril|statin|azole|illin)\s+\d+\s*mg\b/i,
  ],
  ['age_gender', /\b\d{1,3}\s*y\/?o\s*[MmFf]\b/],
];

/** Returns list of matched pattern names, in declaration order (like Python). */
export function detectPhi(text: string): string[] {
  const found: string[] = [];
  for (const [name, pat] of PHI_PATTERNS) {
    if (pat.test(text)) found.push(name);
  }
  return found;
}

/**
 * Resolve strict vs informational mode from pantheon.toml [phi_guard].
 * Supported trigger shapes (see hooks.py:176-193):
 *   - "skill:<name>"
 *   - "envelope:force_strict_phi=true"
 *   - "agent:<id> AND room:<room>" (AND-joined agent:/room:/skill: clauses)
 */
export function selectPhiGuardMode(
  env: TurnEnvelope,
  cfg: PhiGuardConfig = {},
): PhiGuardMode {
  const triggers = cfg.strict_triggers ?? [];
  const defaultMode: PhiGuardMode = cfg.default_mode ?? 'informational';

  for (const t of triggers) {
    if (t.startsWith('skill:') && env.active_skill === t.slice('skill:'.length)) {
      return 'strict';
    }
    if (
      t.startsWith('envelope:force_strict_phi=true') &&
      env.acl.force_strict_phi === true
    ) {
      return 'strict';
    }
    if (t.includes(' AND ')) {
      const parts = t.split(' AND ').map((p) => p.trim());
      let ok = true;
      for (const p of parts) {
        if (p.startsWith('agent:') && env.agent_id !== p.slice('agent:'.length)) ok = false;
        else if (
          p.startsWith('room:') &&
          env.primary_room !== p.slice('room:'.length)
        )
          ok = false;
        else if (
          p.startsWith('skill:') &&
          env.active_skill !== p.slice('skill:'.length)
        )
          ok = false;
      }
      if (ok) return 'strict';
    }
  }

  return defaultMode;
}

/**
 * Pre-LLM PHI guard. Mutates + returns `env` (mirrors Python for API parity).
 * Appends a PHI advisory to `system_prompt` when findings are non-empty.
 */
export function applyPhiGuard(
  env: TurnEnvelope,
  cfg: PhiGuardConfig = {},
): TurnEnvelope {
  const findings = detectPhi(env.user_text);
  env.phi_detected = findings.length > 0;
  env.phi_types = findings;
  env.phi_guard_mode = selectPhiGuardMode(env, cfg);
  env.acl.phi = env.phi_detected && env.phi_guard_mode === 'strict';

  if (env.phi_detected) {
    const label = env.phi_guard_mode === 'strict' ? 'Alert' : 'Advisory';
    let advisoryText =
      `[PANTHEON PHI ${label}: inbound looks like it may contain PHI (${findings.join(', ')}). `;
    if (env.phi_guard_mode === 'strict') {
      advisoryText +=
        'Clinical workflow — strict handling active. Shard-L-only storage. Do not echo PHI in response.]';
    } else {
      advisoryText +=
        'If this is clinical, invoke `chart-review` or move to #clinical-chamber for strict handling.]';
    }
    env.system_prompt = (env.system_prompt + '\n\n' + advisoryText).trim();
  }
  return env;
}
