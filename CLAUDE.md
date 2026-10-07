# Poe — AI-powered Content Hub
## Claude Code Project Guide

**Poe** is Growth Rocket's internal, multi-client content hub. The content team takes an article from a
client-approved content calendar through **research**, **AI generation** and **human-in-the-loop editing**, with
the **SEO keywords handed down by the SEO team at the centre** of every draft. It replaced the original
scoring-only app (retired 2026-10-05; see `docs/archive/README.md`).

- **Production:** https://poe.vill.ar (Hostinger VPS, Docker Compose: Caddy TLS + app + Postgres).
- **Repo:** https://github.com/mikevillargr/poe
- **Stack:** Next.js 15 (App Router) · TypeScript (strict) · Tailwind + framer-motion · TipTap · Drizzle ORM on
  PostgreSQL (pgvector image) · Auth.js (NextAuth v5 beta, Google only) · zod · zustand · SheetJS (vendored).
- **AI:** provider-agnostic layer in `lib/ai` for **Anthropic (Claude), OpenAI and Moonshot (Kimi)**. Three model
  *roles* are configured by a super admin in Settings: **generation** (writes drafts, runs the guideline check),
  **research** (live web search) and **utility** (cheap steps such as link selection; falls back to the generation model
  when unset). Keys are encrypted server-side and never reach the browser.

---

## How it works

1. **Clients.** Every client is a separate data space (guidelines, queue, articles). All approved staff see all clients;
   anyone can add one from the sidebar switcher. Every client follows the **live Universal guidelines** first, then its own
   rules; a client rule wins where they conflict, and a client can switch an individual Universal rule off (D-003).
2. **Import** (`/c/[client]/import`). Upload a CSV/XLSX/XLS content calendar with `title`, `brief`, `keywords`,
   `wordcount` (target words). Column matching, per-row validation and duplicate detection happen before rows are
   appended to the client's ordered queue. No dates: the queue order is the calendar.
3. **Client Home** (`/c/[client]`). Status cards (Queued · Draft · In Review · Done), the ordered queue (drag to
   reorder), activity feed, **New Article**. Each queued topic has a **Research** chip (on by default; DR-017) and
   rows can be selected for bulk research on/off or **Generate selected**; **Generate queued** researches the topics
   that have it on, then drafts every queued topic, 3 at a time.
4. **Article Workspace** (`/c/[client]/articles/[id]`). Brief + keywords (left) · **Research | Draft** tabs (centre) ·
   **Optimize** (right).
   - *Research* streams live web research into an editable summary, outline and numbered sources.
   - *Draft* streams the generated article into the TipTap editor (autosave, versions, DOCX/Drive export).
   - *Optimize* = keyword coverage (H1 / first 100 words / H2, density), length vs target, and **Check against
     guidelines** (AI) producing suggestions with in-text highlight, Accept / Adjust / Dismiss.
5. **Guidelines** (`/c/[client]/guidelines`). Manual-first, categorized rules (SEO, structure, readability, sourcing,
   brand, agency, client, blacklist). Import-from-document is secondary. The **blacklist** holds "sounds AI-written"
   words and patterns that generation avoids and Optimize flags. A rule applies to the whole client or to one template
   ("Applies to").
5a. **Templates** (`/c/[client]/templates`). Per-client presets (D-002): writer prompt, link steps, placeholder sources,
   hooks, checks. Create from the Standard preset, duplicate, or copy from another client; every save is a revision
   (History: diff + restore). The editor's dry run previews the prompt, link picks or a full draft without saving.
   **Client facts** (tribe keywords, CTA styles, host cities, product-page settings) feed the hooks.
6. **Admin** (super admin only): **Users** (approve/deny/disable, promote), **Universal guidelines** (agency-wide, live for every client), **Settings**
   (provider keys, test, models per role).

**Auth.** Google OAuth only. Only verified `@growth-rocket.com` accounts may sign in; they are `pending` until a super admin
(`mike@growth-rocket.com`) approves them. Account status is read from the DB on every request (approvals/disables apply
immediately). Every page and API route requires an active user.

---

## Repository map

```
app/
  (auth)/login, (auth)/pending          Google login + waiting/disabled screens
  (main)/                               sidebar layout (requirePageUser)
    c/[clientSlug]/{page,import,sources,templates(+[templateId]),guidelines,sheet-format,articles/[articleId]}
    admin/{users,universal-guidelines}, settings        super admin only
    dashboard, analyze, guidelines      redirects to / (old bookmarks)
  api/clients/[clientId]/…              articles, activity, guidelines, import, templates, articles/[id]/template,
                                        articles/generate-batch, templates/[id] (+ import, revisions, restore, dry-run),
                                        facts, inventories (+ upload),
                                        sheet-sources (+ [id], [id]/sync) (all tenant-scoped)
  api/admin/…                           users, providers (keys), model-roles, universal-guidelines
  api/content/{parse,fetch-gdoc}        file/URL/Google Doc text extraction (guideline import)
  api/health, api/auth/…
components/   shell, home, import, workspace, templates, sources, guidelines, settings, admin, editor, feedback, auth
lib/
  db/schema/*       Drizzle schema by domain (tenants = clients, heuristics = guidelines)
  auth/ api/        guards (withRoute, requireUser…), {error, code} helpers, apiFetch
  tenancy/ clients/ client lookup + creation
  articles/         repo, shared zod schemas (FROZEN contract), text helpers
  ai/               provider contract (FROZEN), providers/*, roles, secrets, SSE, mock provider
  pipeline/ prompts/ research + generation (prompt builders, persistence); research-run.ts / generation-run.ts start
                    the detached runs used by the routes and the batch
  optimize/         keyword coverage, guideline-check prompt/parse
  guidelines/       repo, schemas, categories, Universal rules, extraction; prompt.ts merges live Universal (minus the
                    client's off switches) + client rules; render.ts prints them Universal-first for every prompt
  import/           sheet parsing + column mapping (a template's own column names win); sheet-format.ts = the
                    format each import expects (Sheet format card, sample .xlsx route, /sheet-format page; DR-015)
  templates/        D-002 content templates (n8n port): pure engine (placeholders, markers, assembly, checks, hooks),
                    execute.ts (hooks → link selectors → writer → checks → one retry), run.ts (server run on the
                    generation slot; Generate uses it when articles.template_id is set), batch.ts ("Generate
                    queued": every queued topic, research first where it's on (DR-017), 3 at a time), repo/schema/facts, manage.ts (create from preset/duplicate/
                    copy, save as revision, restore, delete) + dry-run.ts + diff.ts (History), rows.ts + inputs.ts (sheet/file → queue rows
                    or link inventories; sheet-source sync); seed/ holds the 10 verbatim prompts, template
                    configs, each client's imported rules and the Google Sheet sources
  google/           service-account credential (encrypted; GOOGLE_SERVICE_ACCOUNT_JSON fallback) + read-only
                    Sheets client (self-signed JWT, no googleapis)
drizzle/            versioned migrations (never db:push against real data)
scripts/            db (migrate, baseline, fixtures, seed-universal, seed-n8n), dev (api-sweep, smokes, template-e2e, inputs-e2e, batch-e2e),
                    ai-smoke, release
docker/ Dockerfile docker-compose.yml   production stack (Caddy on 443)
```

**Conventions** (enforced in review):
- Every API route is wrapped in `withRoute` (auth + `{ error, code }` errors); tenant comes from the URL and is verified
  (`requireClient`). Validate input with zod.
- Client code calls APIs through `apiFetch` (toasts every failure; never fail silently).
- AI calls go through `lib/ai/roles` (`streamForRole`, `researchForRole`, `generateForRole`), never directly to an SDK.
- Destructive actions go through `ConfirmModal`.
- Numbers use `font-mono tabular-nums`. Framer Motion for transitions.
- **Frozen contracts** (change deliberately, update all callers): `lib/ai/types.ts`, `lib/articles/schemas.ts`, `lib/nav.ts`,
  `app/(main)/layout.tsx`.
- Schema changes: edit `lib/db/schema/*`, `npm run db:generate` (hand-write a `--custom` migration for renames), commit the
  migration. Production applies migrations automatically on deploy.
- `lib/db/schema/legacy.ts` (`content_documents`, `score_jobs`, `edit_suggestions`, `batch_*`) is retired data kept read-only.
  Dropping it needs explicit approval.

---

## Data model (tables)

`tenants` (a client) · `users` (role `super_admin|member`, status `pending|active|disabled`) · `heuristics` (a client's guidelines:
category, title, rule, weight 1–10, active, source `manual|ingested|template_copy`, sort order) · `universal_guidelines` (agency-wide,
live) · `client_universal_overrides` (a client's off switch for one Universal rule) · `guidelines` (raw ingested source documents) · `articles` (queue item and article in one row: status
`queued|draft|in_review|done`, brief, `keywords[]`, primary keyword, target word count, `research` jsonb, draft HTML, last optimize)
· `article_versions` · `article_events` (activity) · `import_batches` · `ai_provider_credentials` (encrypted keys) ·
`ai_model_roles` · `ai_usage` · D-002 templates: `content_templates` (per-client presets, soft delete) ·
`content_template_revisions` · `template_events` · `link_inventories` + `link_inventory_items` · `sheet_sources` ·
`google_credentials` (encrypted service-account key) · `user_google_drive` (a person's Drive connection for Docs export, encrypted). `articles` also has `template_id`, `template_inputs`,
`generation_meta` and `source_row_key`; `heuristics.content_template_id` scopes a guideline to one template
(`heuristics.template_id` is legacy: copies were removed by migration 0008).

---

## Design System

### CSS Variables

| Variable | Dark | Light |
|---|---|---|
| `--color-background` | `#0A0A0F` | `#FAFAF8` |
| `--color-surface` | `#111118` | `#FFFFFF` |
| `--color-surface-hover` | `#1A1A2E` | `#F1F5F9` |
| `--color-sidebar` | `#0D0D14` | `#0D0D14` |
| `--color-border` | `#1E1E2E` | `#E2E8F0` |
| `--color-heading` | `#F1F5F9` | `#111111` |
| `--color-body` | `#CBD5E1` | `#4A4A4A` |
| `--color-muted` | `#64748B` | `#94A3B8` |
| `--color-editor-bg` | `#0C0C12` | `#F5F5F0` |
| `--color-gauge-bg` | `rgba(255,255,255,0.05)` | `#E5E5E5` |
| `--color-modal-backdrop` | `rgba(0,0,0,0.8)` | `rgba(0,0,0,0.5)` |

### Tailwind Semantic Colors
- `accent` → `#E8450A`
- `success` → `#276749`
- `warning` → `#92400E`
- `danger` → `#9B2C2C`

### Category Badges
| Category | BG | Text |
|---|---|---|
| Brand | `#E8450A` | white |
| SEO | `#1E40AF` | white |
| Blacklist | `#9B2C2C` | white |
| Agency | `#276749` | white |
| Client | `#6B21A8` | white |
| Structure | `#475569` | white |
| Readability | `#0F766E` | white |
| Sourcing | `#6D28D9` | white |

### Typography
- Body: Inter | Scores/numbers: JetBrains Mono | Display: Playfair Display

### Default theme: **light** (ThemeProvider reads localStorage, falls back to `'light'`)

---

## Error Handling System

### Severity tiers and corresponding UI

| Severity | Trigger | UI Pattern | Duration |
|---|---|---|---|
| **Info** | Background ops completing, neutral status | Toast (bottom-right, accent left border) | Auto-dismiss 4s |
| **Success** | Save confirmed, score complete, heuristics saved | Toast (green left border + CheckCircle2) | Auto-dismiss 4s |
| **Warning** | Partial failure, low score, blacklist hit found | Toast (amber left border + AlertTriangle) | Auto-dismiss 8s, or manual |
| **Error — transient** | API call failed, URL fetch failed, parse error | Toast (red left border + AlertCircle) | Manual dismiss only |
| **Error — blocking** | Auth failure, session expired, DB unavailable | Inline banner (top of page, full-width) | Until resolved |
| **Error — destructive** | Data loss risk, irreversible action | Confirmation modal (not a toast) | Requires explicit confirm |

### Toast component (`components/feedback/Toast.tsx`)

```typescript
interface Toast {
  id: string
  severity: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string           // Optional subtitle
  autoDismiss?: boolean      // default: true for info/success, false for error
  dismissAfter?: number      // ms, default 4000
  action?: {
    label: string
    onClick: () => void
  }
}
```

**Visual spec:**
- Position: **currently fixed top-center** (`hooks/useToast.tsx`); the spec below says bottom-right. Moving it is a design decision (needs a DR). `z-[99999]`
- Width: `320px`
- Each toast: `.glass-card` style, `p-4`, left `3px` colored border
- Stack: up to 5 toasts, newest on top, `8px` gap between
- Entry: slide in from right (`translateX: 100% → 0`) + fade, `200ms ease-out`
- Exit: slide out right + fade, `150ms`
- Progress bar at bottom for auto-dismiss toasts (drains over duration)
- Colors match severity:
  - info: `accent` left border
  - success: `success` left border + `text-green-400` icon
  - warning: `warning` left border + `text-orange-400` icon
  - error: `danger` left border + `text-red-400` icon

**Usage:**
```typescript
import { useToast } from '@/hooks/useToast'

const { toast } = useToast()

toast.success('18 heuristics saved')
toast.error('Failed to fetch URL', 'The server returned 404. Check the URL and try again.')
toast.warning('Score below threshold', 'Content scored 54/100 — review suggestions before publishing.')
toast.info('Scoring in progress...')
```

### Inline banner (`components/feedback/ErrorBanner.tsx`)

For blocking errors that persist until resolved (session expired, lost connection, etc.).

```typescript
interface ErrorBanner {
  message: string
  action?: { label: string; href?: string; onClick?: () => void }
}
```

**Visual spec:**
- Full-width, sits between top of `<main>` and page content (not inside sidebar)
- `bg-danger/10 border-b border-danger/30 text-red-400`
- `px-6 py-3 flex items-center justify-between`
- Left: AlertCircle icon + message text
- Right: action link (e.g. "Sign in again") + optional X dismiss
- Rendered from app layout based on session/connection state

### Confirmation modal (`components/feedback/ConfirmModal.tsx`)

For destructive actions: delete heuristic, clear batch queue, remove guideline.

```typescript
interface ConfirmModal {
  title: string
  message: string
  confirmLabel: string        // e.g. "Delete heuristic"
  confirmVariant: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}
```

**Visual spec:**
- Same spring-animated modal pattern as Guidelines ingestion modal
- Max-w `480px`
- Header: icon (Trash2 or AlertTriangle in danger color) + title
- Body: message text in muted
- Footer: Cancel (ghost) + confirm button in danger/warning color
- Never auto-closes — requires explicit Cancel or Confirm

### Error state map — where toasts fire

| Action | Success toast | Error toast | Warning / confirm |
|---|---|---|---|
| New Article / Add client | "Article added to the queue" / "[Client] created" | the API error message | — |
| Import sheet | "N articles added from [file]" | "Could not read [file]", "Import failed" | rows with errors/duplicates are shown in the preview, not toasted |
| Run research / Generate draft | saved result appears in the workspace | the provider error (inline + toast), status resets | — |
| Check against guidelines | "N suggestions" / "No guideline issues found" | "Guideline check failed" | "Text not found in the draft" when a suggestion is stale |
| Save / toggle / reorder guideline | — | "Couldn't save guideline" etc. | delete goes through `ConfirmModal` |
| Save provider key / models | "[Provider] key saved" / "Models saved" | the API error message | removing a key goes through `ConfirmModal` |
| Approve / deny / disable user | "[Name] approved" etc. | "Couldn't update [name]" | deny and disable go through `ConfirmModal` |
| Delete article | — | "Delete failed" | `ConfirmModal` first |
| Sign-in rejected | — | inline on the login card: "Poe is only available to @growth-rocket.com Google accounts." | pending/disabled users see `/pending` |
| Session expired | — | `apiFetch` redirects to `/login?callbackUrl=…` | — |

### Error boundary

Wrap each page with a React error boundary that catches unexpected crashes:
```typescript
// components/feedback/PageErrorBoundary.tsx
// Shows a centered "Something went wrong" card with refresh button
// Logs error to console (and eventually to monitoring service)
```

---

## Commands

```bash
npm run dev                 # dev server on :3001 (Google sign-in is registered for :3001 and :3002 only)
npm run typecheck && npm run lint && npm test      # the real gates (next build ignores type/lint errors)
npm run db:migrate          # apply migrations (tsx scripts/db/migrate.ts) to DATABASE_URL
npm run db:generate         # new migration from schema changes
npm run db:fixtures         # local mock data (4 clients, 24 articles); refuses non-local databases
npx tsx scripts/dev/api-sweep.ts http://localhost:<port>   # every API route: 401 signed out, never 2xx for a pending user
npx tsx scripts/db/seed-n8n.ts [--dry-run]                 # n8n clients, templates, inventories, imported guidelines (idempotent)
npx tsx --env-file=.env.local scripts/dev/template-e2e.ts http://localhost:<port>   # templated generation e2e (AI_MOCK=1 server)
npx tsx --env-file=.env.local scripts/dev/inputs-e2e.ts http://localhost:<port>     # inventory upload, template import, sheet sources, Google key
npx tsx --conditions=react-server scripts/ai-smoke.ts --provider anthropic|openai|moonshot   # live provider smoke (needs keys)
```

`AI_MOCK=1` uses a deterministic mock provider (no keys needed) for development.

### Environment (see `.env.example`)
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `AUTH_GOOGLE_ID/SECRET`, `ALLOWED_EMAIL_DOMAIN`, `SUPER_ADMIN_EMAIL`,
`APP_ENCRYPTION_KEY` (encrypts provider keys; never change it once keys are stored), optional `ANTHROPIC_API_KEY` /
`OPENAI_API_KEY` / `MOONSHOT_API_KEY` env fallbacks, `AI_MOCK`, Google Docs export (DR-014): each person connects their own Drive once (`drive.file`, refresh token encrypted in `user_google_drive`); the server uploads with `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`. Needs the Drive API enabled and `<AUTH_URL>/api/google/drive/callback` in the OAuth client's redirect URIs.

## Releases and deploys

Work on a branch, open a PR (CI runs lint, typecheck and unit tests), merge. **Merging does not deploy.** To release, from a clean
up-to-date `main`:

```bash
npm run release:patch   # or :minor / :major. Bumps package.json, commits, tags vX.Y.Z, pushes
```

The tag triggers `.github/workflows/deploy.yml`: GitHub builds the app and tools images, pushes them to `ghcr.io/mikevillargr/poe`,
and the VPS pulls, backs up the database, migrates and restarts (about a minute on the server). Nothing is built on the server.
Rollback and the one-time cutover are in `docs/deploy/CUTOVER.md`. Semantic versioning; pre-1.0 notes are irrelevant now (v1.x).
