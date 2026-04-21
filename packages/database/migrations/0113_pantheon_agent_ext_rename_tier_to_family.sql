-- ============================================================================
-- pantheon_agent_ext — rename runtime_tier → runtime_family (RENAME ONLY)
-- ----------------------------------------------------------------------------
-- Mechanical rename sub-project: operator wants "runtime" as the primary
-- concept word. The column used to be `runtime_tier`; it becomes
-- `runtime_family`. Column type + default + NOT NULL constraint
-- unchanged; values unchanged (pantheon|openclaw|hermes|sandbox).
--
-- The associated index is renamed in lockstep:
--   pantheon_agent_ext_runtime_tier_idx → pantheon_agent_ext_runtime_family_idx
--
-- Event schema keys `from_tier`/`to_tier` in the `agent.tier-changed` event
-- payload (pantheon_manifest_events) are NOT renamed — that's public event
-- contract and any rows already written are historical.
--
-- Spec: home-repo CLAUDE.md + 2026-04-20 rename task brief.
-- ============================================================================

ALTER TABLE "pantheon_agent_ext"
  RENAME COLUMN "runtime_tier" TO "runtime_family";

ALTER INDEX IF EXISTS "pantheon_agent_ext_runtime_tier_idx"
  RENAME TO "pantheon_agent_ext_runtime_family_idx";
