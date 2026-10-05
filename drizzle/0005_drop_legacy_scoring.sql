-- Retire the scoring-era tables (D-001, approved by Mike 2026-10-05 with explicit confirmation).
-- Production rows at approval: content_documents 3, score_jobs 12, edit_suggestions 0, batch_jobs 0,
-- batch_job_items 0 (344 kB). The three NCH documents were copied into `articles` by migration 0002;
-- a named dump of these five tables is taken before the release that applies this.
-- Idempotent; order matters: the column (and its FK/unique) goes first, then leaf tables before parents.
ALTER TABLE "articles" DROP COLUMN IF EXISTS "legacy_document_id";--> statement-breakpoint
DROP TABLE IF EXISTS "batch_job_items";--> statement-breakpoint
DROP TABLE IF EXISTS "edit_suggestions";--> statement-breakpoint
DROP TABLE IF EXISTS "score_jobs";--> statement-breakpoint
DROP TABLE IF EXISTS "batch_jobs";--> statement-breakpoint
DROP TABLE IF EXISTS "content_documents";
