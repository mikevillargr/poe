# Quick Start Guide

Get Poe up and running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed
- Git

## Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd poe
npm install
```

### 2. Database Setup

**Option A: Automated Setup (Recommended)**

```bash
# Run the initialization script
./scripts/db-init.sh

# Push schema to database
npm run db:push

# Seed with default data
npm run db:seed
```

**Option B: Manual Setup**

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for detailed instructions.

### 3. Configure Environment

The init script creates `.env.local` automatically. Add your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

Get your API key from: https://console.anthropic.com/

### 4. Start Development Server

```bash
npm run dev
```

Visit: http://localhost:3001

### 5. Login

Default credentials (created by seed script):
- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Change this password immediately!**

## What's Next?

### Upload Guidelines
1. Navigate to **Guidelines** page
2. Click **Upload File** or paste a **Google Docs URL**
3. AI will extract heuristics automatically
4. Review and save the extracted rules

### Analyze Content
1. Go to **Analyze & Optimize** page
2. Paste content or upload a document
3. Click **Score** to analyze against your guidelines
4. Review suggestions and apply edits

### Batch Processing
1. Upload a CSV file with multiple URLs
2. System processes all content in queue
3. Download results with scores and suggestions

## Common Commands

```bash
# Development
npm run dev                 # Start dev server
npm run build              # Build for production
npm run start              # Start production server

# Database
npm run db:generate        # Generate migration files
npm run db:push            # Push schema to database
npm run db:studio          # Open database GUI
npm run db:seed            # Seed with default data
npm run db:setup           # Full setup (generate + push + seed)

# Code Quality
npm run lint               # Run ESLint
npm run typecheck          # Run TypeScript checks
```

## Project Structure

```
poe/
├── app/                   # Next.js app directory
│   ├── analyze/          # Content analysis page
│   ├── guidelines/       # Guidelines management
│   ├── api/              # API routes
│   └── settings/         # App settings
├── components/           # React components
├── lib/                  # Utilities and configs
│   ├── db/              # Database schema and connection
│   └── storage/         # In-memory storage fallback
├── scripts/             # Build and setup scripts
├── docs/                # Documentation
└── drizzle/             # Database migrations
```

## Troubleshooting

### Database Connection Error

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list                # macOS

# Verify connection
psql -U poe_user -d poe_db -h localhost
```

### Port Already in Use

```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in package.json
"dev": "next dev -p 3002"
```

### API Key Not Working

1. Check `.env.local` exists and has `ANTHROPIC_API_KEY`
2. Restart dev server after adding environment variables
3. Verify key is valid at https://console.anthropic.com/

### Migrations Failing

```bash
# Reset database (DEVELOPMENT ONLY)
npm run db:drop
npm run db:push
npm run db:seed
```

## Need Help?

- **Database Setup**: See [DATABASE_SETUP.md](./DATABASE_SETUP.md)
- **Deployment**: See [DEPLOYMENT.md](./DEPLOYMENT.md) (coming soon)
- **API Documentation**: See [API.md](./API.md) (coming soon)

## Production Deployment

For VPS deployment instructions, see [DATABASE_SETUP.md](./DATABASE_SETUP.md#production-vps-setup).

Quick checklist:
- [ ] Set up PostgreSQL on VPS
- [ ] Configure production environment variables
- [ ] Run database migrations
- [ ] Build application
- [ ] Set up reverse proxy (nginx)
- [ ] Configure SSL/TLS
- [ ] Set up automated backups
