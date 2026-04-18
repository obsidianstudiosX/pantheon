CREATE TABLE IF NOT EXISTS "pantheon_np_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"patient_initials" text,
	"submitted_by" varchar(255),
	"submission_text" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"external_tracking_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pantheon_np_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0,
	"created_by" varchar(255),
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pantheon_np_submissions" DROP CONSTRAINT IF EXISTS "pantheon_np_submissions_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_np_submissions" ADD CONSTRAINT "pantheon_np_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantheon_np_resources" DROP CONSTRAINT IF EXISTS "pantheon_np_resources_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_np_resources" ADD CONSTRAINT "pantheon_np_resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_np_submissions_user_id_idx" ON "pantheon_np_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_np_submissions_status_idx" ON "pantheon_np_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_np_resources_user_id_idx" ON "pantheon_np_resources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_np_resources_sort_idx" ON "pantheon_np_resources" USING btree ("sort_order");--> statement-breakpoint
-- Default curated resource: Clinical Guidelines portal. Inserted globally
-- (user_id placeholder) at migration time; intentionally visible to all users
-- because the "user_id" column gets populated for each tenant on first-save.
-- To avoid the FK constraint, we defer seeding to an INSERT that uses a
-- lookup against the users table. If there are no users yet, this insert
-- becomes a no-op and the operator can add the row via the UI.
INSERT INTO "pantheon_np_resources"
  ("id", "user_id", "title", "url", "description", "tags", "sort_order", "created_by")
SELECT
  'pnr_default_cg',
  u.id,
  'Clinical Guidelines',
  'https://guides.mindbridgepsych.org/',
  'MindBridge clinical guidelines & reference hub.',
  '["clinical", "guideline", "reference"]'::jsonb,
  0,
  'system'
FROM "users" u
ON CONFLICT ("id") DO NOTHING;
