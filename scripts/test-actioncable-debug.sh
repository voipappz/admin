#!/bin/bash

# Enhanced script to test ActionCable with comprehensive debugging
set -e

echo "🔍 Testing ActionCable with debug logging..."

# Function to check if server is running
check_server() {
    echo "🌐 Checking if dev server is running..."
    if curl -s http://localhost:4200 > /dev/null; then
        echo "✅ Dev server is running"
        return 0
    else
        echo "❌ Dev server is not running"
        return 1
    fi
}

# Start dev server if not running
if ! check_server; then
    echo "🚀 Starting dev server..."
    npm run dev &
    DEV_SERVER_PID=$!
    
    echo "⏳ Waiting for dev server to start..."
    npx wait-on http://localhost:4200 --timeout 30000
    
    if ! check_server; then
        echo "❌ Failed to start dev server"
        exit 1
    fi
fi

echo "🧪 Running ActionCable real connection test..."
npm run cypress:run -- --spec "cypress/e2e/actioncable-real-connection.cy.ts" --browser chrome --headed

echo "🔧 Running build to check for issues..."
npm run build

echo "🧹 Testing production build..."
npm run preview &
PREVIEW_PID=$!

sleep 5

echo "🌐 Testing production build on http://localhost:4173..."
curl -f http://localhost:4173 > /dev/null && echo "✅ Production build works" || echo "❌ Production build failed"

# Cleanup
if [ ! -z "$PREVIEW_PID" ]; then
    kill $PREVIEW_PID 2>/dev/null || true
fi

if [ ! -z "$DEV_SERVER_PID" ]; then
    kill $DEV_SERVER_PID 2>/dev/null || true
fi

echo "✅ ActionCable debug testing complete"