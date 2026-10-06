CREATE TABLE "client_universal_overrides" (
	"tenant_id" uuid NOT NULL,
	"universal_guideline_id" uuid NOT NULL,
	"active" boolean NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_universal_overrides_tenant_id_universal_guideline_id_pk" PRIMARY KEY("tenant_id","universal_guideline_id")
);
--> statement-breakpoint
ALTER TABLE "client_universal_overrides" ADD CONSTRAINT "client_universal_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_universal_overrides" ADD CONSTRAINT "client_universal_overrides_universal_guideline_id_universal_guidelines_id_fk" FOREIGN KEY ("universal_guideline_id") REFERENCES "public"."universal_guidelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_universal_overrides" ADD CONSTRAINT "client_universal_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- D-003 (Mike, 2026-10-06): Universal rules become live for every client instead of being copied at creation.
-- 1. A copy the client switched off becomes an off switch for that Universal rule.
INSERT INTO "client_universal_overrides" ("tenant_id", "universal_guideline_id", "active")
SELECT DISTINCT h."tenant_id", h."template_id", false
FROM "heuristics" h JOIN "universal_guidelines" u ON u."id" = h."template_id"
WHERE h."active" = false AND u."active" = true
  AND h."category" = u."category" AND h."title" IS NOT DISTINCT FROM u."title" AND h."rule" = u."rule"
  AND h."weight" = u."weight" AND h."content_template_id" IS NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- 2. Unedited copies of a Universal rule that is on are now redundant: the live rule covers them.
DELETE FROM "heuristics" h USING "universal_guidelines" u
WHERE u."id" = h."template_id" AND u."active" = true
  AND h."category" = u."category" AND h."title" IS NOT DISTINCT FROM u."title" AND h."rule" = u."rule"
  AND h."weight" = u."weight" AND h."content_template_id" IS NULL;--> statement-breakpoint
-- 3. Anything left that was copied (edited, scoped, or its Universal rule is off) stays as the client's own rule.
UPDATE "heuristics" SET "template_id" = NULL, "source" = 'manual' WHERE "template_id" IS NOT NULL;
