#!/bin/bash

# Social Upload Tool - Setup Aliases
# Add these to your ~/.zshrc or ~/.bash_profile for easy access

# Path to social upload tools
SOCIAL_UPLOAD_PATH="/Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools"

# Aliases
alias social-upload-all="cd $SOCIAL_UPLOAD_PATH && node upload-all-platforms.mjs"
alias social-upload-tiktok="cd $SOCIAL_UPLOAD_PATH && node upload-all-platforms.mjs tiktok"
alias social-upload-threads="cd $SOCIAL_UPLOAD_PATH && node upload-all-platforms.mjs threads"
alias social-upload-facebook="cd $SOCIAL_UPLOAD_PATH && node upload-all-platforms.mjs facebook"
alias social-config="open $SOCIAL_UPLOAD_PATH/config.json"
alias social-database="open $SOCIAL_UPLOAD_PATH/videos-database.json"
alias social-usage="cat $SOCIAL_UPLOAD_PATH/USAGE.md | less"

# Functions
social-upload() {
  cd "$SOCIAL_UPLOAD_PATH"
  if [ $# -eq 0 ]; then
    node upload-all-platforms.mjs
  else
    node upload-all-platforms.mjs "$@"
  fi
}

# Usage: social-upload tiktok facebook

echo "✅ Social Upload aliases loaded!"
echo ""
echo "Available commands:"
echo "  social-upload-all        - Upload to all platforms"
echo "  social-upload-tiktok     - Upload to TikTok only"
echo "  social-upload-threads    - Upload to Threads only"
echo "  social-upload-facebook   - Upload to Facebook only"
echo "  social-upload <platform> - Custom upload (e.g., social-upload tiktok threads)"
echo "  social-config            - Open config.json"
echo "  social-database          - Open videos-database.json"
echo "  social-usage             - View full documentation"
