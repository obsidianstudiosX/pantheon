-- ============================================================================
-- pantheon_kb_bindings
-- ----------------------------------------------------------------------------
-- Knowledge-base document → (agent, shard) bindings.
--
-- LobeHub native `knowledge_bases` holds the KB document itself. Pantheon
-- layers additional routing on top: which agents see this KB, which shard
-- it's mirrored into for retrieval (typically C — codex — for read-only
-- canonical vaults, or M for per-project working corpora).
--
-- Spec: docs/superpowers/specs/2026-04-20-pantheon-platform-architecture.md §4c / §4.2
-- ============================================================================

CREATE TABLE IF NOT EXISTS "pantheon_kb_bindings" (
	"id" text PRIMARY KEY NOT NULL,

	-- Either knowledge_base_id or document-level reference.
	"knowledge_base_id" text,

	-- Binding target: agent gets read access to this KB (nullable = fleet-wide).
	"agent_id" text,

	-- Shard into which KB is projected for vector retrieval.
	"shard_id" varchar(4),

	-- Binding role: 'owner' | 'reader' | 'mirror' | 'source-of-truth'
	"binding_role" text NOT NULL DEFAULT 'reader',

	-- Free-form: collection name, ingest config, embedding model override.
	"config" jsonb NOT NULL DEFAULT '{}'::jsonb,

	-- Sync state.
	"last_indexed_at" timestamp with time zone,
	"index_status" text NOT NULL DEFAULT 'pending',

	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "pantheon_kb_bindings" DROP CONSTRAINT IF EXISTS "pantheon_kb_bindings_knowledge_base_id_knowledge_bases_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_kb_bindings" ADD CONSTRAINT "pantheon_kb_bindings_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantheon_kb_bindings" DROP CONSTRAINT IF EXISTS "pantheon_kb_bindings_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_kb_bindings" ADD CONSTRAINT "pantheon_kb_bindings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantheon_kb_bindings" DROP CONSTRAINT IF EXISTS "pantheon_kb_bindings_shard_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_kb_bindings" ADD CONSTRAINT "pantheon_kb_bindings_shard_id_fk" FOREIGN KEY ("shard_id") REFERENCES "public"."pantheon_memory_shards"("shard_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_kb_bindings_kb_id_idx" ON "pantheon_kb_bindings" USING btree ("knowledge_base_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_kb_bindings_agent_id_idx" ON "pantheon_kb_bindings" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_kb_bindings_shard_id_idx" ON "pantheon_kb_bindings" USING btree ("shard_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_kb_bindings_index_status_idx" ON "pantheon_kb_bindings" USING btree ("index_status");
