# Poe Agent Operations Manual

> **Start here: read `HANDOFF.md` first.** It has the current state, what's in progress, next
> steps and blockers. Then read `CLAUDE.md` (the brief: what this project is), then this file
> (how to work here). Before you stop, update `HANDOFF.md` (see §9).

**Read this before you touch any file.** `CLAUDE.md` defines *what this project is*: stack,
design system, routing, data model, conventions. Read that too. Be aware that parts of it
describe the *intended* build (Dockerfile, compose file, deploy path, auth) rather than what's in
the repo today; the traps in §2 and §6 below list the known gaps.

**This file only covers *how to execute work in this repo***: git discipline, how to avoid
editing the wrong file, verification steps, and how to keep documentation in sync. It
deliberately does not prescribe stack choices, architecture, or coding patterns; that's the
brief's job. If you find yourself adding "use X framework" or "the right way to do Y is..." to
this file, that content belongs in the brief instead.

Derived from `~/Documents/Ghost/AGENTS.md` (2026-09-28). The same template is rolled out to every
app repo in Mike's fleet.

---

# 0. This project

**Poe** is Growth Rocket's internal AI content grading and scoring app: it scores content against
brand guidelines, topical blacklists, SEO/AIO criteria, and agency/client rules ("heuristics"),
and proposes inline edits. Next.js 15 (App Router) + TypeScript, TipTap editor, Drizzle ORM on
Postgres (pgvector), Anthropic Claude for scoring.

Production runs on Mike's Hostinger VPS `hostinger-vps` (76.13.191.149) as a Docker Compose stack
(`app` on :3001, `db` pgvector on :5432) from **`/var/www/poe`**, reached directly at
`http://76.13.191.149:3001`. No domain, no TLS, no reverse proxy. The box is shared with
RedditPipe, AlwaysSunny, n8n, OpenClaw, NanoClaw and others; don't touch their containers or
directories.

---

## 1. The #1 Rule: Local Branch First, `main` Is Production

**No commits land directly on `main`. Ever.** (This supersedes `CLAUDE.md`'s "Release Workflow",
which says to commit on `main`.)

```
1. Start every change on a branch:
   git checkout main && git pull origin main
   git checkout -b fix/short-description        # or feat/, chore/, refactor/, docs/

2. Do the work locally. Commit on the branch as you go:
   git add path/to/file ...                     # never git add -A / git add .
   git commit -m "type: description"

3. Verify before merging (see §5: Mandatory Verification)

4. Merge into main only when the change is ready to ship:
   git checkout main && git pull origin main
   git merge --no-ff fix/short-description
   git push origin main
   (or open a PR and merge via GitHub; either is fine, the gate is
   "not a direct commit to main". A PR also runs CI, see §5.)

5. Deploy (see §6). Merging does NOT deploy. Production is updated by a manual step on the
   server; the tag-triggered workflow targets the wrong directory and has never succeeded.
```

**Never push a work-in-progress branch's commits straight onto `main`.** If you're mid-task and
the session ends, the branch stays as a branch; do not merge unfinished work to close it out.

**Ask before merging/deploying** if the change is large, risky, touches auth/payments/data
deletion, or you're not confident it's finished. Small, low-risk fixes (typos, copy, obvious
bugs) can go through the full branch→merge→deploy cycle without pausing for approval; the point
of the branch is a clean rollback path, not a permission gate for every commit.

## 1a. Destructive Operations Require Double Confirmation

Before any destructive or hard-to-reverse action, **state exactly what you're about to do and
wait for explicit confirmation, then confirm once more immediately before executing it.** One
"yes, go ahead" earlier in a conversation authorizes the general plan, not license to chain
further destructive steps without saying what they are.

This covers (non-exhaustive): deleting or force-pushing branches (local or remote), `git reset
--hard` / `git clean`, dropping or truncating DB tables/columns, deleting migrations, removing
files that aren't clearly dead/unused, revoking API keys or third-party auth, running
`drizzle-kit push`/`drop` against the production DB, and any action against a production or
shared environment beyond the standard deploy steps in §6.

Routine, easily-reversed actions are exempt: creating a branch, committing to a branch, opening a
PR, running the standard deploy steps in §6, or deleting a file you just created in the same
session.

If you're not sure whether something counts as destructive, treat it as if it does.

## 1b. Modifying This File Itself Requires Approval

You may (and should) propose changes to this file when you find it's wrong: a stale
codebase-map entry, a verification command that no longer works, a convention note that no
longer matches the code, a process step that doesn't reflect what actually happens in this repo
anymore. Treat discovering drift in this file the same way you'd treat discovering a bug: flag
it, don't just silently work around it and leave the next agent to hit the same wrong information.

This file governs how every future agent session behaves in this repo, so an unreviewed error
here doesn't just affect one task; it compounds across every session that reads it afterward.
So, unlike routine code fixes (§1's "small, low-risk changes don't need to pause for approval"):

1. State what you found wrong and *why*: cite the actual code/behavior that contradicts what
   this file currently says.
2. Propose the specific edit.
3. Get explicit approval before merging it. Still use the normal branch-first flow (§1) to make
   the change, but do not treat it as routine or low-risk just because the diff is small.

Good candidates for a proposed edit: the file describes something that's been renamed/retired/
moved, a listed command now fails, a recurring pattern of agent mistakes points at a missing
rule. Not good candidates: expanding this file into brief territory, or rewriting sections
because of a stylistic preference rather than a concrete finding.

## 2. Codebase Map: Where Things Actually Live

```
poe/
  app/
    (auth)/login/page.tsx     # login page (see auth trap below)
    (main)/                   # route group WITH sidebar. CLAUDE.md calls this "(app)"; it's "(main)"
      layout.tsx
      page.tsx
      analyze/page.tsx        # score-content screen; the editor itself is analyze/EditorView.tsx
      dashboard/page.tsx      # job queue + batch uploads
      guidelines/page.tsx     # heuristic store. page-old.tsx next to it is DEAD (not a route
                              # Next.js serves, not imported anywhere); don't edit it
      settings/page.tsx
    api/                      # route handlers: score, batch, documents, guidelines/*,
                              # heuristics/dimensions, content/*, settings/test-api-key,
                              # suggestions/recompose, auth/[...nextauth]
  components/                 # Sidebar, ScoreGauge, CategoryBadge, VersionHistory,
                              # SuggestionRecomposition, editor/RichTextEditor, feedback/*
  hooks/  stores/             # client hooks; zustand stores (suggestions, versions)
  lib/db/schema.ts            # Drizzle schema (single source for tables)
  lib/db/index.ts             # DB client
  lib/storage/in-memory.ts    # FILE-based fallback store for heuristics (see trap below)
  lib/storage/ingest-jobs.ts  # guideline ingest job state
  auth.ts                     # NextAuth credentials config (NOT what the login page uses)
  middleware.ts               # route protection (see auth trap below)
  Dockerfile                  # what production actually builds (see §6 trap)
  docker-compose.yml          # used as-is in production at /var/www/poe: app :3001, db :5432
  docker/nginx.conf           # not used by the compose file; no nginx runs for Poe
  deploy.sh / deploy-fresh.sh # OLD pm2-based deploy scripts (pre-Docker). Not the current path
  deploy-docker.sh            # one-shot Docker bootstrap for /var/www/poe (see §6 trap)
  scripts/release.js          # `npm run release:*`: bumps package.json, tags, pushes
  scripts/seed*.ts            # `npm run db:seed` / `db:seed:prod`
  .github/workflows/ci.yml    # lint + typecheck, on pull requests only
  .github/workflows/deploy.yml# tag push → SSH deploy to /opt/poe (WRONG path, see §6)
```

Other root docs (`DEPLOYMENT.md`, `DEPLOYMENT_SUMMARY.md`, `DOCKER_MIGRATION.md`,
`GOOGLE_DRIVE_SETUP.md`, `INITIAL_PROMPT.md`, `docs/*.md`) are historical notes from earlier
setups; check them against the code before trusting them.

**Trap: auth is not what `CLAUDE.md` describes.** The login page
(`app/(auth)/login/page.tsx`) checks a hardcoded `admin`/`admin` in the browser and then sets a
plain `isAuthenticated=true` cookie; `middleware.ts` only checks that cookie, and treats every
`/api/*` path as public. `auth.ts` (NextAuth + bcrypt against the `users` table) exists but the
login flow doesn't call it. If you're asked to change login or protect an endpoint, you're
changing `login/page.tsx` + `middleware.ts`, not `auth.ts`, and you should flag this to Mike.

**Trap: heuristics can silently come from a file instead of the DB.** `api/guidelines/list`,
`api/guidelines/save` and `api/score` try the database and, on any DB error, fall back to
`.heuristics-store.json` in the process cwd (`lib/storage/in-memory.ts`). In the container that
file isn't on a volume, so it's lost on rebuild. The list endpoint returns `source: "file"` vs
`"database"`; check that field before assuming a DB write worked.

**Trap: `drizzle.config.ts` loads `.env.local`, not `.env`.** `npm run db:*` commands fall back
to `postgresql://localhost:5432/poe_db` if `.env.local` doesn't set `DATABASE_URL`, which is
probably not the DB you meant.

## 3. Find Where Code Is Actually Used Before Editing

**Most agent failures come from editing a file that looks right but is never imported.**

A common pattern: user asks for a UI change → agent finds a plausibly-named component →
implements there → commits → nothing changes, because the actual UI is rendered somewhere else
(here: inline in `analyze/EditorView.tsx` or a page file, or in the dead
`guidelines/page-old.tsx`).

Before writing a line of code:

```bash
# Verify the component/module you're about to edit is actually imported somewhere
grep -rn "ScoreGauge" app components hooks stores lib | grep "import\|from"

# Find where the FEATURE actually renders/executes (use a string unique to its current behavior)
grep -rn "Invalid credentials" app components
```

If the file you were about to edit isn't referenced anywhere live, stop and look elsewhere.

## 4. API/Interface Shape Changes: Update All Callers Or Don't Change

The `app/api/*` route handlers are called from client pages and components via `fetch`. When you
change a route's request or response shape, find every caller in the same commit:

```bash
grep -rn "/api/guidelines/list" app components hooks stores lib
```

Same for `lib/db/schema.ts`: a column change affects every route that selects/inserts it, and
the scoring output shape (`CLAUDE.md` → "Scoring Prompt Output") is parsed by `api/score` and
rendered by the analyze screen. Update all of them before merging.

## 5. Mandatory Verification Before Merging To `main`

```bash
npm ci
npm run lint          # next lint
npm run typecheck     # tsc --noEmit
npm run build         # next build
docker compose config > /dev/null
```

Fix any errors; do not merge with a broken build.

**`npm run build` passing proves little on its own:** `next.config.ts` sets
`typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`, so type and lint errors don't fail
the build. `npm run typecheck` and `npm run lint` are the real gates.

CI (`.github/workflows/ci.yml`) runs lint + typecheck **only on pull requests to `main`**, not on
pushes, and the repo has never had a CI run. Run the commands locally either way.

Local smoke test: `docker compose up -d --build` then open http://localhost:3001, or
`npm run dev` (also :3001).

## 6. Deployment (After Merging To `main`)

**Where it actually runs (fleet inventory, 2026-09-28):** `hostinger-vps`, **`/var/www/poe`**, a
git checkout running `docker-compose.yml` as-is: `app` (:3001) + `db` (pgvector, :5432 published
on `0.0.0.0`). Deployed version `v1.0.0-32-g7c555f6`. No domain, TLS or nginx in front.

**Current manual deploy** (as documented in `README.md`; run once, no retry loops):

```bash
ssh hostinger-vps "cd /var/www/poe && git pull origin main && docker-compose down && docker-compose up -d --build"
```

**Trap: the CI deploy workflow targets the wrong copy.** `.github/workflows/deploy.yml` (and
`CLAUDE.md`'s "VPS Setup" and "Release Workflow") deploy on a `v*.*.*` tag push to **`/opt/poe`**.
That is a **stale second copy** on the server (at `v0.1.1`); the live app is `/var/www/poe`.
Every run of that workflow so far (6 runs, 2026-04-21, including `v0.1.1` and `v1.0.0`) failed
within ~10s, so `npm run release:*` / tag pushes have never deployed anything. Don't "fix" the
workflow by pointing it at `/var/www/poe` or delete `/opt/poe` without asking Mike (see
`HANDOFF.md` open questions).

**Trap: `deploy-docker.sh` overwrites the server's `.env`** with placeholder values (including a
fake `ANTHROPIC_API_KEY`) and re-runs the seed. It's a first-time bootstrap script; never run it
against the live install.

**Trap: the production container runs the Next.js dev server.** The real `Dockerfile` is
single-stage and runs `npm run dev`, and `docker-compose.yml` sets `NODE_ENV=development`. The
multi-stage standalone `Dockerfile` and nginx-fronted compose file in `CLAUDE.md` are the
intended design, not what's in the repo.

**Trap: DB credentials are committed** in `docker-compose.yml` and the deploy scripts, and the
DB port is published publicly. Don't copy those values into docs, and don't widen the exposure.

Server access: SSH alias `hostinger-vps` in `~/.ssh/config`, key auth only. If the host has any
intrusion protection (fail2ban or similar): **never run retry loops** against it. One failed
attempt = stop, report, wait for instruction.

## 7. Versioning & Docs: Keep Them In Sync On Every Production Change

Whatever `CLAUDE.md` defines as the spec (routing, data models, design system, known gaps) must
be updated when something ships, in the same commit as the change, not as a separate
afterthought. If you skip this, the brief drifts from reality and starts actively misleading
whoever (human or agent) reads it next.

Additionally: add a file to `docs/changelog/` for every change that reaches production, no
matter how small. See `docs/changelog/README.md` for the convention and why it exists (real
release notes with actual rationale, instead of an auto-generated "PR titles" list that loses the
"why").

If you remove a feature, **remove its spec from `CLAUDE.md`**; don't leave a dead spec that a
future agent tries to rebuild. (The `docs/changelog/` entry for the change that removed it stays;
it's historical record, not a live spec.)

## Versioning

This project follows [Semantic Versioning](https://semver.org/) (SemVer): `MAJOR.MINOR.PATCH`,
tagged `vX.Y.Z`.

- **MAJOR**: incompatible/breaking API changes
- **MINOR**: new functionality, backward-compatible
- **PATCH**: backward-compatible bug fixes

Additional rules:
- Pre-1.0.0 releases (`0.y.z`) are considered unstable; anything may change at any time
- Pre-release versions may append a hyphen and identifiers, e.g. `1.0.0-alpha.1`, `1.0.0-rc.2`
- Build metadata may be appended with a plus sign, e.g. `1.0.0+20130313144700` (ignored when determining version precedence)
- Once a version is released, its contents must not change; a new version number must be issued for any modification

**When making changes, agents should:**
- Bump PATCH for bug fixes with no API changes
- Bump MINOR for new backward-compatible features, and reset PATCH to 0
- Bump MAJOR for breaking changes, and reset MINOR and PATCH to 0
- Never decrease a version number or reuse a previous version for different content

Note: `package.json` says `0.1.1` although the latest tag is `v1.0.0` (the `v1.0.0` tag was not
made by `scripts/release.js`, which bumps from `package.json`). Running `npm run release:patch`
today would create `v0.1.2`, a *lower* version. Set `package.json` to `1.0.0` first (ask Mike).

## 8. Follow Established Conventions: Don't Invent Parallel Ones

If `CLAUDE.md` documents a project convention (its "Dev Conventions" and "Error Handling System"
sections: zod validation, `{ error, code }` error bodies, toasts for every API failure,
`ConfirmModal` before destructive actions), use it as documented. Before implementing your own
version of something that feels like it should already exist, search for whether it already
does; a duplicated, slightly-different parallel implementation of an existing pattern is a common
and avoidable source of bugs.

If no such convention is documented but you can tell one implicitly exists (the same pattern
shows up in multiple places, unlabeled), follow the existing pattern and consider flagging that
it should be written down in the brief.

## 9. Self-Check Before You Stop

- [ ] **Did I update `HANDOFF.md`** (state, in progress, next steps, open questions, blockers)?
- [ ] Is this change on a branch, not committed directly to `main`?
- [ ] Did I find where the feature is actually rendered/executed (not just a similarly-named file)?
- [ ] Did I update all callers if I changed an API/interface shape?
- [ ] Did I run `npm run lint` + `npm run typecheck` (not just `build`) with zero errors?
- [ ] Did I update `CLAUDE.md` + add a `docs/changelog/` entry if this reaches production?
- [ ] Did I reuse an existing established convention instead of inventing a parallel one?
- [ ] If deployed, did I deploy to `/var/www/poe` (not `/opt/poe`) without retry loops?

## 10. Fleet Registration

This repo is part of Mike's app fleet, tracked by the Command dashboard. It must contain an
`app.yaml` at the repo root (schema: Command's `PROJECT.md`, `~/Documents/apps overview/`), and
every container it runs must carry the label `command.app=poe`, plus
`org.opencontainers.image.revision=<git sha>` at build time. Any change to this app's domains,
services, ports, dependencies, or deploy path updates `app.yaml` **in the same commit**. That's
what keeps Command accurate without hand edits.

---

## Appendix A: `docs/changelog/`

See `docs/changelog/README.md`.

## Appendix B: Pattern For Documenting a Retired System/Feature

If a significant subsystem is retired (an old pipeline, a deprecated integration, an abandoned
architecture direction) and orphaned files/docs still reference it, don't just delete all trace
of it silently; a future agent will rediscover the orphaned pieces and waste time
reverse-engineering what they were for. Add a clearly-labeled, clearly-dated note (here, or in
its own file if long) with:

1. **One line stating it's retired, when, and per whom**, so nobody mistakes this for live spec.
2. **A short description of how it used to work**, just enough that an orphaned file's imports
   or an old commit message makes sense.
3. **A list of known orphaned remnants**: file paths, and whether they're harmless (immutable
   history like a DB migration) or actually dangerous (dead code that would error or silently
   misbehave if someone re-wired it in).
4. **An explicit instruction**: treat it as removed, not as a target to restore, unless Mike
   explicitly asks to bring it back.

Then, separately, fix the drift this created in `CLAUDE.md` (remove it from routing, data
models, known-gaps tables). The note above is a stopgap for what's *already* orphaned in code,
not a substitute for keeping the live docs accurate.
