ALTER TABLE "articles" ADD COLUMN "research_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "duration_ms" integer;