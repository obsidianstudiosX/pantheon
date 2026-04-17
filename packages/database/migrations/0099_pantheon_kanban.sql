CREATE TABLE IF NOT EXISTS "pantheon_kanban_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"priority" integer DEFAULT 0,
	"column_order" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pantheon_kanban_cards" DROP CONSTRAINT IF EXISTS "pantheon_kanban_cards_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_kanban_cards" ADD CONSTRAINT "pantheon_kanban_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantheon_kanban_cards" DROP CONSTRAINT IF EXISTS "pantheon_kanban_cards_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "pantheon_kanban_cards" ADD CONSTRAINT "pantheon_kanban_cards_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_kanban_cards_user_id_idx" ON "pantheon_kanban_cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_kanban_cards_agent_id_idx" ON "pantheon_kanban_cards" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pantheon_kanban_cards_status_idx" ON "pantheon_kanban_cards" USING btree ("status");
