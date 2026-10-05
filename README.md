# Poe — AI Content Intelligence Platform

> AI-powered content grading and optimization for brand compliance, SEO readiness, and editorial excellence.

**Status:** ✅ Production Ready  
**Live Demo:** http://76.13.191.149:3001  
**Repository:** https://github.com/mikevillargr/poe

---

## 🎯 Overview

Poe is a comprehensive content intelligence platform that uses AI (Anthropic Claude) to analyze, score, and optimize written content against customizable heuristics. Built for content teams, agencies, and publishers who need to maintain brand voice, SEO standards, and editorial quality at scale.

## ✨ Key Features

### � **Job Queue & Batch Processing**
- Upload CSV files with URLs for bulk content analysis
- Upload multiple DOCX files for batch scoring
- Real-time scoring status tracking
- Persistent queue across sessions

### 📝 **Smart Content Editor**
- Rich text editor with TipTap
- AI-powered suggestions with inline highlighting
- Click-to-highlight suggestion navigation
- Multi-tab document management
- Auto-save with version history
- Export to DOCX with optional score data

### 🤖 **AI-Powered Scoring**
- **6 Heuristic Dimensions:**
  - Brand Voice & Messaging
  - Call-to-Action
  - Compliance & Accuracy
  - Entity Formation Standards
  - SEO & Readability
  - Target Audience Alignment
- Overall score (0-100) + dimension breakdowns
- Actionable suggestions with severity levels
- Accept/dismiss suggestion workflow

### 🎨 **Dynamic Filters**
- Filter suggestions by heuristic category
- Filter by status (pending, accepted, dismissed)
- Filters auto-update based on active heuristics
- Persistent filter state per document

### � **Authentication & Security**
- Simple credential-based login
- Session persistence with cookies
- Protected routes with middleware
- Logout functionality

### ⚙️ **Settings & Configuration**
- Anthropic API key management
- Custom heuristics editor
- Theme toggle (light/dark)
- Persistent settings storage

---

## � Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **UI Components:** Custom components with Framer Motion
- **Editor:** TipTap (ProseMirror)
- **State:** Zustand
- **Icons:** Lucide React

### Backend
- **Runtime:** Node.js 20
- **Database:** PostgreSQL 16
- **ORM:** Drizzle ORM
- **AI:** Anthropic Claude (Haiku)
- **File Processing:** Mammoth (DOCX), Cheerio (HTML)

### Infrastructure
- **Deployment:** Docker + Docker Compose
- **Hosting:** VPS (Ubuntu)
- **Database:** PostgreSQL in Docker
- **Port:** 3001

---

## 📦 Quick Start

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/mikevillargr/poe.git
cd poe

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Add your Anthropic API key to .env:
# ANTHROPIC_API_KEY=sk-ant-api03-...

# 4. Set up database
npm run db:push

# 5. Start development server
npm run dev
```

Visit **http://localhost:3001** and login with:
- **Username:** `admin`
- **Password:** `admin`

### Production-mode smoke test (Docker, local)

See the header of `docker-compose.local.yml` (isolated project, no TLS, app on 127.0.0.1).

---

## 🌐 Production Deployment

Production is https://poe.vill.ar on `hostinger-vps` (`/var/www/poe`): the `app`, `db` and `caddy`
services in `docker-compose.yml`, with secrets in the server's `.env` (see `.env.example`, "PRODUCTION").

- **First cutover / rollback:** `docs/deploy/CUTOVER.md`
- **Releases:** `npm run release:patch|minor|major` from a clean `main` pushes a `vX.Y.Z` tag;
  `.github/workflows/deploy.yml` then backs up the DB, builds, runs migrations
  (`docker compose run --rm migrate`), restarts and health-checks.
- Don't run `docker-compose up -d --build` by hand on the server; it skips the backup and migrations.

---

## 📁 Project Structure

```
poe/
├── app/
│   ├── (auth)/              # Auth route group (no sidebar)
│   │   └── login/           # Login page
│   ├── (main)/              # Main app route group (with sidebar)
│   │   ├── analyze/         # Content editor & analysis
│   │   ├── dashboard/       # Job queue & batch uploads
│   │   ├── guidelines/      # Heuristics management
│   │   └── settings/        # App settings
│   ├── api/                 # API routes
│   │   ├── documents/       # Document CRUD
│   │   ├── score/           # AI scoring endpoint
│   │   └── settings/        # Settings API
│   └── globals.css          # Global styles
├── components/              # Reusable components
│   ├── editor/              # Rich text editor
│   ├── Sidebar.tsx          # Navigation sidebar
│   └── AppProviders.tsx     # Context providers
├── lib/
│   ├── db/                  # Database schema & client
│   └── ai/                  # AI scoring logic
├── stores/                  # Zustand state stores
├── docker-compose.yml       # Docker orchestration
├── Dockerfile               # App container config
└── .dockerignore            # Docker build exclusions
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-...

# Database (auto-configured in Docker)
DATABASE_URL=postgresql://poeuser:poepass@db:5432/poe
```

### Database Schema

- **content_documents** - Stored documents with scores
- **score_jobs** - Scoring history with suggestions
- **heuristics** - Scoring rules and criteria
- **settings** - App configuration

---

## 🐛 Troubleshooting

### Issue: Suggestions disappear on refresh
**Fixed:** Suggestions now persist to localStorage via tab state management.

### Issue: Filters don't reflect active heuristics
**Fixed:** Filters are now dynamically generated from database heuristics.

### Issue: Sidebar shows on login page
**Fixed:** Route groups separate auth layout (no sidebar) from main layout.

### Issue: Docker changes not picked up
**Solution:** Use `docker-compose up -d --build` (not just `restart`)

### Issue: Module not found errors
**Solution:** Ensure `.dockerignore` excludes `node_modules` and `.next`

---

## 📝 Default Credentials

- **Username:** `admin`
- **Password:** `admin`

⚠️ **Change these in production!**

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 🙏 Acknowledgments

- **AI:** Anthropic Claude
- **Framework:** Next.js by Vercel
- **Editor:** TipTap
- **Database:** PostgreSQL
- **Deployment:** Docker

---

**Built with ❤️ for Growth Rocket**
