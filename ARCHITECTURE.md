# 📋 Module Adjustment Guide

## Architecture Overview

```
config.json (SHARED) ← All modules reference this
├── edit-video/
│   ├── config-loader.mjs (Helper for loading config)
│   ├── run.mjs ✅ UPDATED - Uses audio volumes from config
│   ├── generate-news.js 🔴 NEEDS UPDATE - Use newsGeneration config
│   ├── generate-voice.js 🔴 NEEDS UPDATE - Use tts config
│   └── prepare-videos.mjs 
├── crawl-upload-tools/crawl/
│   └── crawl-video.py 🔴 NEEDS UPDATE - Use crawler config
└── run-workflow.mjs ✅ UPDATED - Loads shared config

```

---

## ✅ COMPLETED UPDATES

### 1. **config.json** - Created ✅
Centralized configuration file with all shared settings:
- Audio volumes: main=0.75, music=0.25, voice=1.0
- TTS settings: gemini-2.5-pro, erinome voice, 24kHz
- News generation: gemini-1.5-flash, journalistic style, 100-500 words
- Video codec: libx264, fast preset, AAC 192k
- Paths and templates

### 2. **run.mjs** - Updated ✅
- Loads shared config.json
- Implements individual audio volume controls:
  - Main video: 0.75 (volume=${mainVol})
  - Background music: 0.25 (volume=${musicVol})
  - Voice narration: 1.0 (volume=${voiceVol})
- Uses FFmpeg codec settings from config (aac, 192k, libx264, fast)
- Filter chain: `[main_audio_proc][processed_sound][processed_voice]amix=inputs=3:duration=longest[outa]`

### 3. **run-workflow.mjs** - Updated ✅
- Loads shared config.json
- Uses SHARED_CONFIG.paths.outputDir instead of hardcoded path
- All module calling structure intact

---

## 🔴 NEED TO UPDATE (Module-Specific)

### 4. **generate-news.js** - NEEDS UPDATE
**Current State:**
- Hardcoded prompt with fixed word count (300-500)
- Fixed language (Vietnamese) and tone in inline prompt

**Update Required:**
```javascript
// Add at top:
import { getNewsConfig } from './config-loader.mjs';

// In generateNewsFromText():
const newsConfig = getNewsConfig();
const prompt = `
Phân tích nội dung dưới đây và thực hiện các yêu cầu sau.
CHỈ trả về DỮ LIỆU JSON HỢP LỆ, KHÔNG giải thích, KHÔNG ghi chú...

{
  "Content": "...",
  "Title": "..."
}

Yêu cầu: (viết bằng tiếng Việt).
1. Content: BẮT BUỘC phải viết lại bài báo với độ dài từ ${newsConfig.minWords} đến ${newsConfig.maxWords} từ,
   phong cách ${newsConfig.style}, tone: ${newsConfig.tone}
2. Title: Ngắn gọn, không ký tự đặc biệt, dưới 100 ký tự, rõ ý chính.
`;
```

**Also update Gemini model call:**
```javascript
// Change from:
const response = await googleGenAI.models.generateContent({
    model: "gemini-1.5-flash",
    
// To:
const response = await googleGenAI.models.generateContent({
    model: newsConfig.model, // "gemini-1.5-flash"
```

---

### 5. **generate-voice.js** - NEEDS UPDATE
**Current State:**
- Hardcoded voice name: "alnilam" (should be "erinome" for Vietnamese)
- Fixed model: "gemini-2.5-flash-preview-tts"
- Inline prompt with fixed styling

**Update Required:**
```javascript
// Add at top:
import { getTTSConfig } from './config-loader.mjs';

// In generateVoice():
const ttsConfig = getTTSConfig();
const response = await googleGenAI.models.generateContent({
    model: `gemini-2.5-pro`, // Use ttsConfig.model when available
    config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
            voiceConfig: {
                prebuiltVoiceConfig: { 
                    voiceName: ttsConfig.voice  // "erinome" from config
                },
            },
            audioConfig: {
                audioEncoding: "WAV",
                sampleRateHertz: ttsConfig.sampleRate // 24000
            }
        },
    },
    contents: [
        {
            parts: [
                {
                    text: `Đọc nội dung theo style: ${ttsConfig.language}, voice: ${ttsConfig.voice}\n\n${content}`,
                },
            ],
        },
    ],
});
```

---

### 6. **crawl-video.py** - NEEDS UPDATE
**Current State:**
- Missing pandas module (causing workflow failure)
- Hardcoded settings

**Update Required:**
1. **Install pandas:**
   ```bash
   pip install pandas yt-dlp
   ```

2. **Add config loading to crawl-video.py:**
   ```python
   import json
   import os
   
   # Load config
   config_path = os.path.join(os.path.dirname(__file__), '../../config.json')
   with open(config_path, 'r', encoding='utf-8') as f:
       config = json.load(f)
   
   # Use config values:
   use_jdownloader = config['crawler']['useJDownloader']
   download_format = config['crawler']['downloadFormat']
   output_dir = config['paths']['outputDir']
   ```

---

### 7. **prepare-videos.mjs** - OPTIONAL UPDATE
**Current State:** Works fine with videos.json

**Recommended Update (for consistency):**
```javascript
// Add at top:
import { getPathConfig } from './config-loader.mjs';

// Use config paths instead of hardcoded values
```

---

## 📋 Summary of Changes

| File | Status | Type | Impact |
|------|--------|------|--------|
| config.json | ✅ Created | Setup | Core configuration hub |
| run.mjs | ✅ Updated | Module-specific | Audio volumes now working |
| run-workflow.mjs | ✅ Updated | Orchestrator | Reads from config |
| config-loader.mjs | ✅ Created | Helper | Module config loading |
| generate-news.js | 🔴 Pending | Module-specific | Use config for prompts |
| generate-voice.js | 🔴 Pending | Module-specific | Use config for TTS settings |
| crawl-video.py | 🔴 Pending | Module-specific | Install pandas + use config |
| prepare-videos.mjs | ⚪ Optional | Module-specific | Works, but can be optimized |

---

## 🚀 Next Steps

1. **Fix crawl-video.py** (blocking workflow)
   ```bash
   pip install pandas yt-dlp
   # Add config loading code
   ```

2. **Update generate-news.js** (for consistent prompting)
   - Import getNewsConfig()
   - Use config values in prompt template

3. **Update generate-voice.js** (for voice quality)
   - Import getTTSConfig()
   - Change voice from "alnilam" to "erinome"
   - Use 24kHz sample rate

4. **Test workflow**
   ```bash
   node run-workflow.mjs
   ```

---

## ✨ Benefits of This Architecture

1. **Centralized Config** - Change settings in one place, affects all modules
2. **Module Isolation** - Each module still has its own specific logic
3. **Easy Maintenance** - No hardcoded values scattered across files
4. **Version Control** - Config.json can be excluded or managed separately
5. **Reusability** - Other projects can copy this structure

