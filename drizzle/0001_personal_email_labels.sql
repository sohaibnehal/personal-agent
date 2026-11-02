CREATE TABLE IF NOT EXISTS "classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_item_id" uuid NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"purpose" text NOT NULL,
	"importance" text NOT NULL,
	"action" text NOT NULL,
	"retention" text NOT NULL,
	"deadline" timestamp with time zone,
	"deadline_explicit" boolean DEFAULT false NOT NULL,
	"reason" text NOT NULL,
	"uncertain" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_item_id" uuid NOT NULL,
	"classification_id" uuid,
	"decision" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "classifications" ADD CONSTRAINT "classifications_raw_item_id_raw_items_id_fk" FOREIGN KEY ("raw_item_id") REFERENCES "public"."raw_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback_events" ADD CONSTRAINT "feedback_events_raw_item_id_raw_items_id_fk" FOREIGN KEY ("raw_item_id") REFERENCES "public"."raw_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback_events" ADD CONSTRAINT "feedback_events_classification_id_classifications_id_fk" FOREIGN KEY ("classification_id") REFERENCES "public"."classifications"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "classifications_item_version" ON "classifications" USING btree ("raw_item_id","prompt_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "classifications_action_idx" ON "classifications" USING btree ("action","importance");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_events_item_idx" ON "feedback_events" USING btree ("raw_item_id","created_at");