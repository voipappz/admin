#!/bin/bash

# Script to test ActionCable locally using CircleCI CLI
# This simulates the CI environment to catch ActionCable initialization errors

set -e

echo "🔧 Setting up local CircleCI test for ActionCable..."

# Check if CircleCI CLI is available
if ! command -v circleci &> /dev/null; then
    echo "❌ CircleCI CLI not found. Install with: brew install circleci"
    exit 1
fi

# Validate CircleCI config
echo "📋 Validating CircleCI config..."
circleci config validate .circleci/config.yml

# Run specific job locally to test ActionCable functionality
echo "🚀 Running test-cypress job locally..."
circleci local execute --job test-cypress

# Run the ActionCable error handling test specifically
echo "🧪 Running ActionCable error handling tests..."
npm run cypress:run -- --spec "cypress/e2e/actioncable-error-handling.cy.ts"

echo "✅ ActionCable local testing complete"