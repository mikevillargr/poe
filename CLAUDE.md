# Poe — Content Grading & Scoring App
## Claude Code Project Guide

> **UI source of truth:** https://www.magicpatterns.com/c/2qmur5ajbx9funtxgnk3nr
> **Preview:** https://project-stellar-canyon-836.magicpatterns.app
> All routing, layout, and component architecture reflects the built frontend.

---

## Project Overview

**Poe** is a multi-tenant AI-powered content grading and scoring web app for Growth Rocket. It scores content against brand guidelines, topical blacklists, SEO/AIO criteria, and custom agency/client rules.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| UI Components | shadcn/ui + Tailwind CSS |
| Animations | Framer Motion |
| Rich Text Editor | TipTap |
| Database | PostgreSQL (Drizzle ORM) |
| Vector Search | pgvector |
| AI | Anthropic Claude API (claude-sonnet-4-6, streaming) |
| File Parsing | mammoth (DOCX), pdf-parse (PDF), Google Docs API |
| Auth | NextAuth.js — **credentials provider only** (username + password, no OAuth) |
| Storage | Local filesystem (`/app/uploads` via volume mount) |
| Hosting | **VPS (Hostinger) via Docker** |
| Reverse Proxy | Nginx |
| CI/CD | **GitHub Actions → VPS via SSH (builds on server)** |

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

### Typography
- Body: Inter | Scores/numbers: JetBrains Mono | Display: Playfair Display

### Default theme: **light** (ThemeProvider reads localStorage, falls back to `'light'`)

---

## Routing

```
/login              → Login page (credentials only, no signup)
/                   → Dashboard (protected)
/analyze            → Score Content — editor + inline batch queue
/guidelines         → Heuristic Store + Guideline Ingestion
/settings           → Settings stub
/score, /batch      → redirect to /analyze
*                   → redirect to /
```

All routes except `/login` require authentication via NextAuth session.

---

## Auth — Login Page

**Credentials-only login** (username + password). No OAuth, no signup flow. Admins create accounts directly in the DB.

### Login page design (match MP aesthetic)
- Full-screen centered layout, `bg-background`
- Centered card: `glass-card` max-w `400px`, padding `32px`
- Top: Feather icon (accent, glow) + "Poe" in Playfair Display italic
- Subtitle: "Growth Rocket Content Intelligence" in muted text
- Fields: Username, Password (with show/hide toggle)
- Primary button: "Sign In" full-width accent
- Error state: inline red message below button (see Error Handling)
- No "Forgot password", no "Sign up" link — intentional (internal tool)
- Light mode default; no theme toggle on login screen

### NextAuth config
```typescript
// app/api/auth/[...nextauth]/route.ts
providers: [
  CredentialsProvider({
    credentials: {
      username: { label: 'Username', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      // Look up user in DB, verify bcrypt hash
      // Return user object or null
    }
  })
]
```

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
- Position: fixed bottom-right, `24px` from edges, `z-50`
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

| Action | Success toast | Error toast | Warning toast |
|---|---|---|---|
| Score content (single) | "Scored: [title] — [score]/100" | "Scoring failed: [reason]" | score < 60: "Low score — review suggestions" |
| Save heuristics from modal | "N heuristics saved to store" | "Failed to save heuristics" | — |
| Batch job complete | "Batch complete: N/N scored" | "N items failed — see queue" | — |
| Fetch URL | — | "Could not fetch URL: [error]" | — |
| DOCX parse | — | "Could not parse file: [filename]" | — |
| Toggle heuristic | — | "Failed to update rule" | — |
| Delete heuristic | — | "Delete failed" | shown before: confirm modal |
| Login failure | — | inline below button: "Invalid username or password" | — |
| Session expired | — | Inline banner: "Your session has expired. Sign in again." | — |

### Error boundary

Wrap each page with a React error boundary that catches unexpected crashes:
```typescript
// components/feedback/PageErrorBoundary.tsx
// Shows a centered "Something went wrong" card with refresh button
// Logs error to console (and eventually to monitoring service)
```

---

## GitHub Repository

### Repo structure
```
github.com/mikevillargr/poe
├── .github/
│   └── workflows/
│       ├── ci.yml           # Lint + typecheck on PR
│       └── deploy.yml       # Build + push Docker image + deploy to VPS on main merge
├── docker/
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml       # Local dev + production
├── .env.example
└── [Next.js app files]
```

### `.github/workflows/ci.yml`
```yaml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
```

### `.github/workflows/deploy.yml`
```yaml
name: Deploy to VPS
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to VPS via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/poe
            git pull origin main
            docker compose build
            docker compose up -d --remove-orphans
            docker image prune -f
```

### Required GitHub Secrets
```
VPS_HOST          # VPS IP or domain
VPS_USER          # SSH user (e.g. deploy)
VPS_SSH_KEY       # Private key for passwordless SSH
```

---

## Docker

### `Dockerfile`
```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Add to `next.config.ts`:
```typescript
output: 'standalone'
```

### `docker-compose.yml`
```yaml
version: '3.9'
services:
  app:
    build: .
    restart: unless-stopped
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - UPLOADS_DIR=/app/uploads
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      - db

  db:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      - POSTGRES_DB=poe
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - app

volumes:
  pgdata:
```

### `docker/nginx.conf`
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## VPS Setup (one-time)

On the Hostinger VPS (Ubuntu 22.04):

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Create app directory
mkdir -p /opt/poe
cd /opt/poe

# Create .env file with production values
nano .env

# Create deploy user with SSH key (add pub key to authorized_keys)
adduser deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
# paste GitHub Actions public key into authorized_keys

# First deploy (before GitHub Actions is set up)
docker compose pull && docker compose up -d

# SSL (Let's Encrypt)
apt install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

---

## Page Structure (Next.js)

```
poe/
├── .github/workflows/
├── docker/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx         # Login page (unauthenticated)
│   ├── (app)/
│   │   ├── layout.tsx             # Auth check + Sidebar + ThemeProvider
│   │   ├── page.tsx               # Dashboard
│   │   ├── analyze/page.tsx       # Score Content + Batch panel
│   │   ├── guidelines/page.tsx    # Heuristic Store
│   │   └── settings/page.tsx      # Settings stub
│   ├── api/
│   │   ├── auth/[...nextauth]/    # NextAuth credentials
│   │   ├── score/route.ts         # Streaming SSE scorer
│   │   ├── guidelines/
│   │   │   ├── ingest/route.ts
│   │   │   └── [id]/route.ts
│   │   ├── batch/route.ts
│   │   └── content/parse/route.ts
│   └── layout.tsx
├── components/
│   ├── feedback/
│   │   ├── Toast.tsx              # Severity-tiered toast
│   │   ├── ToastContainer.tsx     # Fixed bottom-right stack
│   │   ├── ErrorBanner.tsx        # Full-width blocking error
│   │   ├── ConfirmModal.tsx       # Destructive action confirmation
│   │   └── PageErrorBoundary.tsx  # React error boundary
│   ├── CategoryBadge.tsx
│   ├── ScoreGauge.tsx
│   ├── Sidebar.tsx
│   └── ThemeProvider.tsx
├── hooks/
│   ├── useToast.ts                # Global toast state + dispatch
│   ├── useScoreStream.ts          # SSE streaming hook
│   └── useTenant.ts
├── lib/
│   ├── ai/
│   ├── parsers/
│   └── db/
├── Dockerfile
├── docker-compose.yml
├── docker/nginx.conf
└── CLAUDE.md
```

---

## Known Gaps to Implement (from MP prototype)

| # | Gap | Location | Priority |
|---|---|---|---|
| 1 | Re-prompt inline textarea per suggestion | ScoreContent center | High |
| 2 | Blacklist/Agency/Client dimension rows | ScoreContent right panel | High |
| 3 | Category filter logic in heuristic table | Guidelines | High |
| 4 | Tenant switcher dropdown | Sidebar | High |
| 5 | Save heuristics from modal to API | Guidelines modal | High |
| 6 | `onOpenTab` from batch item into editor tab | ScoreContent tab bar | High |
| 7 | Suggestion filter tabs wired to `activeFilter` | ScoreContent center | Medium |
| 8 | Edit/Delete heuristic row wired to API | Guidelines | Medium |
| 9 | Active toggle wired to PATCH API | Guidelines | Medium |
| 10 | URL fetch + DOCX parse wired to API | ScoreContent blank canvas | High |

---

## Data Models

### Heuristic
```typescript
{ id, tenantId, category: 'brand'|'blacklist'|'seo'|'agency'|'client',
  rule, weight: number, active: boolean, sourceGuidelineId?, createdAt, updatedAt }
```

### ScoreJob
```typescript
{ id, tenantId, contentText, contentSource: 'url'|'docx'|'gdoc'|'paste'|'csv_batch',
  sourceRef?, status: 'pending'|'scoring'|'complete'|'error',
  overallScore?, dimensionScores?, suggestions?, batchJobId?, createdAt }
```

### EditSuggestion
```typescript
{ id, jobId, heuristicId, type: 'insert'|'replace'|'delete',
  originalText, suggestedText, charStart, charEnd,
  reason, severity: 'high'|'medium'|'low',
  status: 'pending'|'accepted'|'denied'|'modified', userModifiedText? }
```

---

## Scoring Prompt Output (inside `<score_result>` tags)

```json
{
  "dimensionScores": [
    { "category": "brand", "score": 82, "passCount": 5, "failCount": 1 },
    { "category": "seo", "score": 61, "passCount": 3, "failCount": 2 },
    { "category": "blacklist", "score": 100, "passCount": 4, "failCount": 0 },
    { "category": "agency", "score": 70, "passCount": 3, "failCount": 1 },
    { "category": "client", "score": 68, "passCount": 4, "failCount": 2 }
  ],
  "overallScore": 74,
  "suggestions": [
    { "heuristicId": "abc", "type": "replace",
      "originalText": "...", "suggestedText": "...",
      "charStart": 0, "charEnd": 48,
      "reason": "...", "severity": "high" }
  ]
}
```

---

## Dev Conventions

- Server actions for mutations, `ReadableStream` route handlers for SSE
- All API routes validate `tenantId` from session
- Framer Motion for all transitions — match MP patterns
- All numeric values in `font-mono tabular-nums`
- Errors return `{ error: string, code: string }`
- `zod` for all API input validation
- All destructive actions go through `ConfirmModal` before execution
- All API failures fire a toast — never fail silently

---

## Environment Variables

```env
ANTHROPIC_API_KEY=
DATABASE_URL=postgresql://localhost:5432/poe
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://your-domain.com
UPLOADS_DIR=/app/uploads
DB_USER=
DB_PASSWORD=
```

## Commands

```bash
npm run dev
npm run build
npm run db:migrate
npm run db:studio
npm run lint
npm run typecheck

# Docker local
docker compose up
docker compose down

# Prod deploy (automated via GitHub Actions on push to main)
git push origin main
```
