#!/usr/bin/env node
import { execSync } from 'child_process';
import path from 'path';

const output = "/Users/nguyendinhhuy/Documents/Edit Video/Thời Sự/17032026/TEST_SIMPLE.mp4";

// Simple FFmpeg command with just audio mixing (no complex video filters)
const cmd = `ffmpeg -y \
  -i "public/template/f/f.mp4" \
  -i "public/template/f/sound  .MP3" \
  -filter_complex "[0:a]volume=0.75[main];[1:a]volume=0.25[music];[main][music]amix=inputs=2:duration=longest[out]" \
  -map "0:v" -map "[out]" \
  -t 15 -c:v libx264 -preset fast -c:a aac -b:a 192k \
  "${output}"`;

console.log("🎬 Testing simple audio mixing render...\n");
console.log("Command:", cmd.substring(0, 100) + "...\n");

try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`\n✅ SUCCESS! Video created: ${output}`);
} catch (e) {
    console.log(`\n❌ ERROR: ${e.message}`);
}
