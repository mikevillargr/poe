ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "research_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "generation_status" "research_status" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "generation_started_at" timestamp;