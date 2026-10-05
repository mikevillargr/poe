# Archive: retired setup notes (2026-10-05)

**Retired 2026-10-05 by Mike (D-001, Poe becomes the AI-powered Content Hub). Treat as removed, not as a target to restore.**

These files describe earlier incarnations of Poe: the scoring-only app with browser-stored API keys, a hardcoded
`admin`/`admin` login, a single hardcoded tenant, pm2 and "build on the server" deploys, and the dev-server container.
They are kept only so an old commit message or an orphaned reference still makes sense. They are **stale and in places
wrong or unsafe** for the current system; do not follow them.

| File | What it was |
|---|---|
| `DEPLOYMENT.md`, `DEPLOYMENT_SUMMARY.md`, `DOCKER_MIGRATION.md` | pm2 and early Docker deploy notes (VPS at `/var/www/poe`, dev-server container) |
| `INITIAL_PROMPT.md` | The first build prompt for the scoring app |
| `DATABASE_SETUP.md`, `QUICK_START.md`, `TESTING_CHECKLIST.md` | Local setup and manual test notes for the scoring app |
| `db-init.sh` | Created a local `poe_db`/`poe_user` and used `db:push` (now banned against real data) |

**Current docs:** `README.md`, `CLAUDE.md` (the project brief) and `docs/deploy/CUTOVER.md` (deploys, rollback).

## Retired code (removed in the same change)
- The scoring-era API routes (`/api/score`, `/api/documents`, `/api/batch`, `/api/guidelines/{list,save,extract,ingest,ingest-job,[id]}`,
  `/api/heuristics/dimensions`, `/api/suggestions/recompose`, `/api/content/analyze-base`) and the Analyze page's editor. Their
  replacements: articles and guidelines under `/api/clients/[clientId]/…`, the Article Workspace, and the Optimize panel.
- The browser-stored API key and model settings (`hooks/useSettings.ts`, `utils/settings.ts`, `lib/crypto.ts`) and the in-memory
  version store. Keys are now server-side (Settings, encrypted in the database).
- Old code is on `main` at tag **v1.0.0** (`git show v1.0.0:<path>`).

## Retired data (not yet dropped)
`content_documents`, `score_jobs`, `edit_suggestions`, `batch_jobs`, `batch_job_items` remain in the database, read-only. The three NCH
documents were copied into `articles` by migration 0002. Dropping the old tables needs Mike's explicit double confirmation.
