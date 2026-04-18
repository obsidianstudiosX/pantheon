CREATE TABLE IF NOT EXISTS "pantheon_chart_review_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"submitted_text" text NOT NULL,
	"phi_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"redacted_text" text,
	"agent_id" text,
	"reject_reason" text,
	"dispatched_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pantheon_chart_review_results" (
	"id" text PRIMARY KEY NOT NULL,
	"queue_item_id" text NOT NULL,
	"response" text NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pantheon_chart_review_queue" DROP CONSTRAINT IF EXISTS "pantheon_chart_review_queue_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_chart_review_queue" ADD CONSTRAINT "pantheon_chart_review_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantheon_chart_review_results" DROP CONSTRAINT IF EXISTS "pantheon_chart_review_results_queue_item_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_chart_review_results" ADD CONSTRAINT "pantheon_chart_review_results_queue_item_id_fk" FOREIGN KEY ("queue_item_id") REFERENCES "public"."pantheon_chart_review_queue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_chart_review_queue_user_id_idx" ON "pantheon_chart_review_queue" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_chart_review_queue_status_idx" ON "pantheon_chart_review_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_chart_review_results_queue_item_id_idx" ON "pantheon_chart_review_results" USING btree ("queue_item_id");
