# 🚀 Social Media Upload Tool - Complete Setup & Usage Guide

**Status**: ✅ Production Ready  
**Last Updated**: March 15, 2026  
**Supports**: TikTok, Threads, Facebook

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Full Commands](#full-commands)
3. [Setup Aliases (Optional)](#setup-aliases-optional)
4. [Project Structure](#project-structure)
5. [FAQ](#faq)

---

## ⚡ Quick Start

### Location
```bash
cd /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools
```

### Basic Upload Commands

**Upload to ALL platforms** (TikTok, Threads, Facebook):
```bash
node upload-all-platforms.mjs
```

**Upload to TikTok ONLY**:
```bash
node upload-all-platforms.mjs tiktok
```

**Upload to Threads ONLY**:
```bash
node upload-all-platforms.mjs threads
```

**Upload to Facebook ONLY**:
```bash
node upload-all-platforms.mjs facebook
```

**Upload to multiple platforms**:
```bash
node upload-all-platforms.mjs tiktok facebook
```

---

## 📝 Full Commands

### Master Upload Script (Recommended)

```bash
# Change to the directory
cd /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools

# Upload to all platforms (sequential)
node upload-all-platforms.mjs

# Upload to specific platform(s)
node upload-all-platforms.mjs tiktok
node upload-all-platforms.mjs threads
node upload-all-platforms.mjs facebook
node upload-all-platforms.mjs tiktok threads
node upload-all-platforms.mjs tiktok facebook
node upload-all-platforms.mjs threads facebook
```

### Individual Platform Uploads

```bash
# TikTok
node upload-tiktok-from-json.mjs

# Threads
node upload-threads-from-json.mjs

# Facebook
node upload-facebook-from-json.mjs
```

### Configuration

```bash
# Edit platform settings
nano config.json
# or
open config.json

# Edit video database
nano videos-database.json
# or
open videos-database.json
```

---

## 🎯 Setup Aliases (Optional)

To use shorter commands, add aliases to your shell:

### Option 1: Automatic Setup
```bash
cd /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools
source setup-aliases.sh
```

Then add to `~/.zshrc` or `~/.bash_profile`:
```bash
source "/Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools/setup-aliases.sh"
```

### Option 2: Manual Aliases

Add these to your `~/.zshrc` or `~/.bash_profile`:

```bash
# Social upload aliases
alias social-upload-all="cd /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools && node upload-all-platforms.mjs"
alias social-upload-tiktok="cd /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools && node upload-all-platforms.mjs tiktok"
alias social-upload-threads="cd /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools && node upload-all-platforms.mjs threads"
alias social-upload-facebook="cd /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools && node upload-all-platforms.mjs facebook"
alias social-config="open /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools/config.json"
alias social-database="open /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools/videos-database.json"
```

After adding, reload your shell:
```bash
source ~/.zshrc  # or ~/.bash_profile
```

### Then use simple commands:
```bash
social-upload-all                    # All platforms
social-upload-tiktok                 # TikTok only
social-upload-threads                # Threads only
social-upload-facebook               # Facebook only
social-config                        # Edit config
social-database                      # Edit videos
```

---

## 📁 Project Structure

```
social-upload-tools/
├── upload-all-platforms.mjs          ← Master upload script ✨ (recommended)
├── upload-tiktok-from-json.mjs       ← TikTok uploader
├── upload-threads-from-json.mjs      ← Threads uploader
├── upload-facebook-from-json.mjs     ← Facebook uploader
├── video-database.mjs                ← Database utilities
├── config.json                       ← Configuration (edit this)
├── videos-database.json              ← Video list (edit this)
├── USAGE.md                          ← Detailed documentation
├── QUICK_REFERENCE.md                ← Quick commands
├── setup-aliases.sh                  ← Optional: setup shell aliases
└── social-tool-main/                 ← NestJS upload tool (don't edit)
    ├── src/
    │   ├── commands/
    │   │   ├── post-tiktok/
    │   │   ├── post-threads/
    │   │   └── post-reels-facebook/
    │   └── utils/
    └── dist/                         ← Compiled tool
```

---

## ⚙️ Configuration (config.json)

```json
{
  "facebook": {
    "page_name": "Your Facebook Page",
    "profile_id": "YOUR_PROFILE_ID"
  },
  "tiktok": {
    "audience": "Everyone",
    "enable_comments": true,
    "enable_duet": false,
    "enable_stitch": false
  },
  "threads": {
    "enabled": true
  },
  "directories": {
    "social_tool_path": "./social-tool-main"
  },
  "settings": {
    "upload_timeout": 600,          # seconds per video
    "delay_between_videos": 0,      # seconds between uploads
    "show_browser": true,           # show/hide browser window
    "is_close_browser": false       # auto-close browser
  }
}
```

---

## 📊 Video Database (videos-database.json)

### Format
```json
[
  {
    "id": "video_001",
    "type": "video",                # "video" or "text"
    "video_name": "My Video Title",
    "title": "Post Title",
    "description": "Post description/caption",
    "file_path": "/absolute/path/to/video.mp4",
    "status": "ready",              # "ready" for upload
    "created_at": "2026-03-15T12:00:00Z",
    "tiktok": {
      "uploaded": false
    },
    "threads": {
      "uploaded": false
    },
    "facebook": {
      "uploaded": false
    }
  }
]
```

### Adding Videos

Edit `videos-database.json` and add entries:

```json
{
  "id": "my_video_001",
  "type": "video",
  "video_name": "My Video",
  "title": "Amazing Video",
  "description": "Check out this awesome video!",
  "file_path": "/Users/you/Videos/myvideo.mp4",
  "status": "ready",
  "created_at": "2026-03-15T12:00:00Z",
  "tiktok": { "uploaded": false },
  "threads": { "uploaded": false },
  "facebook": { "uploaded": false }
}
```

### Status After Upload

Once uploaded successfully:
```json
{
  "tiktok": {
    "uploaded": true,
    "uploaded_at": "2026-03-15T12:45:30.123Z",
    "video_id": "150326_124648_001"
  }
}
```

---

## 🔄 Workflow

### 1. Add Videos to Database
Edit `videos-database.json` and add your videos with `status: "ready"`

### 2. Configure Settings
Edit `config.json` with:
- Facebook profile ID
- TikTok settings (comments, duets, stitches)
- Upload timeout (if videos are large)

### 3. Run Upload
```bash
node upload-all-platforms.mjs
```

### 4. Monitor Progress
- Watch console output for real-time status
- Check `videos-database.json` after completion to see upload status

### 5. Verify Results
- Check each platform to confirm posts appeared
- See video IDs in `videos-database.json` for reference

---

## 📱 Platform Requirements

### TikTok
- Browser logged into TikTok account
- Video settings configured in `config.json`
- Supports comments/duet/stitch toggles

### Threads
- Browser logged into Threads account
- Video transcoding takes 1-5 minutes
- Can upload text-only posts (set `type: "text"`)

### Facebook
- Browser logged into Facebook account
- Need your profile ID
- Can upload to profile or page

---

## 🆘 Troubleshooting

### Video Not Uploading?

1. **Check database**:
   ```bash
   # Verify status = "ready" and uploaded = false
   cat videos-database.json
   ```

2. **Check file exists**:
   ```bash
   ls -lh "/path/to/video.mp4"
   ```

3. **Enable browser to see what's happening**:
   ```json
   // In config.json
   "show_browser": true
   ```

4. **Check login status**: Ensure you're logged into each platform in the browser

5. **Increase timeout**:
   ```json
   // In config.json
   "upload_timeout": 900  // 15 minutes
   ```

### Browser Cache Issues?

Clear browser cache:
```bash
rm -rf social-tool-main/.user_data/Default/Cache
```

### Need to Rebuild?

```bash
cd social-tool-main
npm run build
```

---

## 📊 Status Symbols

| Symbol | Meaning |
|--------|---------|
| `uploaded: true` | ✅ Successfully posted |
| `uploaded: false` | ❌ Not posted yet |
| `status: "ready"` | 📋 Ready for upload |

---

## 🎯 Common Workflows

### Upload Everything
```bash
cd /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools
node upload-all-platforms.mjs
```

### Upload TikTok Only
```bash
node upload-all-platforms.mjs tiktok
```

### Reset and Re-upload
```bash
# 1. Edit videos-database.json, change all "uploaded": false
# 2. Run:
node upload-all-platforms.mjs
```

### Watch Uploads
```bash
# In one terminal, watch the database for changes
watch -n 1 'cat videos-database.json'

# In another terminal, run upload
node upload-all-platforms.mjs
```

### Batch Upload New Videos
```bash
# 1. Add new videos to videos-database.json
# 2. Run upload:
node upload-all-platforms.mjs
```

---

## 📞 Command Summary

| Command | What it does |
|---------|-------------|
| `node upload-all-platforms.mjs` | Upload to all 3 platforms |
| `node upload-all-platforms.mjs tiktok` | TikTok only |
| `node upload-all-platforms.mjs threads` | Threads only |
| `node upload-all-platforms.mjs facebook` | Facebook only |
| `node upload-tiktok-from-json.mjs` | Direct TikTok upload |
| `node upload-threads-from-json.mjs` | Direct Threads upload |
| `node upload-facebook-from-json.mjs` | Direct Facebook upload |

---

## ✨ Features

- ✅ Automated video upload to 3 platforms
- ✅ Batch processing from JSON database
- ✅ Real-time upload progress logging
- ✅ Video status tracking
- ✅ Platform-specific settings
- ✅ Error handling and recovery
- ✅ Sequential platform uploads
- ✅ Configurable timeouts
- ✅ Browser control (show/hide)
- ✅ Detailed console output

---

## 🔐 Security Notes

- Browser cookies stored locally in `social-tool-main/.user_data/`
- Requires active browser login for each platform
- Videos processed locally (no cloud uploads)
- Config values stored in plain text (keep secure)

---

**Ready to upload? Start with**:
```bash
cd /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools
node upload-all-platforms.mjs
```

Good luck! 🚀
