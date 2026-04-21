#!/bin/bash

# Poe VPS Deployment Script
# Usage: ./deploy.sh <vps-ip> <vps-user>

set -e

VPS_IP=$1
VPS_USER=$2
APP_DIR="/var/www/poe"

if [ -z "$VPS_IP" ] || [ -z "$VPS_USER" ]; then
    echo "Usage: ./deploy.sh <vps-ip> <vps-user>"
    echo "Example: ./deploy.sh 192.168.1.100 ubuntu"
    exit 1
fi

echo "🚀 Deploying Poe to VPS..."
echo "VPS: $VPS_USER@$VPS_IP"
echo ""

# Step 1: Export local database
echo "📦 Exporting local database..."
pg_dump -U postgres poe > /tmp/poe_backup.sql
echo "✅ Database exported"

# Step 2: Transfer files to VPS
echo "📤 Transferring files to VPS..."
scp /tmp/poe_backup.sql $VPS_USER@$VPS_IP:/tmp/
echo "✅ Files transferred"

# Step 3: SSH into VPS and setup
echo "🔧 Setting up on VPS..."
ssh $VPS_USER@$VPS_IP << 'ENDSSH'
set -e

# Install dependencies if needed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    sudo apt install -y postgresql postgresql-contrib
fi

if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo apt install -y nginx
fi

if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Create app directory
sudo mkdir -p /var/www/poe
sudo chown -R $USER:$USER /var/www/poe

# Clone repository if not exists
if [ ! -d "/var/www/poe/.git" ]; then
    echo "Cloning repository..."
    cd /var/www/poe
    git clone https://github.com/mikevillargr/poe.git .
else
    echo "Updating repository..."
    cd /var/www/poe
    git fetch origin
    git checkout main
    git pull origin main
fi

# Checkout v1.0.0
git checkout v1.0.0

# Install dependencies
echo "Installing dependencies..."
npm install

# Setup database if needed
sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw poe || {
    echo "Creating database..."
    sudo -u postgres psql << EOF
CREATE DATABASE poe;
CREATE USER poeuser WITH ENCRYPTED PASSWORD 'poe_secure_password_2026';
GRANT ALL PRIVILEGES ON DATABASE poe TO poeuser;
EOF
}

# Import database
echo "Importing database..."
psql -U poeuser -d poe < /tmp/poe_backup.sql || echo "Database import completed with warnings"

# Create .env if not exists
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << 'EOF'
DATABASE_URL="postgresql://poeuser:poe_secure_password_2026@localhost:5432/poe"
ANTHROPIC_API_KEY="your_anthropic_api_key_here"
NEXTAUTH_URL="http://localhost:3001"
NEXT_PUBLIC_APP_URL="http://localhost:3001"
NODE_ENV="production"
EOF
    echo "⚠️  Please update .env with your actual API keys!"
fi

# Build application
echo "Building application..."
npm run build

# Setup PM2
if ! pm2 list | grep -q "poe"; then
    echo "Starting with PM2..."
    pm2 start npm --name "poe" -- start
    pm2 save
    pm2 startup | tail -n 1 | bash || true
else
    echo "Restarting with PM2..."
    pm2 restart poe
fi

echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update /var/www/poe/.env with your API keys"
echo "2. Configure Nginx (see DEPLOYMENT.md)"
echo "3. Setup SSL with certbot"
echo "4. Access at: http://$(curl -s ifconfig.me):3001"
echo ""
echo "Login credentials:"
echo "Username: admin"
echo "Password: admin"
ENDSSH

echo ""
echo "🎉 Deployment successful!"
echo "Check the VPS for next steps."
