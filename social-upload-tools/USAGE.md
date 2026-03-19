# Social Media Upload Tool

Automated video upload tool for **TikTok**, **Threads**, and **Facebook** using Playwright browser automation.

## 📦 What's Included

- **social-tool-main/** - NestJS CLI tool with Playwright automation
- **upload-tiktok-from-json.mjs** - TikTok upload script
- **upload-threads-from-json.mjs** - Threads upload script
- **upload-facebook-from-json.mjs** - Facebook upload script
- **upload-all-platforms.mjs** - Master script to upload to all platforms at once
- **videos-database.json** - Video metadata and upload status database
- **video-database.mjs** - Database utility functions
- **config.json** - Configuration file

## 🚀 Quick Start

### 1. Configuration

Edit `config.json` to set your platform settings:

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
    "upload_timeout": 600,
    "delay_between_videos": 0,
    "show_browser": true,
    "is_close_browser": false
  }
}
```

### 2. Add Videos to Database

Edit `videos-database.json` to add videos:

```json
[
  {
    "id": "video_001",
    "type": "video",
    "video_name": "My Video Title",
    "title": "Post Title",
    "description": "Post description",
    "file_path": "/absolute/path/to/video.mp4",
    "status": "ready",
    "created_at": "2026-03-15T12:00:00Z",
    "tiktok": { "uploaded": false },
    "threads": { "uploaded": false },
    "facebook": { "uploaded": false }
  }
]
```

### 3. Run Uploads

#### Upload to all platforms (sequential):
```bash
cd /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools
node upload-all-platforms.mjs
```

#### Upload to specific platforms:
```bash
# TikTok only
node upload-all-platforms.mjs tiktok

# Threads only
node upload-all-platforms.mjs threads

# Facebook only
node upload-all-platforms.mjs facebook

# Multiple platforms
node upload-all-platforms.mjs tiktok facebook
```

#### Upload to individual platform directly:
```bash
node upload-tiktok-from-json.mjs
node upload-threads-from-json.mjs
node upload-facebook-from-json.mjs
```

## 📋 Database Schema

Each video in `videos-database.json` has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique video identifier |
| `type` | string | "video" or "text" (text only for Threads) |
| `video_name` | string | Internal video name |
| `title` | string | Post title |
| `description` | string | Post description/caption |
| `file_path` | string | Absolute path to video file |
| `status` | string | "ready" for upload, "processing", "done" |
| `created_at` | string | ISO timestamp |
| `tiktok` | object | `{uploaded: boolean, uploaded_at: string, video_id: string}` |
| `threads` | object | `{uploaded: boolean, uploaded_at: string, thread_id: string}` |
| `facebook` | object | `{uploaded: boolean, uploaded_at: string, video_id: string}` |

## 🔧 Requirements

- Node.js (v16+)
- macOS/Linux/Windows with supported browser
- Browser installed (Chromium for Playwright)
- Logged-in browser session for each platform

## ⚙️ Configuration Details

### TikTok Settings
- `audience`: "Everyone" or specific audience setting
- `enable_comments`: Allow comments on videos
- `enable_duet`: Allow duets
- `enable_stitch`: Allow stitches

### Threads Settings
- `enabled`: Enable Threads upload

### Facebook Settings
- `profile_id`: Your Facebook profile ID (found in profile URL)
- Can upload to your profile or page

### General Settings
- `upload_timeout`: Timeout per video in seconds (default: 600 = 10 min)
- `delay_between_videos`: Wait time between videos in seconds
- `show_browser`: Show browser window during upload (true/false)
- `is_close_browser`: Auto-close browser after upload (true/false)

## 📊 Monitoring Uploads

The tool automatically:
- Logs all actions to console
- Updates `videos-database.json` with upload status
- Records timestamps and video IDs for uploaded content
- Displays success/failure summary at the end

After upload completes, check `videos-database.json` to see:
- ✅ `uploaded: true` - Video successfully uploaded
- ❌ `uploaded: false` - Video not uploaded yet
- 📱 `video_id` - Platform's video identifier

## 🐛 Troubleshooting

### Video not uploading
1. Check `status: "ready"` in database
2. Verify `file_path` exists and is accessible
3. Ensure you're logged into each platform in browser
4. Check `show_browser: true` in config to see what's happening

### Timeout errors
- Increase `upload_timeout` in config.json
- Check internet connection speed
- Verify video file is valid

### Button/selector not found
- Tool logs detailed error messages
- Platform UI may have changed - report the issue

## 📝 Usage Examples

### Upload 3 videos to all platforms:
```bash
node upload-all-platforms.mjs
```

### Upload to TikTok only:
```bash
node upload-all-platforms.mjs tiktok
```

### Upload multiple times:
```bash
# First batch
node upload-all-platforms.mjs

# Later: Reset videos and re-upload
# Edit videos-database.json and set all "uploaded": false
node upload-all-platforms.mjs
```

## 🎯 Platform-Specific Notes

### TikTok
- Uploads to your TikTok account
- Respects all comment/duet/stitch settings
- Waits for video processing completion before posting
- Handles copyright checks automatically

### Threads
- Uploads to your Threads profile
- Supports text-only posts (set `type: "text"`)
- Waits for video transcoding completion
- Validates successful post creation

### Facebook
- Uploads to your profile or page (via profile_id)
- Direct URL navigation to profile
- Validates post creation

## 📞 Support

For issues or feature requests, check:
- Console output for detailed error messages
- Browser window during upload (if `show_browser: true`)
- Platform login status before running

---

**Last Updated**: March 15, 2026
**Status**: Production Ready ✅
