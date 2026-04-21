-- Pantheon event-bus subscriber bookkeeping.
-- Each subscriber records last_processed_event_id so a crashed consumer
-- can resume cleanly. Referenced by control-plane/events/bus.py
-- Subscriber._mark_processed().

CREATE TABLE IF NOT EXISTS "pantheon_subscriber_state" (
	"handler_name" text PRIMARY KEY,
	"last_processed_event_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
