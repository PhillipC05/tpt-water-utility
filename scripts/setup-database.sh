#!/bin/bash

# Water Utility Platform - Database Setup Script
# This script helps set up PostgreSQL database for development

set -e

echo "🚀 Water Utility Platform - Database Setup"
echo "=========================================="

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "✅ Docker found. Setting up PostgreSQL with Docker..."

    # Stop any existing containers
    docker-compose down 2>/dev/null || true

    # Start PostgreSQL and Redis
    echo "📦 Starting PostgreSQL and Redis containers..."
    docker-compose up -d postgres redis

    # Wait for PostgreSQL to be ready
    echo "⏳ Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U wateruser -d water_utility &>/dev/null; then
            echo "✅ PostgreSQL is ready!"
            break
        fi
        echo "   Attempt $i/30 - waiting..."
        sleep 2
    done

    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start within 60 seconds"
        exit 1
    fi

    echo "🎉 Database setup complete!"
    echo ""
    echo "Database Details:"
    echo "  Host: localhost"
    echo "  Port: 5432"
    echo "  Database: water_utility"
    echo "  Username: wateruser"
    echo "  Password: waterpass"
    echo ""
    echo "To start the application:"
    echo "  Backend: cd backend && npm run dev"
    echo "  Frontend: cd frontend && npm start"
    echo ""
    echo "To stop the database:"
    echo "  docker-compose down"

elif command -v psql &> /dev/null; then
    echo "✅ PostgreSQL client found. Using local PostgreSQL installation..."

    # Check if PostgreSQL is running
    if ! pg_isready -h localhost -p 5432 &>/dev/null; then
        echo "❌ PostgreSQL is not running on localhost:5432"
        echo "Please start PostgreSQL service or use Docker setup"
        exit 1
    fi

    echo "✅ PostgreSQL is running"

    # Create database and user if they don't exist
    echo "📦 Setting up database and user..."

    # This would need to be run as a superuser
    echo "Please run the following commands as a PostgreSQL superuser:"
    echo ""
    echo "  CREATE USER wateruser WITH PASSWORD 'waterpass';"
    echo "  CREATE DATABASE water_utility OWNER wateruser;"
    echo "  GRANT ALL PRIVILEGES ON DATABASE water_utility TO wateruser;"
    echo ""
    echo "Or update your .env file with your existing database credentials"

else
    echo "❌ Neither Docker nor PostgreSQL client found"
    echo ""
    echo "Please install one of the following:"
    echo "  1. Docker Desktop: https://www.docker.com/products/docker-desktop"
    echo "  2. PostgreSQL: https://www.postgresql.org/download/"
    echo ""
    echo "Then run this script again"
    exit 1
fi

echo ""
echo "📝 Environment Setup:"
echo "Make sure your backend/.env file contains:"
echo ""
echo "NODE_ENV=development"
echo "PORT=5000"
echo "JWT_SECRET=your_super_secret_jwt_key_here"
echo "DB_HOST=localhost"
echo "DB_PORT=5432"
echo "DB_NAME=water_utility"
echo "DB_USER=wateruser"
echo "DB_PASS=waterpass"
echo "FRONTEND_URL=http://localhost:3000"
