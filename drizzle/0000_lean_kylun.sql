CREATE TABLE IF NOT EXISTS "briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"account" text NOT NULL,
	"summary" text NOT NULL,
	"item_count" text NOT NULL,
	"raw_item_ids" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cursors" (
	"source" text NOT NULL,
	"account" text NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raw_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"account" text NOT NULL,
	"external_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text,
	"snippet" text,
	"url" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "briefings_source_idx" ON "briefings" USING btree ("source","generated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cursors_pk" ON "cursors" USING btree ("source","account");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "raw_items_uniq" ON "raw_items" USING btree ("source","account","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "raw_items_occurred_idx" ON "raw_items" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "raw_items_source_idx" ON "raw_items" USING btree ("source","occurred_at");