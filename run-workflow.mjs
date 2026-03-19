#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==========================================
// ⚙️ LOAD SHARED CONFIG
// ==========================================
const SHARED_CONFIG = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')
);

function getYesterdayFolderPath() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dd = String(yesterday.getDate()).padStart(2, '0');
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yyyy = yesterday.getFullYear();
    const ddmmyyyy = `${dd}${mm}${yyyy}`;
    return path.join(SHARED_CONFIG.paths.outputDir, ddmmyyyy);
}

function hasAnyDownloadedVideo(dir) {
    if (!fs.existsSync(dir)) return false;
    const videoExts = new Set(['.mp4', '.mkv', '.webm', '.mov']);
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && videoExts.has(path.extname(entry.name).toLowerCase())) {
            return true;
        } else if (entry.isDirectory()) {
            if (hasAnyDownloadedVideo(fullPath)) return true;
        }
    }
    return false;
}

function countNotDoneVideos(videosJsonPath) {
    if (!fs.existsSync(videosJsonPath)) return 0;
    try {
        const arr = JSON.parse(fs.readFileSync(videosJsonPath, 'utf8'));
        if (!Array.isArray(arr)) return 0;
        return arr.filter((v) => String(v.status || '').toLowerCase() !== 'done').length;
    } catch {
        return 0;
    }
}

function countDoneVideos(videosJsonPath) {
    if (!fs.existsSync(videosJsonPath)) return 0;
    try {
        const arr = JSON.parse(fs.readFileSync(videosJsonPath, 'utf8'));
        if (!Array.isArray(arr)) return 0;
        return arr.filter((v) => String(v.status || '').toLowerCase() === 'done' && v.outputPath).length;
    } catch {
        return 0;
    }
}

function getUploadDbCount(uploadDbPath) {
    if (!fs.existsSync(uploadDbPath)) return 0;
    try {
        const arr = JSON.parse(fs.readFileSync(uploadDbPath, 'utf8'));
        return Array.isArray(arr) ? arr.length : 0;
    } catch {
        return 0;
    }
}

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
    console.log(`🚀 STARTING FULL AUTOMATED WORKFLOW`);
    console.log(`📅 TIME: ${new Date().toLocaleString()}`);
    console.log(`=======================================================\n`);

    // 1. CRAWL YOUTUBE VIDEOS (Yesterday's date)
    // Use setting from config.json (useJDownloader: true/false)
    const venvPythonPath = path.join(__dirname, '..', '.venv', 'bin', 'python3');
    const pythonCmd = fs.existsSync(venvPythonPath) ? `"${venvPythonPath}"` : 'python3';
    
    if (!runCommand(`${pythonCmd} "crawl-upload-tools/crawl/crawl-video.py"`)) {
        console.error("🛑 Stopping workflow due to crawler error.");
        process.exit(1);
    }

    const crawlOutputDir = getYesterdayFolderPath();
    if (!hasAnyDownloadedVideo(crawlOutputDir)) {
        console.error(`🛑 No downloaded video found yet in: ${crawlOutputDir}`);
        console.error("🛑 Stop to avoid moving to edit/upload before download is complete.");
        process.exit(1);
    }

    // 2. GENERATE NEWS (Gemini Text)
    // Run inside edit-video folder since the JS files might use relative paths/dotenv
    const editVideoDir = path.join(__dirname, 'edit-video');
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

    const videosJsonPath = path.join(editVideoDir, 'videos.json');
    const pendingBeforeRender = countNotDoneVideos(videosJsonPath);
    if (pendingBeforeRender === 0) {
        console.log("⏭️ No pending videos for rendering. Stop before upload.");
        return;
    }

    // 5. RENDER THE VIDEOS (FFMPEG)
    if (!runCommand('node run.mjs', editVideoDir)) {
        console.error("🛑 Stopping workflow due to video rendering error.");
        process.exit(1);
    }

    const doneAfterRender = countDoneVideos(videosJsonPath);
    if (doneAfterRender === 0) {
        console.log("⏭️ No rendered output marked as done. Stop before upload.");
        return;
    }

    // 6. PREPARE DATABASE FOR UPLOAD
    const uploadDir = path.join(__dirname, 'social-upload-tools');
    const uploadDbPath = path.join(uploadDir, 'videos-database.json');
    const uploadDbCountBefore = getUploadDbCount(uploadDbPath);

    if (!runCommand('node prepare-upload.mjs', uploadDir)) {
        console.error("🛑 Stopping workflow due to upload DB preparation error.");
        process.exit(1);
    }

    const uploadDbCountAfter = getUploadDbCount(uploadDbPath);
    const newUploadItems = uploadDbCountAfter - uploadDbCountBefore;
    if (newUploadItems <= 0) {
        console.log("⏭️ No new upload item created in this run. Skip upload step.");
        return;
    }

    // 7. MULTI-PLATFORM UPLOAD
    if (!runCommand('node upload-all-platforms.mjs tiktok threads facebook', uploadDir)) {
        console.error("⚠️ Upload workflow finished with some errors.");
    }

    console.log(`\n🎉 FULL WORKFLOW COMPLETED SUCCESSFULLY!`);
    console.log(`⏱️  FINISHED AT: ${new Date().toLocaleString()}`);
}

main();
