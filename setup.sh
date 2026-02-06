#!/bin/bash

# Tacticash Arena - Quick Setup Script
# This script automates the setup process for development

set -e

echo "🎰 Tacticash Arena - Setup Script"
echo "=================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL 14+ first."
    exit 1
fi

if ! command -v redis-server &> /dev/null; then
    echo "⚠️  Redis is not installed. Installing via Homebrew..."
    brew install redis
fi

echo "✅ All prerequisites met!"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
echo "Installing frontend dependencies..."
npm install

echo "Installing backend dependencies..."
cd server
npm install
cd ..

echo "✅ Dependencies installed!"
echo ""

# Setup environment files
echo "⚙️  Setting up environment files..."

if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created frontend .env file"
else
    echo "ℹ️  Frontend .env already exists"
fi

if [ ! -f server/.env ]; then
    cp server/.env.example server/.env
    echo "✅ Created backend .env file"
    echo "⚠️  IMPORTANT: Edit server/.env and set your database credentials and secrets!"
else
    echo "ℹ️  Backend .env already exists"
fi

echo ""

# Database setup
echo "🗄️  Database Setup"
echo "Would you like to create the database now? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Creating database 'tacticash'..."

    # Try to create database
    createdb tacticash 2>/dev/null || echo "ℹ️  Database might already exist"

    echo "Running migrations..."
    psql tacticash < server/database/schema.sql

    echo "✅ Database setup complete!"
else
    echo "ℹ️  Skipping database setup. Run manually with:"
    echo "   createdb tacticash"
    echo "   psql tacticash < server/database/schema.sql"
fi

echo ""

# Start Redis
echo "🔴 Starting Redis..."
brew services start redis || echo "ℹ️  Redis might already be running"

echo ""
echo "=================================="
echo "✅ Setup Complete!"
echo "=================================="
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Edit server/.env with your database credentials and secrets:"
echo "   - DB_PASSWORD"
echo "   - JWT_SECRET (generate a random string)"
echo "   - JWT_REFRESH_SECRET (generate a random string)"
echo "   - SERVER_SEED_SECRET (generate a random string)"
echo ""
echo "2. Start the servers:"
echo "   Terminal 1: cd server && npm run dev"
echo "   Terminal 2: npm run dev"
echo ""
echo "3. Open http://localhost:5173 in your browser"
echo ""
echo "📖 For more information, see:"
echo "   - README.md"
echo "   - IMPLEMENTATION_GUIDE.md"
echo ""
echo "Happy gaming! 🎲🎰"
