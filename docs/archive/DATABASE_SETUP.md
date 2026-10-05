# Database Setup Guide

This guide covers setting up PostgreSQL for the Poe application in both development and production environments.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Production VPS Setup](#production-vps-setup)
- [Database Migrations](#database-migrations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- PostgreSQL 14+ installed
- Node.js 18+ installed
- Access to your VPS (for production)

## Local Development Setup

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database and User

```bash
# Access PostgreSQL as postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE poe_db;
CREATE USER poe_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE poe_db TO poe_user;

# Grant schema permissions
\c poe_db
GRANT ALL ON SCHEMA public TO poe_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO poe_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO poe_user;

# Exit
\q
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your database credentials:
```env
DATABASE_URL=postgresql://poe_user:your_secure_password@localhost:5432/poe_db
```

### 4. Run Migrations

```bash
# Generate migration files from schema
npm run db:generate

# Push schema to database
npm run db:push

# Or run full setup (generate + push + seed)
npm run db:setup
```

### 5. Verify Setup

```bash
# Open Drizzle Studio to view your database
npm run db:studio
```

Visit `https://local.drizzle.studio` to see your database tables.

## Production VPS Setup

### 1. Install PostgreSQL on VPS

SSH into your VPS:
```bash
ssh user@your-vps-ip
```

Install PostgreSQL:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Secure PostgreSQL

Edit PostgreSQL configuration:
```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Set listen addresses:
```conf
listen_addresses = 'localhost'  # Only allow local connections
```

Edit authentication:
```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Add:
```conf
local   all             poe_user                                md5
host    all             poe_user        127.0.0.1/32            md5
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### 3. Create Production Database

```bash
sudo -u postgres psql

CREATE DATABASE poe_production;
CREATE USER poe_user WITH ENCRYPTED PASSWORD 'STRONG_RANDOM_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE poe_production TO poe_user;

\c poe_production
GRANT ALL ON SCHEMA public TO poe_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO poe_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO poe_user;

\q
```

### 4. Configure Production Environment

Create `.env.production` on your VPS:
```env
DATABASE_URL=postgresql://poe_user:STRONG_RANDOM_PASSWORD@localhost:5432/poe_production
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
ANTHROPIC_API_KEY=your_production_api_key
```

### 5. Run Production Migrations

```bash
# On your VPS, in the application directory
npm run db:push
```

## Database Migrations

### Generate New Migration

When you modify `lib/db/schema.ts`:

```bash
# Generate migration SQL files
npm run db:generate
```

This creates migration files in the `drizzle/` directory.

### Apply Migrations

```bash
# Push schema changes to database
npm run db:push

# Or use migrate for production
npm run db:migrate
```

### View Database

```bash
# Open Drizzle Studio
npm run db:studio
```

## Database Schema

Current tables:

### `tenants`
- Multi-tenancy support
- Stores organization/company information

### `users`
- User authentication and profiles
- Links to tenants

### `guidelines`
- Uploaded guideline documents
- Metadata and source tracking

### `heuristics`
- Extracted scoring rules
- Categories: Brand, SEO, Blacklist, Agency, Client
- Weight and active status

### `score_jobs`
- Content scoring jobs
- Stores scores and suggestions

### `edit_suggestions`
- Individual edit suggestions
- Links to score jobs and heuristics

### `batch_jobs`
- Batch processing jobs
- CSV upload tracking

## Backup and Restore

### Backup Database

```bash
# Local
pg_dump -U poe_user poe_db > backup_$(date +%Y%m%d).sql

# Production
sudo -u postgres pg_dump poe_production > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
# Local
psql -U poe_user poe_db < backup_20250421.sql

# Production
sudo -u postgres psql poe_production < backup_20250421.sql
```

## Troubleshooting

### Connection Refused

Check if PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

### Authentication Failed

Verify credentials in `.env.local`:
```bash
psql -U poe_user -d poe_db -h localhost
```

### Permission Denied

Grant proper permissions:
```sql
GRANT ALL PRIVILEGES ON DATABASE poe_db TO poe_user;
GRANT ALL ON SCHEMA public TO poe_user;
```

### Migration Conflicts

Drop and recreate (DEVELOPMENT ONLY):
```bash
npm run db:drop
npm run db:push
```

### View Logs

```bash
# Ubuntu/Debian
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# macOS
tail -f /usr/local/var/log/postgresql@16.log
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `poe_db` |
| `DB_USER` | Database user | `poe_user` |
| `DB_PASSWORD` | Database password | `secure_password` |

## Security Best Practices

1. **Use strong passwords** - Generate with `openssl rand -base64 32`
2. **Limit connections** - Only allow localhost in production
3. **Regular backups** - Automate daily backups
4. **SSL/TLS** - Enable for production connections
5. **Rotate credentials** - Change passwords periodically
6. **Monitor access** - Review PostgreSQL logs regularly

## Next Steps

After database setup:
1. Run the application: `npm run dev`
2. Test database connection in the app
3. Upload a guideline document to test heuristics
4. Verify data is persisting in Drizzle Studio

For production deployment, see `docs/DEPLOYMENT.md`.
