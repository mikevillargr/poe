ALTER TYPE "public"."article_version_kind" ADD VALUE 'edit_checkpoint';--> statement-breakpoint
CREATE INDEX "article_events_article_at_idx" ON "article_events" USING btree ("article_id","at");