-- ============================================================================
-- pantheon_manifest_events  +  pantheon_manifest_events_dead_letter
-- ----------------------------------------------------------------------------
-- Durable event bus (§7 event bus). Backed by Postgres LISTEN/NOTIFY:
-- producers INSERT into this table in the same transaction as the state
-- change; a trigger fires NOTIFY on channel `pantheon_events` with the row
-- JSON payload; consumers subscribe via LISTEN. Crashed consumers replay by
-- scanning rows with id > last_processed_event_id.
--
-- Failed events (adapter error after retry budget) are copied into the
-- dead_letter table for operator review via the shell UI panel.
--
-- Spec: docs/superpowers/specs/2026-04-20-pantheon-platform-architecture.md §4c / §7
-- ============================================================================

CREATE TABLE IF NOT EXISTS "pantheon_manifest_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"channel" varchar(64) NOT NULL DEFAULT 'pantheon_events',
	"schema_version" varchar(16) NOT NULL DEFAULT '1.0',

	-- Provenance.
	"actor_user_id" text,
	"trace_id" uuid,

	-- Target identity (when applicable).
	"agent_slug" varchar(128),
	"manifest_kind" varchar(32),

	-- Before/after manifest content-addressed hashes (for diff + idempotency).
	"before_manifest_sha" varchar(64),
	"after_manifest_sha" varchar(64),

	-- Structured payload.
	"payload" jsonb NOT NULL DEFAULT '{}'::jsonb,

	-- Processing state.
	"status" text NOT NULL DEFAULT 'pending',
	"retry_count" integer NOT NULL DEFAULT 0,
	"last_error" text,

	"ts" timestamp with time zone NOT NULL DEFAULT now(),
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pantheon_manifest_events" DROP CONSTRAINT IF EXISTS "pantheon_manifest_events_actor_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_manifest_events" ADD CONSTRAINT "pantheon_manifest_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pantheon_manifest_events_event_id_unique" ON "pantheon_manifest_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_manifest_events_name_idx" ON "pantheon_manifest_events" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_manifest_events_agent_slug_idx" ON "pantheon_manifest_events" USING btree ("agent_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_manifest_events_status_idx" ON "pantheon_manifest_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_manifest_events_ts_idx" ON "pantheon_manifest_events" USING btree ("ts" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_manifest_events_pending_idx" ON "pantheon_manifest_events" USING btree ("id") WHERE "status" = 'pending';--> statement-breakpoint

-- Dead-letter queue.
CREATE TABLE IF NOT EXISTS "pantheon_manifest_events_dead_letter" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"original_event_id" bigint,
	"event_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"failure_reason" text NOT NULL,
	"retry_count" integer NOT NULL DEFAULT 0,
	"first_failed_at" timestamp with time zone NOT NULL DEFAULT now(),
	"moved_at" timestamp with time zone NOT NULL DEFAULT now(),
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" text,
	"resolution_notes" text
);
--> statement-breakpoint
ALTER TABLE "pantheon_manifest_events_dead_letter" DROP CONSTRAINT IF EXISTS "pantheon_mfst_events_dl_resolved_by_user_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_manifest_events_dead_letter" ADD CONSTRAINT "pantheon_mfst_events_dl_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_manifest_events_dl_event_id_idx" ON "pantheon_manifest_events_dead_letter" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_manifest_events_dl_unresolved_idx" ON "pantheon_manifest_events_dead_letter" USING btree ("moved_at" DESC) WHERE "resolved_at" IS NULL;--> statement-breakpoint

-- Postgres NOTIFY trigger: fires on INSERT only (events are immutable).
-- Consumers `LISTEN pantheon_events` and react to the JSON payload.
CREATE OR REPLACE FUNCTION notify_pantheon_events() RETURNS TRIGGER AS $$
BEGIN
	PERFORM pg_notify('pantheon_events', row_to_json(NEW)::text);
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "pantheon_events_notify" ON "pantheon_manifest_events";--> statement-breakpoint
CREATE TRIGGER "pantheon_events_notify"
	AFTER INSERT ON "pantheon_manifest_events"
	FOR EACH ROW EXECUTE FUNCTION notify_pantheon_events();
