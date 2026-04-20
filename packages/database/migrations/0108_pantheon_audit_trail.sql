-- ============================================================================
-- pantheon_audit_trail
-- ----------------------------------------------------------------------------
-- Append-only turn audit. One row per orchestrated turn — HIPAA-ready
-- (7-year retention on L-shard; this table is the durable record).
--
-- Survives Matrix retirement (redundant with Matrix m.notice events but
-- source-of-truth independent of the messaging substrate). Never UPDATE or
-- DELETE — audit rows are immutable once written. Use a scheduled archival
-- job for retention rollover (see §13 backup + DR).
--
-- Spec: docs/superpowers/specs/2026-04-20-pantheon-platform-architecture.md §4c / §6.1
-- ============================================================================

CREATE TABLE IF NOT EXISTS "pantheon_audit_trail" (
	"id" bigserial PRIMARY KEY NOT NULL,

	-- Turn identity.
	"trace_id" uuid NOT NULL,
	"turn_id" uuid NOT NULL,

	-- Participants.
	"agent_id" text,
	"user_id" text,

	-- Orchestration context.
	"pipeline" varchar(64),
	"dispatch_position" text,
	"role" varchar(64),

	-- Turn metadata.
	"event_type" text NOT NULL,
	"stakes" varchar(32),
	"phi_detected" boolean NOT NULL DEFAULT false,
	"phi_mode_active" text,
	"verify_result" text,
	"policy_decision" text,

	-- Token / cost accounting.
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(10, 6),

	-- Content digests (never raw content; use trace file ref).
	"input_hash" varchar(64),
	"output_hash" varchar(64),
	"trace_ref" text,

	-- Additional structured context.
	"metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,

	"ts" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "pantheon_audit_trail" DROP CONSTRAINT IF EXISTS "pantheon_audit_trail_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_audit_trail" ADD CONSTRAINT "pantheon_audit_trail_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantheon_audit_trail" DROP CONSTRAINT IF EXISTS "pantheon_audit_trail_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_audit_trail" ADD CONSTRAINT "pantheon_audit_trail_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Primary query patterns: "all turns for agent X ordered by time" and
-- "all turns for user Y ordered by time".
CREATE INDEX IF NOT EXISTS "pantheon_audit_trail_agent_id_ts_idx" ON "pantheon_audit_trail" USING btree ("agent_id", "ts" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_audit_trail_user_id_ts_idx" ON "pantheon_audit_trail" USING btree ("user_id", "ts" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_audit_trail_trace_id_idx" ON "pantheon_audit_trail" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_audit_trail_turn_id_idx" ON "pantheon_audit_trail" USING btree ("turn_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_audit_trail_event_type_idx" ON "pantheon_audit_trail" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_audit_trail_phi_detected_idx" ON "pantheon_audit_trail" USING btree ("phi_detected") WHERE "phi_detected" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_audit_trail_ts_idx" ON "pantheon_audit_trail" USING btree ("ts" DESC);
