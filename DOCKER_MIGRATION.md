# Docker Migration Summary

## What Changed

### Before (PM2 Deployment)
- ❌ Node 18 (incompatible with JSDOM)
- ❌ Manual PostgreSQL setup on port 5433
- ❌ PM2 process management
- ❌ Manual dependency management
- ❌ Environment inconsistencies

### After (Docker Deployment)
- ✅ Node 20 (JSDOM + Readability work perfectly)
- ✅ PostgreSQL 16 with pgvector in Docker
- ✅ Docker Compose orchestration
- ✅ Reproducible environment
- ✅ Identical local and production setup

## Cleanup Performed

### Removed/Disabled:
1. **PM2 processes** - All stopped and deleted
2. **PM2 startup script** - Removed from systemd
3. **Old PostgreSQL** - Disabled (was on port 5433)
4. **PM2 logs** - Cleared

### Still Active (Docker):
- **App**: Port 3001 (Docker container)
- **Database**: Port 5432 (Docker container)
- **Nginx**: Port 8080 (Docker container - optional)

## Current Architecture

```
┌─────────────────────────────────────┐
│         VPS (76.13.191.149)         │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Docker Network (poe)       │  │
│  │                              │  │
│  │  ┌────────────────────────┐  │  │
│  │  │  poe-app-1             │  │  │
│  │  │  Node 20 + Next.js     │  │  │
│  │  │  Port: 3001            │  │  │
│  │  └────────────────────────┘  │  │
│  │           ↓                  │  │
│  │  ┌────────────────────────┐  │  │
│  │  │  poe-db-1              │  │  │
│  │  │  PostgreSQL 16         │  │  │
│  │  │  Port: 5432            │  │  │
│  │  └────────────────────────┘  │  │
│  └──────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

## Deployment Commands

### Deploy/Update
```bash
./deploy-docker.sh
```

### Manual Operations
```bash
# SSH to VPS
ssh root@76.13.191.149

# View logs
cd /var/www/poe
docker-compose logs -f app
docker-compose logs -f db

# Restart services
docker-compose restart app
docker-compose restart db

# Stop everything
docker-compose down

# Start everything
docker-compose up -d

# Rebuild and restart
docker-compose up -d --build

# Run migrations
docker-compose exec -T app npm run db:push

# Seed database
docker-compose exec -T app npx tsx scripts/seed-production.ts

# Access database
docker-compose exec db psql -U poeuser -d poe
```

## Environment Variables

Located in `/var/www/poe/.env` on VPS:

```env
DATABASE_URL=postgresql://poeuser:poe_secure_password_2026@db:5432/poe
ANTHROPIC_API_KEY=sk-ant-api03-placeholder
NEXTAUTH_URL=http://76.13.191.149:3001
NEXT_PUBLIC_APP_URL=http://76.13.191.149:3001
NODE_ENV=development
PORT=3001
```

## Data Persistence

- **Database data**: Stored in Docker volume `poe_pgdata`
- **Survives container restarts**: Yes
- **Backup command**: 
  ```bash
  docker-compose exec db pg_dump -U poeuser poe > backup.sql
  ```
- **Restore command**:
  ```bash
  docker-compose exec -T db psql -U poeuser -d poe < backup.sql
  ```

## Troubleshooting

### App won't start
```bash
docker-compose logs app
docker-compose restart app
```

### Database connection issues
```bash
# Check database is healthy
docker-compose ps

# Check database logs
docker-compose logs db

# Restart database
docker-compose restart db
```

### Port conflicts
```bash
# Check what's using ports
netstat -tulpn | grep -E ':(3001|5432)'

# If PM2 is still running
pm2 stop all
pm2 delete all
```

### Fresh start
```bash
# WARNING: This deletes all data!
docker-compose down -v
docker-compose up -d
docker-compose exec -T app npm run db:push
docker-compose exec -T app npx tsx scripts/seed-production.ts
```

## Files to Keep

- `/var/www/poe/` - Application code (managed by git)
- `docker-compose.yml` - Service orchestration
- `.env` - Environment variables
- `Dockerfile` - Container definition

## Files Removed/Unused

- `~/.pm2/` - PM2 configuration (no longer needed)
- `/etc/systemd/system/pm2-*.service` - PM2 startup scripts
- Old PostgreSQL data on port 5433 (if you want to remove it completely)

## Benefits of Docker Setup

1. **Consistency** - Same environment everywhere
2. **Isolation** - No conflicts with system packages
3. **Portability** - Easy to move to different servers
4. **Rollback** - Easy to revert to previous versions
5. **Scalability** - Can add more services easily
6. **Development** - Same setup for local dev

## Next Steps

1. ✅ PM2 cleaned up
2. ✅ Docker running
3. ✅ Database migrated
4. ✅ Application working
5. 🔄 Monitor for 24 hours
6. 📝 Update DNS/SSL if needed
7. 🔒 Set real Anthropic API key in settings UI
