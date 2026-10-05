# Poe — Initial Claude Code Bootstrap Prompt

Paste this as your first message to Claude Code after opening the project folder.

---

## Prompt

I'm building **Poe**, a multi-tenant AI content grading and scoring web app for Growth Rocket. Full spec is in `CLAUDE.md` — read it before doing anything. The UI prototype is at https://www.magicpatterns.com/c/2qmur5ajbx9funtxgnk3nr — treat those components as source of truth for layout and design.

---

### 1. Initialize Next.js 15

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

### 2. Install dependencies

```bash
npm install \
  @anthropic-ai/sdk \
  @auth/drizzle-adapter \
  @tiptap/core @tiptap/pm @tiptap/react @tiptap/starter-kit \
  @tiptap/extension-highlight @tiptap/extension-underline \
  drizzle-orm drizzle-kit \
  pg pgvector \
  mammoth \
  pdf-parse \
  zod \
  next-auth@beta \
  bcryptjs \
  @types/bcryptjs \
  @supabase/supabase-js \
  framer-motion \
  lucide-react \
  clsx tailwind-merge \
  @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs \
  @radix-ui/react-tooltip @radix-ui/react-progress @radix-ui/react-scroll-area \
  @radix-ui/react-select @radix-ui/react-switch
```

### 3. shadcn/ui

```bash
npx shadcn@latest init
npx shadcn@latest add button card dialog dropdown-menu tabs badge progress scroll-area select switch toast tooltip separator
```

### 4. `next.config.ts` — add standalone output

```typescript
const nextConfig = {
  output: 'standalone',
}
export default nextConfig
```

### 5. Copy design tokens from MagicPatterns

Create `app/globals.css` with all CSS variables from `index.css` of the MP prototype (dark + light mode via `[data-theme='light']`). Extend `tailwind.config.ts`:
- Colors: `accent #E8450A`, `success #276749`, `warning #92400E`, `danger #9B2C2C`
- Badge colors: brand/seo/blacklist/agency/client
- Font families: mono (JetBrains Mono), display (Playfair Display)
- Box shadows: glow-accent, glow-success, glow-warning, glow-danger
- `.glass-card` and `.dashed-border-animated` utility classes

### 6. Port MagicPatterns components

Port directly from the MP prototype:

- `components/ScoreGauge.tsx` — as-is
- `components/CategoryBadge.tsx` — as-is
- `components/ThemeProvider.tsx` — change default to `'light'`
- `components/Sidebar.tsx` — replace react-router NavLink with Next.js `Link` + `usePathname()`

### 7. Authentication — Login Page

**Credentials-only (username + password)**. No OAuth, no sign-up.

**`app/(auth)/login/page.tsx`** — full-screen centered layout:
- `glass-card` max-w-`400px` centered on `bg-background`
- Feather icon (accent) + "Poe" in Playfair Display italic
- Subtitle: "Growth Rocket Content Intelligence" muted text
- Username input + Password input (with show/hide toggle using Eye/EyeOff icons)
- "Sign In" button full-width accent
- Error inline message below button (red, `text-danger text-sm`) — shown when credentials fail
- No theme toggle on this screen, no forgot password link

**`app/api/auth/[...nextauth]/route.ts`** — CredentialsProvider:
```typescript
CredentialsProvider({
  credentials: { username, password },
  async authorize(credentials) {
    const user = await db.query.users.findFirst({
      where: eq(users.username, credentials.username)
    })
    if (!user) return null
    const valid = await bcrypt.compare(credentials.password, user.passwordHash)
    return valid ? { id: user.id, name: user.name, username: user.username } : null
  }
})
```

**`app/(app)/layout.tsx`** — server component that redirects to `/login` if no session:
```typescript
const session = await getServerSession()
if (!session) redirect('/login')
```

### 8. Error Handling System

Build the full feedback system as specified in `CLAUDE.md`. Create:

**`hooks/useToast.ts`** — Zustand store with `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()` methods and a `toasts` array.

**`components/feedback/Toast.tsx`** — single toast card:
- `.glass-card` with `3px` left border colored by severity
- Icon: CheckCircle2 (success) | AlertCircle (error) | AlertTriangle (warning) | Info (info)
- Title (heading text) + optional subtitle (muted text)
- X dismiss button
- Auto-dismiss progress bar draining at bottom for timed toasts
- Framer motion: slide in from right `translateX(100% → 0)` + fade

**`components/feedback/ToastContainer.tsx`** — fixed `bottom-6 right-6 z-50`, max 5 toasts, `8px` gap, AnimatePresence

**`components/feedback/ErrorBanner.tsx`** — full-width blocking error:
- `bg-danger/10 border-b border-danger/30` strip
- AlertCircle + message + optional action link + dismiss

**`components/feedback/ConfirmModal.tsx`** — destructive action confirmation:
- Same spring-animated modal as Guidelines ingestion
- Props: `title`, `message`, `confirmLabel`, `confirmVariant: 'danger'|'warning'`, `onConfirm`, `onCancel`
- Never auto-closes

**`components/feedback/PageErrorBoundary.tsx`** — React error boundary per page showing a centered "Something went wrong" recovery card.

Wire toasts to all API failures (see error state map in `CLAUDE.md`).

### 9. Page files — port from MagicPatterns

**`app/(app)/page.tsx`** → port `pages/Dashboard.tsx`

**`app/(app)/analyze/page.tsx`** → port `pages/ScoreContent.tsx`
- Batch is embedded as a panel, not a separate route

**`app/(app)/guidelines/page.tsx`** → port `pages/Guidelines.tsx`
- Wire the category filter tabs to actually filter rows

**`app/(app)/settings/page.tsx`** → stub "coming soon"

**Fix these gaps during porting:**
- Re-prompt inline textarea on each suggestion card
- Full 5-dimension breakdown in score summary right panel
- Category filter logic in Guidelines heuristic table

### 10. API route stubs

```
app/api/score/route.ts              POST streaming SSE
app/api/guidelines/ingest/route.ts  POST
app/api/guidelines/[id]/route.ts    GET/PATCH/DELETE
app/api/batch/route.ts              POST
app/api/content/parse/route.ts      POST
```

All return `{ ok: true }` stubs with correct zod-validated request shapes.

### 11. Drizzle schema (`lib/db/schema.ts`)

Tables:
- `tenants` — id, name, slug, logoUrl, settings jsonb, createdAt
- `users` — id, username, passwordHash, name, createdAt
- `tenant_memberships` — tenantId, userId, role: admin|editor|viewer
- `guidelines` — id, tenantId, filename, rawText, createdAt
- `heuristics` — id, tenantId, sourceGuidelineId, category, rule, weight, active, createdAt, updatedAt
- `score_jobs` — id, tenantId, contentText, contentSource, sourceRef, status, overallScore, dimensionScores jsonb, batchJobId, createdAt
- `edit_suggestions` — id, jobId, heuristicId, type, originalText, suggestedText, charStart, charEnd, reason, severity, status, userModifiedText
- `batch_jobs` — id, tenantId, status, totalItems, completedItems, createdAt
- `batch_job_items` — id, batchJobId, type, ref, status, scoreJobId, errorMsg

### 12. Docker setup

Create these files exactly as specified in `CLAUDE.md`:
- `Dockerfile` (multi-stage, standalone output)
- `docker-compose.yml` (app + db/pgvector + nginx)
- `docker/nginx.conf` (reverse proxy with SSL)
- `.env.example`

### 13. GitHub Actions

Create these two workflows exactly as specified in `CLAUDE.md`:
- `.github/workflows/ci.yml` — lint + typecheck on PRs
- `.github/workflows/deploy.yml` — Docker build + push + VPS SSH deploy on main push

### 14. `.env.local.example`

```env
ANTHROPIC_API_KEY=
DATABASE_URL=postgresql://localhost:5432/poe
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
SUPABASE_URL=
SUPABASE_ANON_KEY=
DB_USER=poe
DB_PASSWORD=
```

---

After scaffolding, show me:
1. File tree summary
2. Which MP gaps were implemented vs stubbed
3. Any dependency or import issues
4. What needs my input before wiring the AI pipeline
