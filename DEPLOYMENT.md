# Poe - VPS Deployment Guide

## Prerequisites

- Ubuntu 20.04+ VPS
- Node.js 18+ installed
- PostgreSQL 14+ installed
- Nginx installed
- Domain name pointed to VPS

## Step 1: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2
```

## Step 2: Setup PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE poe;
CREATE USER poeuser WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE poe TO poeuser;
\q
```

## Step 3: Clone and Setup Application

```bash
# Create app directory
sudo mkdir -p /var/www/poe
sudo chown -R $USER:$USER /var/www/poe

# Clone repository
cd /var/www/poe
git clone https://github.com/mikevillargr/poe.git .
git checkout v1.0.0

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

## Step 4: Configure Environment Variables

Edit `/var/www/poe/.env`:

```env
# Database
DATABASE_URL="postgresql://poeuser:your_secure_password@localhost:5432/poe"

# Anthropic API
ANTHROPIC_API_KEY="your_anthropic_api_key"

# App URL
NEXTAUTH_URL="https://yourdomain.com"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"

# Node Environment
NODE_ENV="production"
```

## Step 5: Setup Database Schema

```bash
# Run migrations
npm run db:push

# Or if using Drizzle migrations:
npm run db:migrate
```

## Step 6: Build Application

```bash
# Build Next.js app
npm run build

# Test the build
npm run start
```

## Step 7: Setup PM2

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'poe',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/poe',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs
```

## Step 8: Configure Nginx

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/poe
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/poe /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Step 9: Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## Step 10: Export and Import Local Data

### On Local Machine:

```bash
# Export database
pg_dump -U postgres poe > poe_backup.sql

# Export uploaded files (if any)
tar -czf poe_uploads.tar.gz public/uploads

# Transfer to VPS
scp poe_backup.sql user@your-vps:/tmp/
scp poe_uploads.tar.gz user@your-vps:/tmp/
```

### On VPS:

```bash
# Import database
psql -U poeuser -d poe < /tmp/poe_backup.sql

# Import uploads
cd /var/www/poe
tar -xzf /tmp/poe_uploads.tar.gz

# Set permissions
sudo chown -R www-data:www-data public/uploads
```

## Step 11: Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs poe

# Check Nginx status
sudo systemctl status nginx

# Test the application
curl http://localhost:3001
curl https://yourdomain.com
```

## Login Credentials

- **Username:** admin
- **Password:** admin

**⚠️ Change these credentials in production!**

## Maintenance Commands

```bash
# View logs
pm2 logs poe

# Restart app
pm2 restart poe

# Update app
cd /var/www/poe
git pull origin main
npm install
npm run build
pm2 restart poe

# Database backup
pg_dump -U poeuser poe > backup_$(date +%Y%m%d).sql

# Monitor resources
pm2 monit
```

## Troubleshooting

### App won't start
```bash
pm2 logs poe --lines 100
```

### Database connection issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U poeuser -d poe -h localhost
```

### Nginx issues
```bash
sudo nginx -t
sudo systemctl status nginx
tail -f /var/log/nginx/error.log
```

## Security Checklist

- [ ] Change default admin password
- [ ] Setup firewall (ufw)
- [ ] Enable fail2ban
- [ ] Regular backups
- [ ] Keep system updated
- [ ] Monitor logs
- [ ] Use strong database password
- [ ] Restrict database access

## Firewall Setup

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

## Backup Strategy

```bash
# Create backup script
cat > /home/$USER/backup-poe.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/$USER/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U poeuser poe > $BACKUP_DIR/poe_db_$DATE.sql

# Compress
gzip $BACKUP_DIR/poe_db_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "poe_db_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /home/$USER/backup-poe.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/$USER/backup-poe.sh") | crontab -
```

## Support

For issues, check:
1. PM2 logs: `pm2 logs poe`
2. Nginx logs: `/var/log/nginx/error.log`
3. Database logs: `/var/log/postgresql/`

---

**Deployment Version:** v1.0.0  
**Last Updated:** April 21, 2026
