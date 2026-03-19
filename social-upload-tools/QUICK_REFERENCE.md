#!/usr/bin/env node

/**
 * QUICK REFERENCE - Social Media Upload Tool
 * 
 * All commands are run from: /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools
 */

// ============================================
// 🚀 UPLOAD COMMANDS
// ============================================

// 1️⃣ Upload to ALL platforms (TikTok, Threads, Facebook)
node upload-all-platforms.mjs

// 2️⃣ Upload to TikTok ONLY
node upload-all-platforms.mjs tiktok

// 3️⃣ Upload to Threads ONLY  
node upload-all-platforms.mjs threads

// 4️⃣ Upload to Facebook ONLY
node upload-all-platforms.mjs facebook

// 5️⃣ Upload to multiple specific platforms
node upload-all-platforms.mjs tiktok facebook
node upload-all-platforms.mjs threads facebook
node upload-all-platforms.mjs tiktok threads

// ============================================
// ⚙️ CONFIGURATION
// ============================================

// Edit config.json to change:
// - Facebook profile ID
// - TikTok settings (comments, duets, stitches)
// - Upload timeout
// - Show/hide browser window

config.json

// ============================================
// 📊 MANAGE VIDEOS
// ============================================

// Edit videos-database.json to:
// - Add new videos
// - Set status to "ready" for upload
// - Check upload status (uploaded: true/false)

videos-database.json

// Example entry:
{
  "id": "video_001",
  "type": "video",
  "video_name": "My Video",
  "title": "Post Title",
  "description": "Post description",
  "file_path": "/absolute/path/to/video.mp4",
  "status": "ready",
  "tiktok": { "uploaded": false },
  "threads": { "uploaded": false },
  "facebook": { "uploaded": false }
}

// ============================================
// 📚 DOCUMENTATION
// ============================================

// Detailed guide
cat USAGE.md

// ============================================
// 🔑 KEY FILES
// ============================================

root/
├── config.json                      # Platform settings
├── videos-database.json             # Video list & status
├── upload-all-platforms.mjs         # Master upload script ✨
├── upload-tiktok-from-json.mjs      # TikTok uploader
├── upload-threads-from-json.mjs     # Threads uploader
├── upload-facebook-from-json.mjs    # Facebook uploader
├── video-database.mjs               # Database utilities
├── USAGE.md                         # Full documentation
└── social-tool-main/                # NestJS tool (compiled)
    ├── src/commands/
    │   ├── post-tiktok/
    │   ├── post-threads/
    │   └── post-reels-facebook/
    └── dist/                        # Compiled code

// ============================================
// 💡 WORKFLOW
// ============================================

// Step 1: Add videos to videos-database.json
// Step 2: Configure settings in config.json
// Step 3: Run upload command
// Step 4: Check database for upload status

// ============================================
// 🆘 TROUBLESHOOTING
// ============================================

// If video not uploading:
// 1. Check status = "ready" in videos-database.json
// 2. Verify file_path exists
// 3. Ensure logged into each platform
// 4. Check config.json settings
// 5. Run with show_browser: true to see what's happening

// Clear browser cache if stuck:
rm -rf social-tool-main/.user_data/Default/Cache

// Rebuild if needed:
cd social-tool-main && npm run build

// ============================================
// 📋 STATUS LEGEND
// ============================================

uploaded: true   ✅ Successfully posted
uploaded: false  ❌ Not posted yet
status: "ready"  📋 Ready for upload
status: "done"   ✔️  Processing complete

// ============================================
// 🎯 COMMON USAGE PATTERNS
// ============================================

// Upload single platform
node upload-all-platforms.mjs tiktok

// Wait for completion and check results
tail -f videos-database.json

// Reset and re-upload everything
# Edit videos-database.json, set all "uploaded": false
node upload-all-platforms.mjs

// Batch upload new videos (add to database first)
cat >> videos-database.json << 'EOF'
,{
  "id": "video_batch_1",
  "type": "video",
  "video_name": "Batch Video 1",
  ...
}
EOF
node upload-all-platforms.mjs

// ============================================
