-- ============================================================================
-- pantheon_agent_memory_bindings
-- ----------------------------------------------------------------------------
-- Per-agent shard ACL. One row per (agent, shard) pair expressing what an
-- agent can read/write in that memory shard, plus ACL semantics
-- (`self-only`, `clinical-only`, etc. — see §2.1 memory.acl).
--
-- Authoritative writer: control-plane (derived from manifest memory.shards[]
-- + memory.acl). Shell UI reads through the memory panel (§3.2).
--
-- Spec: docs/superpowers/specs/2026-04-20-pantheon-platform-architecture.md §4c / §4.2
-- ============================================================================

CREATE TABLE IF NOT EXISTS "pantheon_agent_memory_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"shard_id" varchar(4) NOT NULL,

	-- Read / write permission flags.
	"can_read" boolean NOT NULL DEFAULT true,
	"can_write" boolean NOT NULL DEFAULT false,

	-- ACL scope: 'open' | 'self-only' | 'clinical-only' | 'ratifiers-only' | ...
	"acl_scope" text NOT NULL DEFAULT 'open',

	-- Retrieval tuning (overrides per-agent defaults when non-null).
	"retrieval_top_k" integer,
	"retrieval_min_score" numeric(4, 3),

	-- Free-form per-binding config (e.g. collection name for Qdrant).
	"config" jsonb NOT NULL DEFAULT '{}'::jsonb,

	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "pantheon_agent_memory_bindings" DROP CONSTRAINT IF EXISTS "pantheon_agent_memory_bindings_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_agent_memory_bindings" ADD CONSTRAINT "pantheon_agent_memory_bindings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantheon_agent_memory_bindings" DROP CONSTRAINT IF EXISTS "pantheon_agent_memory_bindings_shard_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_agent_memory_bindings" ADD CONSTRAINT "pantheon_agent_memory_bindings_shard_id_fk" FOREIGN KEY ("shard_id") REFERENCES "public"."pantheon_memory_shards"("shard_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pantheon_agent_memory_bindings_agent_shard_unique" ON "pantheon_agent_memory_bindings" USING btree ("agent_id", "shard_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_agent_memory_bindings_agent_id_idx" ON "pantheon_agent_memory_bindings" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_agent_memory_bindings_shard_id_idx" ON "pantheon_agent_memory_bindings" USING btree ("shard_id");
