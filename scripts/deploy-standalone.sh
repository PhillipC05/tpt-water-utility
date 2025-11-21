#!/bin/bash

# Water Utility Platform - Standalone Deployment Script
# This script sets up the application for standalone deployment without Docker

set -e

echo "🚀 Starting Water Utility Platform Standalone Deployment"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'.' -f1 | cut -d'v' -f2)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version check passed: $(node -v)"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p backend/database
mkdir -p frontend/build
mkdir -p logs

# Backend setup
echo "🔧 Setting up backend..."
cd backend

# Install dependencies
echo "📦 Installing backend dependencies..."
npm ci --only=production

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating backend .env file..."
    cat > .env << EOF
PORT=5000
JWT_SECRET=$(openssl rand -hex 32)
DB_PATH=./database/water_utility.db
MQTT_BROKER=mqtt://localhost:1883
MQTT_TOPIC=water/utility/#
NODE_ENV=production
EOF
    echo "✅ Created .env file with secure JWT secret"
else
    echo "ℹ️  .env file already exists"
fi

# Initialize database (will create tables)
echo "🗄️  Initializing database..."
node -e "require('./src/database'); console.log('Database initialized');"

cd ..

# Frontend setup
echo "🎨 Setting up frontend..."
cd frontend

# Install dependencies
echo "📦 Installing frontend dependencies..."
npm ci

# Build frontend
echo "🔨 Building frontend..."
npm run build

cd ..

# Create systemd service file (Linux)
if command -v systemctl &> /dev/null; then
    echo "🔧 Creating systemd service..."
    cat > /tmp/water-utility.service << EOF
[Unit]
Description=Water Utility Platform Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)/backend
ExecStart=$(which node) src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    sudo mv /tmp/water-utility.service /etc/systemd/system/
    sudo systemctl daemon-reload
    echo "✅ Systemd service created. To start: sudo systemctl start water-utility"
    echo "✅ To enable on boot: sudo systemctl enable water-utility"
fi

# Create start script
echo "📜 Creating start script..."
cat > start.sh << 'EOF'
#!/bin/bash
echo "Starting Water Utility Platform..."

# Start backend in background
cd backend
npm start &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 5

# Start frontend server
cd ../frontend
npx serve -s build -l 3000 &
FRONTEND_PID=$!

echo "✅ Backend running on http://localhost:5000 (PID: $BACKEND_PID)"
echo "✅ Frontend running on http://localhost:3000 (PID: $FRONTEND_PID)"
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
EOF

chmod +x start.sh

# Create stop script
cat > stop.sh << 'EOF'
#!/bin/bash
echo "Stopping Water Utility Platform..."

# Kill all Node.js processes related to the application
pkill -f "node src/index.js" || true
pkill -f "serve -s build" || true

echo "✅ Services stopped"
EOF

chmod +x stop.sh

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Start the application: ./start.sh"
echo "2. Open http://localhost:3000 in your browser"
echo "3. Default admin credentials: Create via API or modify database directly"
echo ""
echo "🔧 Management commands:"
echo "• Start services: ./start.sh"
echo "• Stop services: ./stop.sh"
echo "• View logs: tail -f logs/*.log (if logging is enabled)"
echo ""
echo "🔒 Security notes:"
echo "• Change the JWT_SECRET in backend/.env for production"
echo "• Configure firewall rules for ports 3000 and 5000"
echo "• Set up SSL/TLS certificates for production use"
echo "• Regularly update dependencies and monitor for security updates"
