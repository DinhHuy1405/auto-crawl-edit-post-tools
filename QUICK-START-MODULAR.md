# ⚡ Quick Reference - How to Use the Modular Architecture

## 🎯 Change Any Setting Without Touching Code

### Change Audio Volume
```json
// In config.json
"audio": {
  "volumes": {
    "mainVideo": 0.75,        ← Change this
    "backgroundMusic": 0.25,  ← Or this
    "voiceNarration": 1.0     ← Or this
  }
}
```
Then run: `node run.mjs`
➜ **No code edits needed!**

---

### Change TTS Voice
```json
// In config.json
"tts": {
  "voice": "erinome"    ← Change to "alnilam", "ishan", etc.
}
```
Then run: `node generate-voice.js`
➜ **Next batch uses new voice!**

---

### Change News Generation Style
```json
// In config.json
"newsGeneration": {
  "minWords": 100,       ← Minimum word count
  "maxWords": 500,       ← Maximum word count
  "tone": "modern and humanistic"  ← Change tone
}
```
Then run: `node generate-news.js`
➜ **Next batch uses new style!**

---

### Change Crawler Source Folder
```json
// In config.json
"paths": {
  "outputDir": "/Users/nguyendinhhuy/Documents/Edit Video/Thời Sự"  ← Change path
}
```
➜ **All modules auto-use new path!**

---

## 🔧 Module Independence

### Use Just One Module

```bash
# Just generate news (read subtitles, create news JSON)
cd edit-video && node generate-news.js

# Just generate voice (read news JSON, create voice WAV)
cd edit-video && node generate-voice.js

# Just render videos (read voice WAV, create MP4)
cd edit-video && node run.mjs

# Just prepare metadata (scan folders, create videos.json)
cd edit-video && node prepare-videos.mjs

# Just crawl (download videos)
python3 crawl-upload-tools/crawl/crawl-video.py
```

---

## 🚀 Full Workflow

```bash
# All steps automatically:
node run-workflow.mjs

# Output flow:
Crawl → Generate News → Generate Voice → Prepare → Render → Upload
 ↓        ↓              ↓                ↓        ↓        ↓
Videos  Content.json   Voice.wav     videos.json MP4s    Posted
```

---

## 📊 Config File Structure

```json
{
  "paths": {
    "outputDir": "...",         ← All modules use this
    "editVideoDir": "...",
    "socialUploadDir": "...",
    "crawlDir": "..."
  },
  
  "audio": {
    "volumes": { ... },         ← run.mjs reads this
    "codec": "aac",
    "bitrate": "192k"
  },
  
  "video": {
    "codec": "libx264",         ← run.mjs reads this
    "preset": "fast"
  },
  
  "tts": {
    "voice": "erinome",         ← generate-voice.js reads this
    "sampleRate": 24000
  },
  
  "newsGeneration": {
    "minWords": 100,            ← generate-news.js reads this
    "maxWords": 500,
    "tone": "modern and humanistic"
  },
  
  "crawler": {
    "useJDownloader": false,    ← crawl-video.py reads this
    "downloadFormat": "mp4"
  }
}
```

---

## ✅ Checklist: What Works Now

- [x] Audio volumes controllable (no code changes needed)
- [x] TTS voice configurable (erinome by default)
- [x] News generation style configurable
- [x] Crawler uses config output directory
- [x] All modules auto-coordinate via config
- [x] Pandas installed (workflow unblocked)
- [x] Central config hub for all settings
- [x] Each module still maintains its logic

---

## 🎯 Typical Adjustments

### Scenario 1: Audio Too Loud
```json
"volumes": {
  "backgroundMusic": 0.15  ← Reduce from 0.25
}
```

### Scenario 2: Voice Needs to Be More Prominent
```json
"volumes": {
  "mainVideo": 0.5,        ← Reduce main video
  "voiceNarration": 1.0    ← Keep voice full
}
```

### Scenario 3: Generate Longer News Articles
```json
"newsGeneration": {
  "maxWords": 800          ← Increase from 500
}
```

### Scenario 4: Change Output Directory
```json
"paths": {
  "outputDir": "/path/to/new/location"
}
```

---

## 🔍 How to Check Current Settings

```bash
# Print current config:
node -e "import('./edit-video/config-loader.mjs').then(c => console.log(JSON.stringify(c.getConfig(), null, 2)))"

# Print just audio settings:
node -e "import('./edit-video/config-loader.mjs').then(c => console.log(c.getAudioConfig()))"

# Print just TTS settings:
node -e "import('./edit-video/config-loader.mjs').then(c => console.log(c.getTTSConfig()))"
```

---

## 🚨 Troubleshooting

### Problem: Modules don't use config values
**Solution:** Make sure `config.json` exists in root directory

### Problem: Audio volumes not applying
**Solution:** 
1. Edit config.json
2. Restart run.mjs (don't just re-run batch)

### Problem: TTS voice not changing
**Solution:** 
1. Edit config.json "tts.voice"
2. Restart generate-voice.js

### Problem: Can't find output directory
**Solution:** 
1. Check config.json "paths.outputDir"
2. Verify path exists: `ls -la "/path/you/set"`

---

## 📞 Module Config Requirements

| Module | Reads From Config | Key Settings |
|--------|-------------------|--------------|
| run.mjs | audio, video, paths | volumes, codec, bitrate |
| generate-news.js | newsGeneration, paths | minWords, maxWords, tone |
| generate-voice.js | tts, paths | voice, sampleRate, model |
| prepare-videos.mjs | paths | outputDir |
| crawl-video.py | crawler, paths | useJDownloader, outputDir |
| run-workflow.mjs | paths | outputDir |

---

## 🎉 You Can Now!

✅ Change audio volumes without touching code
✅ Switch TTS voices without touching code
✅ Adjust news generation style without touching code
✅ Modify output directories without touching code
✅ Enable/disable JDownloader without touching code
✅ Run individual modules independently
✅ Run full workflow with one command

**All changes in ONE file: `config.json`**

