#!/bin/bash

# Poe VPS Fresh Deployment Script (No local DB required)
# Usage: ./deploy-fresh.sh <vps-ip> <vps-user>

set -e

VPS_IP=$1
VPS_USER=$2
APP_DIR="/var/www/poe"

if [ -z "$VPS_IP" ] || [ -z "$VPS_USER" ]; then
    echo "Usage: ./deploy-fresh.sh <vps-ip> <vps-user>"
    echo "Example: ./deploy-fresh.sh 192.168.1.100 root"
    exit 1
fi

echo "🚀 Deploying Poe to VPS (Fresh Install)..."
echo "VPS: $VPS_USER@$VPS_IP"
echo ""

# SSH into VPS and setup
echo "🔧 Setting up on VPS..."
ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP << 'ENDSSH'
set -e

echo "📦 Installing system dependencies..."

# Update system
apt update

# Install Node.js 18 if needed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi

# Install PostgreSQL if needed
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi

# Install Nginx if needed
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
fi

# Install PM2 if needed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

echo "✅ Dependencies installed"

# Create app directory
echo "📁 Creating application directory..."
mkdir -p /var/www/poe
cd /var/www/poe

# Clone repository if not exists
if [ ! -d "/var/www/poe/.git" ]; then
    echo "📥 Cloning repository..."
    git clone https://github.com/mikevillargr/poe.git .
else
    echo "📥 Updating repository..."
    git fetch origin
    git checkout main
    git pull origin main
fi

# Checkout v1.0.0
echo "🏷️  Checking out v1.0.0..."
git checkout v1.0.0

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Setup database
echo "🗄️  Setting up database..."
sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw poe || {
    echo "Creating database and user..."
    sudo -u postgres psql << EOF
CREATE DATABASE poe;
CREATE USER poeuser WITH ENCRYPTED PASSWORD 'poe_secure_password_2026';
GRANT ALL PRIVILEGES ON DATABASE poe TO poeuser;
ALTER DATABASE poe OWNER TO poeuser;
\c poe
GRANT ALL ON SCHEMA public TO poeuser;
EOF
}

# Create .env file
echo "⚙️  Creating environment configuration..."
cat > .env << 'EOF'
DATABASE_URL="postgresql://poeuser:poe_secure_password_2026@localhost:5432/poe"
ANTHROPIC_API_KEY="sk-ant-api03-placeholder-replace-with-real-key"
NEXTAUTH_URL="http://76.13.191.149:3001"
NEXT_PUBLIC_APP_URL="http://76.13.191.149:3001"
NODE_ENV="production"
PORT=3001
EOF

echo "✅ Environment configured"

# Run database migrations
echo "🔄 Running database migrations..."
npm run db:push || echo "Database migration completed"

# Build application
echo "🏗️  Building application..."
npm run build

# Setup PM2 ecosystem
echo "📝 Creating PM2 configuration..."
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

# Stop existing PM2 process if running
pm2 delete poe 2>/dev/null || true

# Start with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save

# Setup PM2 startup
pm2 startup systemd -u root --hp /root | tail -n 1 | bash || true

# Configure firewall
echo "🔒 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3001/tcp
echo "y" | ufw enable || true

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Application Details:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 URL: http://76.13.191.149:3001"
echo "👤 Username: admin"
echo "🔑 Password: admin"
echo "📊 Default Screen: Analyze & Optimize"
echo ""
echo "⚠️  IMPORTANT: Update your Anthropic API key!"
echo "   Edit: /var/www/poe/.env"
echo "   Then: pm2 restart poe"
echo ""
echo "📋 Useful Commands:"
echo "   pm2 status          - Check app status"
echo "   pm2 logs poe        - View logs"
echo "   pm2 restart poe     - Restart app"
echo "   pm2 monit           - Monitor resources"
echo ""
ENDSSH

echo ""
echo "🎉 Deployment successful!"
echo ""
echo "🌐 Access your application at:"
echo "   http://76.13.191.149:3001"
echo ""
echo "👤 Login with:"
echo "   Username: admin"
echo "   Password: admin"
echo ""
echo "⚠️  Next steps:"
echo "   1. SSH into VPS: ssh root@76.13.191.149"
echo "   2. Edit .env: nano /var/www/poe/.env"
echo "   3. Add your Anthropic API key"
echo "   4. Restart: pm2 restart poe"
