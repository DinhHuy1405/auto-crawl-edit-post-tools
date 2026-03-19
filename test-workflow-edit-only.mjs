#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runCommand(command, cwdDir = __dirname) {
    console.log(`\n\n⚙️  RUNNING: ${command}`);
    console.log(`📂 DIR: ${cwdDir}`);
    console.log(`-`.repeat(50));
    try {
        execSync(command, { stdio: 'inherit', cwd: cwdDir });
        console.log(`✅ SUCCESS\n`);
        return true;
    } catch (error) {
        console.error(`❌ FAILED: Command threw an error`);
        console.error(error.message);
        return false;
    }
}

async function main() {
    console.log(`=======================================================`);
    console.log(`🚀 TESTING EDIT + UPLOAD WORKFLOW (SKIP CRAWL)`);
    console.log(`📅 TIME: ${new Date().toLocaleString()}`);
    console.log(`=======================================================\n`);

    const editVideoDir = path.join(__dirname, 'edit-video');

    /*
    // 2. GENERATE NEWS (Gemini Text)
    if (!runCommand('node generate-news.js', editVideoDir)) {
        console.error("🛑 Stopping workflow due to news generation error.");
        process.exit(1);
    }

    // 3. GENERATE VOICE (Gemini TTS)
    if (!runCommand('node generate-voice.js', editVideoDir)) {
        console.error("🛑 Stopping workflow due to voice generation error.");
        process.exit(1);
    }

    // 4. PREPARE VIDEOS JSON FOR RENDERING
    if (!runCommand('node prepare-videos.mjs', editVideoDir)) {
        console.error("🛑 Stopping workflow due to video preparation error.");
        process.exit(1);
    }
    */

    // 5. RENDER THE VIDEOS (FFMPEG)
    if (!runCommand('node run.mjs', editVideoDir)) {
        console.error("🛑 Stopping workflow due to video rendering error.");
        process.exit(1);
    }

    // 6. PREPARE DATABASE FOR UPLOAD
    const uploadDir = path.join(__dirname, 'social-upload-tools');
    if (!runCommand('node prepare-upload.mjs', uploadDir)) {
        console.error("🛑 Stopping workflow due to upload DB preparation error.");
        process.exit(1);
    }

    // 7. MULTI-PLATFORM UPLOAD
    if (!runCommand('node upload-all-platforms.mjs tiktok threads facebook', uploadDir)) {
        console.error("⚠️ Upload workflow finished with some errors.");
    }

    console.log(`\n🎉 EDIT + UPLOAD WORKFLOW COMPLETED!`);
    console.log(`⏱️  FINISHED AT: ${new Date().toLocaleString()}`);
}

main();
