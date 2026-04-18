CREATE TABLE IF NOT EXISTS "pantheon_agent_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"label" varchar(255) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"parent_snapshot_id" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pantheon_agent_snapshots" DROP CONSTRAINT IF EXISTS "pantheon_agent_snapshots_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_agent_snapshots" ADD CONSTRAINT "pantheon_agent_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantheon_agent_snapshots" DROP CONSTRAINT IF EXISTS "pantheon_agent_snapshots_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_agent_snapshots" ADD CONSTRAINT "pantheon_agent_snapshots_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_agent_snapshots_user_id_idx" ON "pantheon_agent_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_agent_snapshots_agent_id_idx" ON "pantheon_agent_snapshots" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_agent_snapshots_user_agent_idx" ON "pantheon_agent_snapshots" USING btree ("user_id","agent_id");
