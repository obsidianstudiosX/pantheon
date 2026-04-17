/**
 * Types for the Pantheon hook pipeline.
 *
 * Ported from /opt/obsidian-pantheon/runtime/openclaw/lib/pantheon/hooks.py
 * (Phase 3.2 — PHI + credential + refusal port, clinical-grade parity).
 *
 * Pipeline (HANDOFF §8):
 *   REQUEST  → router → preprocessor → size-guard → review-gate → LLM
 *   RESPONSE ← crystallizer ← credential-redactor ← phi-guard ← refusal-detector ← LLM
 *
 * The crystallizer + cost-logging stages are explicitly out of scope for
 * Phase 3.2 and will land in a later phase.
 */

/** ACL carried on the envelope; gates memory shard routing and redaction. */
export interface TurnEnvelopeAcl {
  /** Whether this turn is treated as containing PHI (strict mode only). */
  phi: boolean;
  /** Pattern names whose matches must be redacted on egress. */
  redact: string[];
  /** Operator-forced strict PHI handling (e.g., set on #clinical-chamber). */
  force_strict_phi?: boolean;
  /** Arbitrary additional keys (matches Python's open dict shape). */
  [key: string]: unknown;
}

/**
 * Metadata carried through the entire hook pipeline.
 *
 * Fields populated by `applyRouter` / `applyPhiGuard` / `applySizeGuard`
 * / `applyReviewGatePre` / `applyCredentialRedactor` in order.
 *
 * Mirrors hooks.py `TurnEnvelope` dataclass (lines 38-79). Defaults match
 * the Python `field` defaults.
 */
export interface TurnEnvelope {
  // Who / where
  agent_id: string;
  matrix_identity?: string | null;
  room_id?: string | null;
  primary_room?: string | null;
  event_id?: string | null;

  // What
  user_text: string;
  system_prompt: string;

  // Classification (router)
  turn_type: TurnType;
  stakes: Stakes;
  active_skill?: string | null;

  // PHI guard
  phi_detected: boolean;
  phi_types: string[];
  phi_guard_mode: PhiGuardMode;
  acl: TurnEnvelopeAcl;

  // Size / context
  input_tokens_approx: number;
  truncated: boolean;

  // Credentials
  credential_patterns_found: string[];

  // Review gate
  review_required: boolean;
  review_reason?: string | null;

  // Model / provider (set by chat-service before postprocess)
  model?: string | null;
  provider?: string | null;

  // For crystallizer (carried, not yet consumed in 3.2)
  trace_id?: string | null;
  ts_start: string;
}

export type TurnType =
  | 'clinical-guide'
  | 'clinical-review'
  | 'research'
  | 'code'
  | 'config'
  | 'creative'
  | 'ops'
  | 'personal'
  | 'general';

export type Stakes = 'trivial' | 'low' | 'medium' | 'high' | 'critical';

export type PhiGuardMode = 'strict' | 'informational';

/** Config surface consumed by `applyPhiGuard` (mirrors pantheon.toml [phi_guard]). */
export interface PhiGuardConfig {
  default_mode?: PhiGuardMode;
  /**
   * Trigger expressions per hooks.py:176-193. Supported forms:
   *   - "skill:<active_skill>"
   *   - "envelope:force_strict_phi=true"
   *   - "agent:<id> AND room:<room>" (AND-joined clauses of
   *     agent:/room:/skill:)
   */
  strict_triggers?: string[];
}

/** Config surface consumed by `applyReviewGatePre`. */
export interface ReviewGateConfig {
  /** Map of agent_id -> role (mirrors Python `config.registry()`). */
  registry?: Record<string, { role?: string } | undefined>;
  /** Roles that require Eclipse sign-off (defaults to the Python constant). */
  rolesRequiringEclipse?: Set<string> | string[];
}

/** Factory: returns a TurnEnvelope with Python-default-equivalent fields. */
export function createTurnEnvelope(
  init: Partial<TurnEnvelope> & Pick<TurnEnvelope, 'agent_id'>,
): TurnEnvelope {
  return {
    matrix_identity: null,
    room_id: null,
    primary_room: null,
    event_id: null,
    user_text: '',
    system_prompt: '',
    turn_type: 'general',
    stakes: 'low',
    active_skill: null,
    phi_detected: false,
    phi_types: [],
    phi_guard_mode: 'informational',
    acl: { phi: false, redact: [] },
    input_tokens_approx: 0,
    truncated: false,
    credential_patterns_found: [],
    review_required: false,
    review_reason: null,
    model: null,
    provider: null,
    trace_id: null,
    ts_start: new Date().toISOString(),
    ...init,
  };
}
