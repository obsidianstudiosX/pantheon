-- ============================================================================
-- user_provider_credentials
-- ----------------------------------------------------------------------------
-- Encrypted per-user BYOK storage. Stores user-supplied provider API keys
-- (Anthropic, OpenAI, etc.) encrypted with a key derived from the user's
-- password / session secret.
--
-- User-supplied keys OVERRIDE fleet-wide keys in `secrets/providers/*.env`
-- for that user's agent invocations. Fleet keys remain the fallback when
-- no per-user key is set.
--
-- Never store plaintext credentials. The `encrypted_value` column is always
-- ciphertext; the shell backend holds the decryption key in-memory only.
--
-- Spec: docs/superpowers/specs/2026-04-20-pantheon-platform-architecture.md §4c / §5.1
-- ============================================================================

CREATE TABLE IF NOT EXISTS "user_provider_credentials" (
	"id" text PRIMARY KEY NOT NULL,

	"user_id" text NOT NULL,

	-- Provider identity (matches a `manifests/providers/<name>.yaml`).
	"provider_name" varchar(64) NOT NULL,

	-- Credential classification.
	"credential_type" varchar(32) NOT NULL DEFAULT 'api_key',
	"credential_label" varchar(128),

	-- Encrypted payload + envelope.
	"encrypted_value" text NOT NULL,
	"encryption_scheme" varchar(32) NOT NULL DEFAULT 'aes-256-gcm',
	"encryption_key_id" varchar(128) NOT NULL,
	"iv" varchar(64) NOT NULL,
	"auth_tag" varchar(64),

	-- Routing metadata (optional base URL override, region, etc.).
	"endpoint_override" text,
	"metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,

	-- Lifecycle.
	"active" boolean NOT NULL DEFAULT true,
	"last_used_at" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"expires_at" timestamp with time zone,

	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_provider_credentials" DROP CONSTRAINT IF EXISTS "user_provider_credentials_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_provider_credentials" ADD CONSTRAINT "user_provider_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_provider_credentials_user_provider_label_unique" ON "user_provider_credentials" USING btree ("user_id", "provider_name", "credential_label");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_provider_credentials_user_id_idx" ON "user_provider_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_provider_credentials_provider_name_idx" ON "user_provider_credentials" USING btree ("provider_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_provider_credentials_active_idx" ON "user_provider_credentials" USING btree ("user_id", "provider_name") WHERE "active" = true;
