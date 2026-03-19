#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Ensure dependencies are installed and UI scripts are built
echo "🔄 Checking main social tool builder..."
cd "social-upload-tools/social-tool-main"
npm install --silent >/dev/null 2>&1
npm run build --silent >/dev/null 2>&1
cd "$DIR"

echo "✨ Starting exactly 1 workflow..."
node run-workflow.mjs
