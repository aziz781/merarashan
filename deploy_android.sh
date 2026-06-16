#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🔄 Pulling latest changes from Git..."
git pull

echo "📦 Building the project..."
npm run build

echo "⚡ Syncing Capacitor with Android..."
npx cap sync android

echo "🚀 Running the app on Android..."
npx cap run android

echo "✅ Done!"
