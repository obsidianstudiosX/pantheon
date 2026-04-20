-- ============================================================================
-- pantheon_memory_shards
-- ----------------------------------------------------------------------------
-- Catalog of Nayuta memory shards (§4 memory pipeline).
--
-- Seven canonical shards: S (hot/ephemeral), M (project/working),
-- L (canonical PHI, Postgres-only), A (affective/relational),
-- X (experimental/red-team), E (episodic key-value),
-- C (codex read-only filesystem vault).
--
-- Spec: docs/superpowers/specs/2026-04-20-pantheon-platform-architecture.md §4c / §4.1
-- ============================================================================

CREATE TABLE IF NOT EXISTS "pantheon_memory_shards" (
	"shard_id" varchar(4) PRIMARY KEY NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"backend" text NOT NULL,
	"phi_safe" boolean NOT NULL DEFAULT false,
	"ttl_days" integer,
	"description" text,
	"config" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"enabled" boolean NOT NULL DEFAULT true,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_memory_shards_backend_idx" ON "pantheon_memory_shards" USING btree ("backend");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_memory_shards_phi_safe_idx" ON "pantheon_memory_shards" USING btree ("phi_safe");--> statement-breakpoint

-- Seed the 7 canonical shards. Idempotent on re-run.
INSERT INTO "pantheon_memory_shards" ("shard_id", "display_name", "backend", "phi_safe", "ttl_days", "description") VALUES
	('S', 'Hot (ephemeral)', 'qdrant', false, 7, 'Session-scoped hot memory; 7-day TTL'),
	('M', 'Project (working)', 'qdrant', false, null, 'Per-project working memory'),
	('L', 'Canonical / PHI', 'postgres', true, null, 'PHI-safe canonical memory; Postgres-only, no Qdrant'),
	('A', 'Affective (relational)', 'qdrant', false, null, 'Agent-to-agent affective state'),
	('X', 'Experimental / red-team', 'qdrant', false, null, 'Adversarial / red-team; isolated'),
	('E', 'Episodic (key-value)', 'postgres', false, null, 'Episodic turn cache'),
	('C', 'Codex (read-only vault)', 'filesystem', false, null, 'Read-only filesystem knowledge vault')
ON CONFLICT ("shard_id") DO NOTHING;
