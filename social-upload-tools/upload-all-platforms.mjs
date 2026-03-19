#!/usr/bin/env node

/**
 * Upload All Platforms
 * Uploads videos to TikTok, Threads, and Facebook from videos-database.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🚀 Social Media Batch Upload Tool');
console.log('====================================\n');

// Parse command line arguments
const args = process.argv.slice(2);
const platforms = args.length > 0 ? args : ['tiktok', 'threads', 'facebook'];

const validPlatforms = ['tiktok', 'threads', 'facebook'];
const platformsToRun = platforms.filter(p => validPlatforms.includes(p.toLowerCase()));

if (platformsToRun.length === 0) {
  console.error('❌ Invalid platforms. Use: upload-all-platforms.mjs [tiktok] [threads] [facebook]');
  console.error('   Example: upload-all-platforms.mjs tiktok threads');
  console.error('   Default (no args): uploads to all platforms');
  process.exit(1);
}

console.log(`📱 Platforms to upload: ${platformsToRun.map(p => p.toUpperCase()).join(', ')}\n`);

// Upload to each platform sequentially
async function runUploads() {
  let totalSuccess = 0;
  let totalFailed = 0;

  for (const platform of platformsToRun) {
    try {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`▶️  Starting ${platform.toUpperCase()} upload...`);
      console.log(`${'='.repeat(50)}\n`);

      const scriptPath = `./upload-${platform}-from-json.mjs`;
      
      if (!fs.existsSync(scriptPath)) {
        console.error(`❌ Script not found: ${scriptPath}`);
        totalFailed++;
        continue;
      }

      const result = execSync(`node ${scriptPath}`, {
        stdio: 'inherit',
        timeout: 1800000, // 30 minutes max per platform
      });

      totalSuccess++;
    } catch (error) {
      console.error(`❌ Error uploading to ${platform}:`, error.message);
      totalFailed++;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 Batch Upload Summary');
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ Successful: ${totalSuccess} platform(s)`);
  console.log(`❌ Failed: ${totalFailed} platform(s)`);
  console.log(`${'='.repeat(50)}\n`);

  // Check database for overall stats
  try {
    const dbPath = path.join(__dirname, 'videos-database.json');
    const database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    let tiktokCount = 0, threadsCount = 0, facebookCount = 0;
    
    database.forEach(video => {
      if (video.tiktok?.uploaded) tiktokCount++;
      if (video.threads?.uploaded) threadsCount++;
      if (video.facebook?.uploaded) facebookCount++;
    });

    console.log('📈 Overall Upload Stats:');
    console.log(`📱 TikTok: ${tiktokCount} videos`);
    console.log(`🎵 Threads: ${threadsCount} videos`);
    console.log(`📘 Facebook: ${facebookCount} videos`);
    console.log(`📹 Total videos in database: ${database.length}\n`);
  } catch (e) {
    // Ignore if db can't be read
  }
}

runUploads().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
