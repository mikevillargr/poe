#!/bin/bash

# Docker deployment script for VPS
# This uses the EXACT same code as local with Node 20+ via Docker

set -e

VPS_IP="76.13.191.149"
VPS_USER="root"
APP_DIR="/var/www/poe"

echo "🐳 Deploying Poe to VPS with Docker..."

# Deploy to VPS
ssh $VPS_USER@$VPS_IP bash << 'ENDSSH'
set -e

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl start docker
    systemctl enable docker
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Create app directory
mkdir -p /var/www/poe
cd /var/www/poe

# Clone/update repository
if [ -d ".git" ]; then
    echo "Updating repository..."
    git fetch origin
    git checkout main
    git pull origin main
else
    echo "Cloning repository..."
    git clone https://github.com/mikevillargr/poe.git .
fi

# Create .env file
cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://poeuser:poe_secure_password_2026@db:5432/poe
DB_USER=poeuser
DB_PASSWORD=poe_secure_password_2026

# App
ANTHROPIC_API_KEY=sk-ant-api03-placeholder
NEXTAUTH_URL=http://76.13.191.149:3001
NEXT_PUBLIC_APP_URL=http://76.13.191.149:3001
NEXTAUTH_SECRET=your-secret-key-here
NODE_ENV=production
PORT=3001
EOF

# Stop existing containers
echo "Stopping existing containers..."
docker-compose down || true

# Build and start
echo "Building and starting containers..."
docker-compose up -d --build

# Wait for database
echo "Waiting for database..."
sleep 10

# Run migrations
echo "Running database migrations..."
docker-compose exec -T app npm run db:push

# Seed database
echo "Seeding database..."
docker-compose exec -T app npm run db:seed:prod

echo "✅ Deployment complete!"
echo ""
echo "Application running at: http://76.13.191.149:3001"
echo "Database: PostgreSQL on port 5432"
echo ""
echo "Useful commands:"
echo "  docker-compose logs -f app    # View app logs"
echo "  docker-compose logs -f db     # View database logs"
echo "  docker-compose restart app    # Restart app"
echo "  docker-compose down           # Stop all containers"
ENDSSH

echo ""
echo "🎉 Deployment complete!"
echo "Visit: http://76.13.191.149:3001"
