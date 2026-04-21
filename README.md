# Poe — Content Grading & Scoring App

> AI-powered content scoring for brand compliance, SEO readiness, and topical safety.

**Version:** v1.0.0 (Production Ready)  
**Repository:** https://github.com/mikevillargr/poe

## ✨ Features

- 🔐 **Authentication** - Simple login (admin/admin)
- 📝 **Analyze & Optimize** - AI-powered content analysis
- 📊 **Batch CSV Upload** - Process multiple URLs at once
- 📄 **DOCX Support** - Upload and analyze Word documents
- 🌐 **URL Fetching** - Smart content extraction from web pages
- 🤖 **AI Scoring** - Powered by Anthropic Claude
- 💡 **Suggestion Highlighting** - Click to highlight text in editor
- 📑 **Tab Management** - Work on multiple documents
- 📋 **Guidelines** - Manage scoring criteria
- ⚙️ **Settings** - Configure API keys and preferences
- 📥 **Export** - Download scored content as DOCX
- 🕐 **Version History** - Track document changes

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Set up database
npm run db:push

# Add your Anthropic API key to .env
# ANTHROPIC_API_KEY=sk-ant-api03-...

# Start development server
npm run dev
```

Visit http://localhost:3001 and login with:
- **Username:** admin
- **Password:** admin

## 🚀 VPS Deployment

### Automated Deployment

```bash
# One-command deployment
./deploy.sh <vps-ip> <vps-user>

# Example
./deploy.sh 192.168.1.100 ubuntu
```

### Manual Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete step-by-step guide.

📚 **Documentation:**
- [Deployment Guide](./DEPLOYMENT.md) - Complete VPS setup
- [Quick Start Guide](./docs/QUICK_START.md) - Local development
- [Database Setup](./docs/DATABASE_SETUP.md) - Database configuration

---

## Files

| File | Purpose |
|---|---|
| `CLAUDE.md` | Full project spec — routing, components, error handling, Docker, GitHub Actions |
| `INITIAL_PROMPT.md` | First message to Claude Code — scaffold the full project |
| `MAGICPATTERNS_PROMPT.md` | What's been built in MP + 8 extension prompts for new screens |

---

## What was added in this pass

| Feature | CLAUDE.md | INITIAL_PROMPT.md | MAGICPATTERNS_PROMPT.md |
|---|---|---|---|
| Error handling system | Full spec: 5 tiers, toast/banner/modal, error state map | Build instructions for all 4 components | Prompts 2, 3, 4 |
| Login page | Auth section: credentials-only, NextAuth config | Login page + NextAuth route + layout redirect | Prompt 1 |
| GitHub Actions | CI + deploy workflows, required secrets | Create both workflow files | — |
| Docker / VPS | Dockerfile, docker-compose, nginx.conf, VPS setup | Create all Docker files | — |
| Remaining MP gaps | Updated gaps table | Fix during porting | Prompts 5–8 |

---

## Build order

1. ✅ UI designed in MagicPatterns  
2. → Extend MP prototype using prompts in `MAGICPATTERNS_PROMPT.md` (login + toasts + confirm modal + remaining gaps)
3. → Port components to Next.js using `INITIAL_PROMPT.md`
4. → Set up GitHub repo + add secrets (see `CLAUDE.md` GitHub section)
5. → Set up VPS (see `CLAUDE.md` VPS Setup section)
6. → Wire AI pipeline
7. → Connect DB + auth
