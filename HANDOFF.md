# HANDOFF — Poe

Last updated: 2026-09-28 by Claude (initial seed)

Read this first, then `CLAUDE.md` (the brief), then `AGENTS.md` (how to work here). Update this
file before you stop.

## What this is

Poe is Growth Rocket's internal AI content grading and scoring app (Next.js 15 + Drizzle/Postgres
with pgvector + Anthropic Claude). It scores content against brand/SEO/blacklist/agency/client
heuristics and suggests inline edits.

## Where it runs

| | |
|---|---|
| Server | `hostinger-vps` (76.13.191.149), shared with RedditPipe, AlwaysSunny, n8n, OpenClaw, NanoClaw, SFTP, Ollama |
| Live path | **`/var/www/poe`** (git checkout) running `docker-compose.yml`: `app` :3001, `db` pgvector :5432 (bound `0.0.0.0`) |
| Stale copy | `/opt/poe` at `v0.1.1`, not running. This is where CI's `deploy.yml` points |
| Public entry | http://76.13.191.149:3001. No domain, no TLS, no nginx |
| Deployed version | `v1.0.0-32-g7c555f6` |
| `origin/main` | `1f219c4` (`v1.0.0-33`). **Server is 1 commit behind**, but the only difference is `README.md` (docs), so the running code matches `main` |
| Deploy | manual on the server (`git pull` + `docker-compose up -d --build`); see `AGENTS.md` §6 |

## In flight

- Mike's local clone (`~/Documents/Poe`) is on **`feature/content-type-mapping`** (branched at
  `1f219c4`, no commits yet) with uncommitted work: modified `analyze/EditorView.tsx`,
  `analyze/page.tsx`, `guidelines/page.tsx`, `api/content/parse`, `api/documents`,
  `api/guidelines/list`, `api/guidelines/save`, `api/score`, `lib/db/schema.ts`; new
  `app/api/content-types/`, `components/ContentTypeManager.tsx`, `lib/content-types.ts`,
  `drizzle/`. That's a content-type mapping feature with a schema change. Don't touch it; when it
  ships, the schema change needs a migration/push on the live DB.
- No other unmerged local branches.

## Known issues / drift

- **Deploy path mismatch.** `.github/workflows/deploy.yml` and `CLAUDE.md` deploy to `/opt/poe`;
  the live app is `/var/www/poe`. All 6 workflow runs ever (2026-04-21) failed within ~10s, so CI
  has never deployed. The `/opt/poe` copy at v0.1.1 was presumably placed by hand.
- **Auth is effectively open.** Login is a hardcoded `admin`/`admin` check in the browser that
  sets an `isAuthenticated=true` cookie; `middleware.ts` trusts that cookie and leaves all
  `/api/*` routes public. `auth.ts` (NextAuth + bcrypt) isn't wired in. The app is on a public IP
  over plain HTTP.
- **Postgres :5432 published on `0.0.0.0`** with credentials committed in `docker-compose.yml`
  and the deploy scripts. `ufw` is inactive on the host.
- Production container runs `npm run dev` with `NODE_ENV=development` (single-stage
  `Dockerfile`), unlike the standalone build `CLAUDE.md` specifies.
- `CLAUDE.md` drift: route group is `(main)` not `(app)`; Dockerfile/compose/nginx and auth
  sections describe the intended design, not the repo.
- `package.json` version is `0.1.1` while the latest tag is `v1.0.0`; `npm run release:patch`
  would produce `v0.1.2`.
- CI (`ci.yml`) runs on pull requests only and has never run.

## Next steps

1. **Fleet registration (`AGENTS.md` §10):** add `labels: { command.app: poe }` to `app` and `db`
   in `docker-compose.yml`, and add `ARG GIT_SHA` + `LABEL org.opencontainers.image.revision=$GIT_SHA`
   to the `Dockerfile` (pass it via compose `build.args`, e.g. from `git rev-parse HEAD` in the
   deploy command; `/var/www/poe` is a git checkout so that works).
2. Decide the deploy path question below, then either fix `deploy.yml` to use `/var/www/poe`
   (and fix its failing SSH secrets) or document manual deploy as the official path; update
   `CLAUDE.md` and `app.yaml` to match.
3. Bind Postgres to `127.0.0.1` (or drop the `ports:` mapping) and move DB credentials into `.env`.
4. Wire real auth (`auth.ts`) into login + middleware, and protect `/api/*`.
5. Set `package.json` version to `1.0.0` before the next release.

## Open questions

- **Which path is canonical, `/var/www/poe` or `/opt/poe`?** CI and `CLAUDE.md` say `/opt/poe`;
  the live app is `/var/www/poe`. Can `/opt/poe` be deleted (ask before doing so)?
- Is Poe in active production use at Growth Rocket (`app.yaml` has a `TODO(verify)` on `status`)?
- Should Poe get a domain + TLS (the host has no certbot or active reverse proxy)?
