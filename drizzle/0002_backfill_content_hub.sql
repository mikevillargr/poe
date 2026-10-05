-- Content Hub backfill (D-001). Idempotent; runs between the additive 0001 and the drop migration.

-- 1. The single scoring-era tenant becomes the "NCH Inc." client.
UPDATE "tenants"
SET "name" = 'NCH Inc.', "slug" = 'nch', "updated_at" = now()
WHERE "id" = '00000000-0000-0000-0000-000000000000'
  AND "slug" = 'default'
  AND NOT EXISTS (SELECT 1 FROM "tenants" WHERE "slug" = 'nch');
--> statement-breakpoint

-- 2. Existing heuristics came from document ingestion; order them by creation within each client.
UPDATE "heuristics" h
SET "source" = 'ingested',
    "sort_order" = ranked.rn * 1024
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "tenant_id" ORDER BY "created_at", "id") AS rn
  FROM "heuristics"
) ranked
WHERE h."id" = ranked."id"
  AND h."source" = 'manual'
  AND h."created_by" IS NULL
  AND h."template_id" IS NULL;
--> statement-breakpoint

-- 3. Password-era accounts can't sign in with Google; remove them before the credentials columns go.
DELETE FROM "users" WHERE "google_sub" IS NULL;
--> statement-breakpoint

-- 4. Scored documents become articles (done, or in_review if they were mid-edit), with an
--    'imported' version and event. legacy_document_id makes this safe to re-run.
INSERT INTO "articles" (
  "tenant_id", "position", "status", "status_changed_at", "title", "brief", "keywords",
  "draft_html", "word_count", "legacy_document_id", "created_at", "updated_at"
)
SELECT
  d."tenant_id",
  (row_number() OVER (PARTITION BY d."tenant_id" ORDER BY d."created_at", d."id")) * 1024,
  (CASE WHEN d."status" = 'editing' THEN 'in_review' ELSE 'done' END)::article_status,
  d."updated_at",
  d."title",
  'Imported from Poe scoring' ||
    CASE WHEN d."overall_score" IS NOT NULL THEN ' (score ' || d."overall_score" || '/100)' ELSE '' END,
  '{}',
  CASE
    WHEN coalesce(d."edited_text", d."original_text") ~ '^\s*<' THEN coalesce(d."edited_text", d."original_text")
    ELSE '<p>' || regexp_replace(
      replace(replace(replace(coalesce(d."edited_text", d."original_text"), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
      E'\\n\\s*\\n+', '</p><p>', 'g'
    ) || '</p>'
  END,
  coalesce(array_length(regexp_split_to_array(btrim(regexp_replace(
    coalesce(d."edited_text", d."original_text"), '<[^>]+>', ' ', 'g')), '\s+'), 1), 0),
  d."id",
  d."created_at",
  d."updated_at"
FROM "content_documents" d
WHERE NOT EXISTS (SELECT 1 FROM "articles" a WHERE a."legacy_document_id" = d."id");
--> statement-breakpoint

INSERT INTO "article_versions" ("article_id", "version_no", "html", "kind", "label", "word_count", "created_at")
SELECT a."id", 1, a."draft_html", 'imported', 'Imported from Poe scoring', a."word_count", a."created_at"
FROM "articles" a
WHERE a."legacy_document_id" IS NOT NULL
  AND a."draft_html" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "article_versions" v WHERE v."article_id" = a."id");
--> statement-breakpoint

INSERT INTO "article_events" ("article_id", "tenant_id", "type", "to_status", "payload", "at")
SELECT a."id", a."tenant_id", 'imported', a."status"::text,
       jsonb_build_object('legacyDocumentId', a."legacy_document_id"), a."created_at"
FROM "articles" a
WHERE a."legacy_document_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "article_events" e WHERE e."article_id" = a."id" AND e."type" = 'imported');
