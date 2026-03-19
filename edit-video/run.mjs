#!/usr/bin/env node
/**
 * Video Editor - Batch Processing
 * Optimized, Refactored, Clean FFmpeg Filter Output with Audio Volume Controls
 * Now with Title Text Overlay Support (using image-based approach)
 */
import fs from "fs";
import { promises as fsPromises } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from 'url';
import { createCanvas, registerFont } from 'canvas';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Register Anton Font
try {
    const antonFontPath = path.join(__dirname, 'assets/Anton/Anton-Regular.ttf');
    if (fs.existsSync(antonFontPath)) {
        registerFont(antonFontPath, { family: 'Anton' });
        console.log("   ✅ Registered Anton font via Canvas");
    }
} catch (e) {
    console.warn("   ⚠️ Could not register Anton font:", e.message);
}

// ==========================================
// ⚙️ LOAD SHARED CONFIG
// ==========================================
const SHARED_CONFIG = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')
);

// ==========================================
// ⚙️ MODULE-SPECIFIC CONFIGURATION
// ==========================================
const CONFIG = {
    files: {
        videosJson: path.join(__dirname, "videos.json"),
        defaultMainVideo: path.join(__dirname, SHARED_CONFIG.paths.templateDir, SHARED_CONFIG.templates.mainVideo),
        defaultTemplateVideo: path.join(__dirname, SHARED_CONFIG.paths.templateDir, SHARED_CONFIG.templates.templateVideo),
        defaultSoundAudio: path.join(__dirname, SHARED_CONFIG.paths.publicDir, SHARED_CONFIG.templates.backgroundMusic),
        logo: path.join(__dirname, SHARED_CONFIG.paths.publicDir, SHARED_CONFIG.templates.logo)
    },
    output: {
        baseDir: SHARED_CONFIG.paths.outputDir,
        maxDurationSec: SHARED_CONFIG.video.maxDurationSec
    },
    layout: SHARED_CONFIG.layout,
    audio: SHARED_CONFIG.audio,
    video: SHARED_CONFIG.video
};

// ==========================================
// 🛠️ UTILS
// ==========================================
function getTimeString() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function getMediaDurationInSeconds(filePath) {
    try {
        const { stdout } = await execAsync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
        );
        return Math.floor(parseFloat(stdout.trim()));
    } catch (error) {
        console.error(`❌ Error getting duration for ${path.basename(filePath)}:`, error.message);
        return 0;
    }
}

// ==========================================
// 📝 TITLE IMAGE GENERATOR
// ==========================================
async function generateTitleImage(title, outputPath, width = CONFIG.layout.titleW ?? 1440, height = CONFIG.layout.titleH ?? 300) {
    try {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // Transparent background
        ctx.clearRect(0, 0, width, height);
        
        // Text styling
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '65px "Anton", sans-serif'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // Wrap text if too long
        const maxWidth = width - 100;
        const words = title.split(' ');
        let lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
        
        // Draw title text with outline/shadow for visibility against bright backgrounds
        const lineHeight = 85;
        const startY = 10; // Đẩy text cao lên một chút bên trong khung canvas
        
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#000000';
        ctx.lineJoin = 'round';
        
        lines.forEach((line, index) => {
            const y = startY + (index * lineHeight);
            
            // Draw Outline (Stroke)
            ctx.strokeText(line, width / 2, y);
            
            // Draw Main text (Fill)
            ctx.fillText(line, width / 2, y);
        });
        
        // Save as PNG
        const buffer = canvas.toBuffer('image/png');
        await fsPromises.writeFile(outputPath, buffer);
        console.log(`   📝 Generated title image: ${path.basename(outputPath)}`);
        return true;
    } catch (error) {
        console.error(`   ⚠️  Could not generate title image: ${error.message}`);
        return false;
    }
}

// ==========================================
// 🎬 FFMPEG PIPELINE
// ==========================================
function generateFFmpegCommand(inputs, outputVideo, duration) {
    const { mainVideo, templateVideo, soundAudio, voiceAudio, logo, titleImage } = inputs;
    const {
        templateX, templateY,
        templateW = 1440, templateH = -1,
        logoX, logoY,
        logoW: cfgLogoW, logoH: cfgLogoH, logoScale,
        titleY = 1150, titleW = 1440, titleH = 300, titleDuration = 5,
    } = CONFIG.layout;
    // logoW/logoH: prefer explicit fields, fall back to logoScale string
    const [logoW, logoH] = (cfgLogoW && cfgLogoH)
        ? [cfgLogoW, cfgLogoH]
        : logoScale.split(":").map(Number);
    
    const filterComplexParts = [];
    
    // 1. Process Main Video (Gameplay)
    filterComplexParts.push(
        `[0:v]trim=start=0:duration=${duration},setpts=PTS-STARTPTS[trimmed_main_video]`
    );
    
    // 2. Process Audio Streams with Individual Volume Controls
    const mainVol = CONFIG.audio.volumes.mainVideo;
    const musicVol = CONFIG.audio.volumes.backgroundMusic;
    const voiceVol = CONFIG.audio.volumes.voiceNarration;
    
    filterComplexParts.push(
        // Main video audio with volume control
        `[0:a]volume=${mainVol}[main_audio_proc]`,
        // Background music: handled by -stream_loop input arg, just trim & scale
        `[2:a]atrim=start=0:duration=${duration},asetpts=PTS-STARTPTS[sound_trimmed]`,
        `[sound_trimmed]volume=${musicVol}[processed_sound]`,
        // Voice narration with volume control
        `[3:a]atrim=start=0:duration=${duration},asetpts=PTS-STARTPTS[voice_trimmed]`,
        `[voice_trimmed]volume=${voiceVol}[processed_voice]`
    );

    // 3. Process Template Video (Crawled Video)
    filterComplexParts.push(
        `[1:v]scale=${templateW}:${templateH}[scaled_template]`,
        `[scaled_template]split=4[orig_template][tl_blur_in][tr_blur_in][bottom_blur_in]`,
        `[tl_blur_in]gblur=sigma=30[tl_blurred_full]`,
        `[tl_blurred_full]crop=w=210:h=210:x=0:y=0[tl_blurred_cropped]`,
        `[tr_blur_in]gblur=sigma=30[tr_blurred_full]`,
        `[tr_blurred_full]crop=w=350:h=180:x=1130:y=-30[tr_blurred_cropped]`,
        `[bottom_blur_in]gblur=sigma=30[bottom_blurred_full]`,
        `[bottom_blurred_full]crop=w=600:h=80:x=(1440-600)/2:y='(ih-200)'[bottom_blurred_cropped]`,
        `[orig_template][tl_blurred_cropped]overlay=x=0:y=0[temp_template1]`,
        `[temp_template1][tr_blurred_cropped]overlay=x=1130:y=-30[temp_template2]`,
        `[temp_template2][bottom_blurred_cropped]overlay=x=(1440-600)/2:y='(main_h-100)'[final_blurred_template]`
    );
    
    // Overlay Template onto Main Video
    filterComplexParts.push(
        `[trimmed_main_video][final_blurred_template]overlay=x=${templateX}:y=${templateY}[video_with_template]`
    );

    // 4. Add Title Image overlay (thay đổi vị trí nằm giữa viền của video được crawl và gameplay)
    let videoStream = 'video_with_template';
    let nextInput = 4; // Start from input 4 (logo is at 4, title would be at 5)
    
    if (titleImage && fs.existsSync(titleImage)) {
        filterComplexParts.push(
            `[video_with_template][${nextInput}:v]overlay=x=0:y=${titleY}:enable='between(t,0,${titleDuration})'[video_with_title]`
        );
        videoStream = 'video_with_title';
        nextInput = 5;
    }

    // 5. Add Logo overlay
    filterComplexParts.push(
        `[${nextInput}:v]scale=${logoW}:${logoH},format=rgba[scaled_logo]`,
        `[${videoStream}][scaled_logo]overlay=x=${logoX}:y=${logoY}:enable='between(t,0,${duration})'[final_video_output_stream]`
    );

    // 6. Audio Mixer with all 3 streams
    filterComplexParts.push(
        `[main_audio_proc][processed_sound][processed_voice]amix=inputs=3:duration=longest[outa]`
    );

    const filterComplex = filterComplexParts.join(";");

    // Build input string dynamically based on whether title image exists
    let inputsStr = `-y -ss 180 -i "${mainVideo}" -i "${templateVideo}" -stream_loop -1 -i "${soundAudio}" -i "${voiceAudio}"`;
    
    if (titleImage && fs.existsSync(titleImage)) {
        inputsStr += ` -i "${titleImage}"`;
    }
    
    inputsStr += ` -i "${logo}"`;

    return `ffmpeg ${inputsStr} -filter_complex "${filterComplex}" -map "[final_video_output_stream]" -map "[outa]" -t ${duration} -c:a ${CONFIG.audio.codec} -b:a ${CONFIG.audio.bitrate} -c:v ${CONFIG.video.codec} -preset ${CONFIG.video.preset} "${outputVideo}"`;
}

async function executeFFmpeg(cmd) {
    try {
        console.log("   🚀 Running FFmpeg compilation...");
        await execAsync(cmd, { maxBuffer: 100 * 1024 * 1024 });
        console.log("   ✅ FFmpeg execution finished successfully!");
        return true;
    } catch (error) {
        console.error("   ❌ FFmpeg Error:", error.message);
        return false;
    }
}

// ==========================================
// 🔄 MAIN BATCH PROCESS
// ==========================================
async function processBatch() {
    if (!fs.existsSync(CONFIG.files.videosJson)) {
        console.error(`❌ Data file ${CONFIG.files.videosJson} not found!`);
        return;
    }

    const videosData = JSON.parse(await fsPromises.readFile(CONFIG.files.videosJson, "utf8"));
    if (!Array.isArray(videosData) || videosData.length === 0) {
        console.log("⏭️ No videos to process.");
        return;
    }

    // Setup Output Directory - use YESTERDAY's date to match source videos
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ddmmyyyy = `${String(yesterday.getDate()).padStart(2, "0")}${String(yesterday.getMonth() + 1).padStart(2, "0")}${yesterday.getFullYear()}`;
    const outputDir = path.join(CONFIG.output.baseDir, ddmmyyyy);
    await fsPromises.mkdir(outputDir, { recursive: true });

    // Count existing files to format tracking numbers
    const currentFiles = await fsPromises.readdir(outputDir);
    let dailyCount = currentFiles.filter(f => f.endsWith('.mp4')).length;

    for (const [index, video] of videosData.entries()) {
        console.log(`\n======================================================`);
        console.log(`🎥 Processing Video ${index + 1}/${videosData.length}: "${video.title}"`);
        
        if (video.status && video.status.toLowerCase() === "done") {
            console.log(`   ⏭️ Status is 'done'. Skipping...`);
            continue;
        }

        if (!video.voiceLink) {
            console.log(`   ⚠️ Missing 'voiceLink'. Skipping...`);
            continue;
        }

        // Handle possible empty or missing fields smoothly
        const resolvedVideoLink = video.videoLink ? path.resolve(__dirname, video.videoLink) : "";
        const resolvedSoundLink = video.soundLink ? path.resolve(__dirname, video.soundLink) : "";
        const voiceAudioAbsPath = path.resolve(__dirname, video.voiceLink);

        const inputs = {
            mainVideo: CONFIG.files.defaultMainVideo,
            templateVideo: fs.existsSync(resolvedVideoLink) && fs.statSync(resolvedVideoLink).isFile() 
                            ? resolvedVideoLink 
                            : CONFIG.files.defaultTemplateVideo,
            soundAudio: fs.existsSync(resolvedSoundLink) && fs.statSync(resolvedSoundLink).isFile()
                            ? resolvedSoundLink 
                            : CONFIG.files.defaultSoundAudio,
            voiceAudio: voiceAudioAbsPath,
            logo: CONFIG.files.logo,
            videoLink: resolvedVideoLink || video.title
        };

        // Check if voice exists (critical)
        if (!fs.existsSync(inputs.voiceAudio)) {
            console.error(`   ❌ Voice file not found: ${inputs.voiceAudio}. Skipping...`);
            video.status = "error";
            continue;
        }

        // Calculate Duration
        const voiceDuration = await getMediaDurationInSeconds(inputs.voiceAudio);
        if(voiceDuration <= 0) {
            console.error(`   ❌ Invalid voice duration. Skipping...`);
            video.status = "error";
            continue;
        }
        
        const targetDuration = Math.min(voiceDuration, CONFIG.output.maxDurationSec);
        console.log(`   ⏳ Target duration: ${targetDuration}s (Voice Original: ${voiceDuration}s)`);
        
        // Generate Output Filename
        dailyCount++;
        const filename = `${ddmmyyyy}_${getTimeString()}_${dailyCount}.mp4`;
        const outputVideoPath = path.join(outputDir, filename);

        // Generate Title Image
        const titleImagePath = path.join(outputDir, `${ddmmyyyy}_${getTimeString()}_${dailyCount}_title.png`);
        const titleText = video.title || `Video ${index + 1}`;
        await generateTitleImage(titleText, titleImagePath);
        
        // Add titleImage to inputs
        inputs.titleImage = titleImagePath;

        // Render target
        const ffmpegCommand = generateFFmpegCommand(inputs, outputVideoPath, targetDuration);
        const success = await executeFFmpeg(ffmpegCommand);

        if (success && fs.existsSync(outputVideoPath)) {
            const stats = await fsPromises.stat(outputVideoPath);
            console.log(`   ✅ Success! Rendered: ${outputVideoPath}`);
            console.log(`   📏 Final Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
            // Update specific status
            video.status = "done";
            video.outputPath = outputVideoPath;
            
            // Clean up temporary title image
            try {
                await fsPromises.unlink(titleImagePath);
            } catch (e) {
                // Ignore cleanup errors
            }
        } else {
            console.log(`   ❌ Failed to render video ${index + 1}.`);
            video.status = "error";
        }
    }

    // Save progress explicitly
    await fsPromises.writeFile(CONFIG.files.videosJson, JSON.stringify(videosData, null, 2));
    console.log(`\n💾 Saved updated progress to ${CONFIG.files.videosJson}`);
}

// ==========================================
// 🚀 ENTRY POINT
// ==========================================
async function main() {
    console.log(`\n�� VIDEO BATCH PROCESSOR STARTED @ ${new Date().toLocaleString()}`);
    try {
        await processBatch();
    } catch (error) {
        console.error("❌ Fatal application error:", error);
        process.exit(1);
    }
    console.log(`🎉 All processing cycles completed!\n`);
}

main();
