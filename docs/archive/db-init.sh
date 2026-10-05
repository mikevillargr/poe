#!/bin/bash

# Database Initialization Script
# This script sets up a local PostgreSQL database for development

set -e

echo "🚀 Initializing Poe Database..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed${NC}"
    echo "Please install PostgreSQL first:"
    echo "  macOS: brew install postgresql@16"
    echo "  Ubuntu: sudo apt install postgresql"
    exit 1
fi

echo -e "${GREEN}✓${NC} PostgreSQL found"

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}⚠${NC}  .env.local not found, creating from .env.example..."
    cp .env.example .env.local
    echo -e "${GREEN}✓${NC} Created .env.local"
    echo -e "${YELLOW}⚠${NC}  Please edit .env.local with your database credentials"
fi

# Database configuration
DB_NAME="poe_db"
DB_USER="poe_user"
DB_PASSWORD="poe_dev_password"

echo ""
echo "Creating database: $DB_NAME"
echo "Creating user: $DB_USER"
echo ""

# Create database and user
psql -U postgres <<EOF
-- Create user if not exists
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
    CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE $DB_NAME'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

# Connect to the database and grant schema permissions
psql -U postgres -d $DB_NAME <<EOF
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

echo -e "${GREEN}✓${NC} Database created successfully"
echo ""

# Update .env.local with database URL
DB_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
if grep -q "^DATABASE_URL=" .env.local; then
    # Update existing DATABASE_URL
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$DB_URL|" .env.local
    else
        # Linux
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DB_URL|" .env.local
    fi
    echo -e "${GREEN}✓${NC} Updated DATABASE_URL in .env.local"
else
    # Add DATABASE_URL
    echo "DATABASE_URL=$DB_URL" >> .env.local
    echo -e "${GREEN}✓${NC} Added DATABASE_URL to .env.local"
fi

echo ""
echo "Next steps:"
echo "  1. Run migrations: npm run db:push"
echo "  2. Seed database: npm run db:seed"
echo "  3. Start dev server: npm run dev"
echo ""
echo -e "${GREEN}✅ Database initialization complete!${NC}"
