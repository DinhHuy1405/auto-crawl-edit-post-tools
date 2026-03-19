#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "✨ Starting Automated Workflow..."
node run-workflow.mjs

echo ""
echo "Press any key to close this window..."
read -n 1 -s
