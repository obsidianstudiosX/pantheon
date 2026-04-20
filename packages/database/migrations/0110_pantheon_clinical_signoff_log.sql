-- ============================================================================
-- pantheon_clinical_signoff_log
-- ----------------------------------------------------------------------------
-- Immutable clinical sign-off certification log. One row per operator-issued
-- clinical authorization (e.g., "PHI pipeline cert on 2026-04-17"). Serial
-- PK, append-only, cryptographic signature + operator signoff hash.
--
-- Mirrors the plaintext `clinical_signoff.md` journal with a
-- machine-queryable representation so shell UI + control-plane can check
-- "is this agent currently clinically certified for PHI?" without parsing
-- markdown.
--
-- Spec: docs/superpowers/specs/2026-04-20-pantheon-platform-architecture.md §4c / §6.1
-- ============================================================================

CREATE TABLE IF NOT EXISTS "pantheon_clinical_signoff_log" (
	"id" serial PRIMARY KEY NOT NULL,

	-- Identity of what is being certified.
	"scope" text NOT NULL,
	"agent_id" text,
	"pipeline_name" varchar(128),
	"policy_bundle_ref" varchar(255),

	-- Cert metadata.
	"cert_date" date NOT NULL,
	"valid_from" timestamp with time zone NOT NULL DEFAULT now(),
	"valid_until" timestamp with time zone,
	"cert_version" varchar(32) NOT NULL,

	-- Signoff artifacts.
	"signoff_by_user_id" text NOT NULL,
	"signoff_role" varchar(64) NOT NULL DEFAULT 'operator',
	"signoff_text" text,
	"signoff_hash" varchar(128) NOT NULL,

	-- Status lifecycle: 'active' | 'revoked' | 'superseded' | 'expired'.
	-- Rows are never UPDATEd except to flip status + add revoked_at; all
	-- other fields are immutable by convention (DB enforces via trigger at a
	-- later migration if needed).
	"status" text NOT NULL DEFAULT 'active',
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" text,
	"revocation_reason" text,

	-- Reference to the cert's canonical markdown (path in git repo).
	"source_markdown_path" text,
	"source_markdown_sha" varchar(64),

	"metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,

	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "pantheon_clinical_signoff_log" DROP CONSTRAINT IF EXISTS "pantheon_clinical_signoff_log_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_clinical_signoff_log" ADD CONSTRAINT "pantheon_clinical_signoff_log_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantheon_clinical_signoff_log" DROP CONSTRAINT IF EXISTS "pantheon_clinical_signoff_log_signoff_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_clinical_signoff_log" ADD CONSTRAINT "pantheon_clinical_signoff_log_signoff_by_user_id_users_id_fk" FOREIGN KEY ("signoff_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantheon_clinical_signoff_log" DROP CONSTRAINT IF EXISTS "pantheon_clinical_signoff_log_revoked_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_clinical_signoff_log" ADD CONSTRAINT "pantheon_clinical_signoff_log_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_clinical_signoff_log_agent_id_idx" ON "pantheon_clinical_signoff_log" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_clinical_signoff_log_scope_idx" ON "pantheon_clinical_signoff_log" USING btree ("scope");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_clinical_signoff_log_status_idx" ON "pantheon_clinical_signoff_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_clinical_signoff_log_cert_date_idx" ON "pantheon_clinical_signoff_log" USING btree ("cert_date" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_clinical_signoff_log_active_idx" ON "pantheon_clinical_signoff_log" USING btree ("agent_id", "scope") WHERE "status" = 'active';
