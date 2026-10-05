# Poe: AI-powered Content Hub

Growth Rocket's internal content platform: take articles from a client-approved content calendar through research, AI
generation and human-in-the-loop editing, driven by the SEO keywords the SEO team provides.

**Production:** https://poe.vill.ar (Google sign-in with a @growth-rocket.com account; new accounts wait for approval).

## What it does
- **Clients:** each client has its own guidelines, queue and articles. New clients start from the agency Universal guidelines.
- **Import** a CSV/XLSX/XLS calendar (`title`, `brief`, `keywords`, `wordcount`) into the client's ordered queue.
- **Article Workspace:** edit the brief and keywords, run live web **research**, **generate** a draft, then edit it with
  version history. The **Optimize** panel checks keyword coverage, length and the client's guidelines (including a
  "sounds AI-written" blacklist) and suggests fixes you can accept, adjust or dismiss.
- **Admin:** approve users, edit the Universal guidelines, and set the AI provider keys and models
  (Claude, OpenAI and Kimi; one model for generation and one for research).

## Develop
```bash
npm ci
cp .env.example .env.local        # set DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID/SECRET (use AI_MOCK=1 without AI keys)
npm run db:migrate && npm run db:fixtures
npm run dev                       # http://localhost:3001 (Google sign-in is registered for :3001 and :3002)
npm run typecheck && npm run lint && npm test
```

See `CLAUDE.md` for architecture and conventions, and `docs/deploy/CUTOVER.md` for deploys and rollback. Releases:
`npm run release:patch|minor|major` from a clean `main` (GitHub builds the images and deploys the tag).
