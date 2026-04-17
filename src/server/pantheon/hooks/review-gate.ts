/**
 * Review gate — signal-only pre-LLM escalation check.
 *
 * Ported from hooks.py apply_review_gate_pre (lines 248-257). Spec for
 * Phase 3.2: SIGNAL ONLY — sets `env.review_required` + `env.review_reason`.
 * No enforcement, no blocking. Enforcement lives downstream in the
 * chat-service patch (Phase 3.3).
 */
import type { ReviewGateConfig, TurnEnvelope } from './types';

export const DEFAULT_REVIEW_ROLES_REQUIRING_ECLIPSE: ReadonlySet<string> =
  new Set(['clinical', 'architecture', 'ethics', 'operations', 'final-authority']);

function normalizeRoleSet(
  roles: ReviewGateConfig['rolesRequiringEclipse'],
): ReadonlySet<string> {
  if (!roles) return DEFAULT_REVIEW_ROLES_REQUIRING_ECLIPSE;
  if (roles instanceof Set) return roles;
  return new Set(roles);
}

export function applyReviewGatePre(
  env: TurnEnvelope,
  cfg: ReviewGateConfig = {},
): TurnEnvelope {
  const registry = cfg.registry ?? {};
  const rolesSet = normalizeRoleSet(cfg.rolesRequiringEclipse);
  const role = registry[env.agent_id]?.role ?? '';

  if (rolesSet.has(role)) {
    env.review_required = true;
    env.review_reason = `role=${role} requires Eclipse sign-off`;
  }
  if (env.phi_guard_mode === 'strict') {
    env.review_required = true;
    env.review_reason = (env.review_reason ?? '') + ' + phi_guard=strict';
  }
  return env;
}
