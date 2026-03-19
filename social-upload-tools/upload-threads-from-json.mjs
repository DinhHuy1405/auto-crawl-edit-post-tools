#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
const DATABASE_PATH = path.join(__dirname, 'videos-database.json');

// Load video database functions
import { 
    loadDatabase, 
    saveDatabase, 
    getVideosForThreads,
    updateThreadsStatus 
} from './video-database.mjs';

try {
  console.log('📱 Loading Threads configuration...');
  const database = loadDatabase();

  // Find videos that are ready to post to Threads
  const videosToPost = getVideosForThreads();

  if (videosToPost.length === 0) {
    console.log('✅ No videos ready for Threads upload');
    process.exit(0);
  }

  console.log(`Found ${videosToPost.length} video(s) ready for Threads`);

  // Process each video
  let successCount = 0;
  let failCount = 0;

  for (const video of videosToPost) {
    console.log(`\n📤 Uploading to Threads: ${video.title || video.video_name}`);

    const threadSettings = {
      show_browser: CONFIG.settings.show_browser,
      is_close_browser: CONFIG.settings.is_close_browser,
      description: video.description || video.title || video.video_name,
      video_path: video.file_path,
    };

    const settingsPath = `/tmp/threads_settings_${Date.now()}.json`;
    fs.writeFileSync(settingsPath, JSON.stringify(threadSettings, null, 2));

    // Run the social-tool command
    const socialToolPath = path.join(
      __dirname,
      CONFIG.directories.social_tool_path,
      'dist/main.js'
    );

    console.log(`⚙️ Executing: node ${socialToolPath} post-threads ${settingsPath}`);

    const result = spawnSync(
      'node',
      [socialToolPath, 'post-threads', settingsPath],
      {
        cwd: path.dirname(socialToolPath),
        stdio: 'inherit',
        timeout: 600000, // 10 minutes
      },
    );

    // Clean up temp settings file
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }

    if (result.status === 0) {
      console.log(`✅ Threads upload successful: ${video.title || video.video_name}`);
      updateThreadsStatus(video.id, true, { uploaded_at: new Date().toISOString() });
      successCount++;
    } else {
      console.error(`❌ Threads upload failed: ${video.title || video.video_name}`);
      updateThreadsStatus(video.id, false, { error: 'Upload failed', exit_code: result.status });
      failCount++;
    }
  }

  // Reload and show updated statistics
  const db = loadDatabase();
  console.log(`\n🎉 Threads batch upload completed!`);
  console.log(`✅ Success: ${successCount} videos`);
  console.log(`❌ Failed: ${failCount} videos`);

  if (db.length > 0 || (Array.isArray(db) && db.length > 0)) {
    const videos = Array.isArray(db) ? db : (db.videos || []);
    const stats = {
      total: videos.length,
      threads_uploaded: videos.filter(v => v.threads?.uploaded === true).length,
      facebook_uploaded: videos.filter(v => v.facebook?.uploaded === true).length,
      tiktok_uploaded: videos.filter(v => v.tiktok?.uploaded === true).length,
    };

    console.log('\n📊 Updated Statistics:');
    console.log(`📹 Total videos: ${stats.total}`);
    console.log(`📱 Threads uploaded: ${stats.threads_uploaded}`);
    console.log(`📘 Facebook uploaded: ${stats.facebook_uploaded}`);
    console.log(`🎵 TikTok uploaded: ${stats.tiktok_uploaded}`);
  }

} catch (error) {
  console.error('❌ Error during Threads upload:', error.message);
  process.exit(1);
}
