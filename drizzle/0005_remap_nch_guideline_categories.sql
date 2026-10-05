-- NCH's 26 rules were ingested before the canonical categories existed and carry free-text category
-- names, which the Guidelines page did not render. Map them onto the canonical set. Scoped to the
-- NCH client and to the exact legacy names, so it is a no-op anywhere else and safe to re-run.
UPDATE "heuristics" h SET "category" = CASE h."category"
    WHEN 'Brand Voice & Messaging' THEN 'brand'
    WHEN 'SEO & Readability' THEN 'seo'
    ELSE 'client'
  END
FROM "tenants" t
WHERE h."tenant_id" = t."id"
  AND t."slug" = 'nch'
  AND h."category" IN (
    'Brand Voice & Messaging', 'SEO & Readability', 'Call-to-Action',
    'Compliance & Accuracy', 'Entity Formation Standards', 'Target Audience Alignment'
  );
