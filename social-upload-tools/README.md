# Social Media Upload Tools

Consolidated suite for uploading videos to multiple social media platforms.

## Platforms Supported

### 1. TikTok Upload
```bash
cd /Users/nguyendinhhuy/Desktop/Personal\ Project/auto-videos-genixtool/social-tool
node dist/main.js post-tiktok <config.json>
```

**Config example:**
```json
{
  "show_browser": true,
  "is_close_browser": true,
  "video_path": "/path/to/video.mp4",
  "description": "Your caption",
  "audience": "friends",
  "is_comment_on": true,
  "is_duet_on": true,
  "is_ai_generated": false
}
```

### 2. Facebook Reels Upload
```bash
cd /Users/nguyendinhhuy/Desktop/Personal\ Project/auto-videos-genixtool/social-tool
node dist/main.js post-reels-facebook <config.json>
```

**Config example:**
```json
{
  "show_browser": true,
  "is_close_browser": true,
  "video_path": "/path/to/video.mp4",
  "description": "Your caption",
  "page": "Your Facebook Page Name"
}
```

### 3. Threads Upload
```bash
cd /Users/nguyendinhhuy/Desktop/Personal\ Project/auto-videos-genixtool/social-tool
node dist/main.js post-threads <config.json>
```

**Config example:**
```json
{
  "show_browser": true,
  "is_close_browser": true,
  "video_path": "/path/to/video.mp4",
  "description": "Your thread text"
}
```

## Batch Upload Scripts

### Upload TikTok from Database
```bash
node /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools/upload-tiktok-from-json.mjs
```

### Upload Facebook from Database
```bash
node /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools/upload-facebook-from-json.mjs
```

### Upload Threads from Database
```bash
node /Users/nguyendinhhuy/Desktop/Personal\ Project/social-upload-tools/upload-threads-from-json.mjs
```

## Features

✅ **Automated Video Posting** - Upload videos with captions automatically
✅ **Multi-Platform** - Post to TikTok, Facebook, and Threads
✅ **Browser Control** - Show/hide browser during upload
✅ **Error Handling** - Automatic error detection and reporting
✅ **Database Integration** - Track uploaded videos in JSON database
✅ **Vietnamese Support** - Full Vietnamese UI language support

## Status

- **TikTok**: ✅ Working
- **Facebook Reels**: ✅ Working
- **Threads**: ✅ Working
