#!/bin/bash

# Development script for Ottoneu Viewer Extension

set -e

echo "🔧 Setting up development environment for Ottoneu Viewer Extension"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16 or later."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ Node.js $(node --version) detected"
echo "✅ npm $(npm --version) detected"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Build the extension
echo "🏗️  Building extension..."
npm run build

echo "📋 Next steps:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' in the top right"
echo "3. Click 'Load unpacked' and select the 'dist/' folder"
echo "4. For development, run 'npm run dev' to watch for changes"

echo ""
echo "🎉 Setup complete! Extension is ready to load."