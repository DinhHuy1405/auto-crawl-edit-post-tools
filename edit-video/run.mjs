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
const FORCE_RERENDER = process.argv.includes('--force');
if (FORCE_RERENDER) console.log("⚡ --force mode: will re-render videos with status 'done'");

// --reset-status: reset all non-skip videos back to 'not yet' before rendering
const RESET_STATUS = process.argv.includes('--reset-status');
if (RESET_STATUS) {
    try {
        const videosJsonPath = path.join(__dirname, "videos.json");
        if (fs.existsSync(videosJsonPath)) {
            const data = JSON.parse(fs.readFileSync(videosJsonPath, "utf8"));
            const reset = data.map(v => v.skip ? v : { ...v, status: "not yet" });
            fs.writeFileSync(videosJsonPath, JSON.stringify(reset, null, 2), "utf8");
            const count = reset.filter(v => !v.skip).length;
            console.log(`🔄 Reset status for ${count} video(s) to 'not yet' (skipped videos preserved)`);
        }
    } catch (e) {
        console.error("⚠️ Could not reset videos.json status:", e.message);
    }
}

const CONFIG = {
    files: {
        videosJson: path.join(__dirname, "videos.json"),
        defaultMainVideo: path.join(__dirname, SHARED_CONFIG.paths.templateDir, SHARED_CONFIG.templates.mainVideo),
        defaultTemplateVideo: path.join(__dirname, SHARED_CONFIG.paths.templateDir, SHARED_CONFIG.templates.templateVideo),
        defaultSoundAudio: path.isAbsolute(SHARED_CONFIG.templates.backgroundMusic)
            ? SHARED_CONFIG.templates.backgroundMusic
            : path.join(__dirname, SHARED_CONFIG.paths.publicDir, SHARED_CONFIG.templates.backgroundMusic),
        logo: path.isAbsolute(SHARED_CONFIG.templates.logo)
            ? SHARED_CONFIG.templates.logo
            : path.join(__dirname, SHARED_CONFIG.paths.publicDir, SHARED_CONFIG.templates.logo)
    },
    output: {
        baseDir: SHARED_CONFIG.paths.outputDir,
        maxDurationSec: SHARED_CONFIG.video.maxDurationSec
    },
    layout: SHARED_CONFIG.layout,
    audio: SHARED_CONFIG.audio,
    video: SHARED_CONFIG.video,
    fx: SHARED_CONFIG.fx || {}
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
// 🎞️ SOURCE MODE — builds FFmpeg main video input args + filter segment
// ==========================================

/**
 * Returns { inputArgs: string, filterSegment: string, outputLabel: string }
 * inputArgs  — the -ss/-i flags for the main video input(s)
 * filterSegment — filter_complex lines to produce [trimmed_main_video]
 * For random_clips / multi_clip modes multiple inputs are concatenated.
 */
async function buildMainVideoSource(mainVideoPath, targetDuration) {
    const sm = SHARED_CONFIG.sourceMode || {};
    const mode = sm.mode || 'sequential';

    if (mode === 'sequential') {
        const skip = sm.sequential?.skipSec ?? SHARED_CONFIG.layout?.mainVideoSkip ?? 180;
        return {
            inputArgs: `-ss ${skip} -i "${mainVideoPath}"`,
            filterSegment: `[0:v]trim=start=0:duration=${targetDuration},setpts=PTS-STARTPTS[trimmed_main_video];\n[0:a]atrim=start=0:duration=${targetDuration},asetpts=PTS-STARTPTS,volume=${SHARED_CONFIG.audio.volumes.mainVideo}[main_audio_proc]`,
            extraInputCount: 0,
        };
    }

    if (mode === 'first_n') {
        const dur = sm.firstN?.durationSec ?? targetDuration;
        return {
            inputArgs: `-i "${mainVideoPath}"`,
            filterSegment: `[0:v]trim=start=0:duration=${Math.min(dur, targetDuration)},setpts=PTS-STARTPTS[trimmed_main_video];\n[0:a]atrim=start=0:duration=${Math.min(dur, targetDuration)},asetpts=PTS-STARTPTS,volume=${SHARED_CONFIG.audio.volumes.mainVideo}[main_audio_proc]`,
            extraInputCount: 0,
        };
    }

    if (mode === 'custom_range') {
        const start = sm.customRange?.startSec ?? 0;
        const end = sm.customRange?.endSec ?? targetDuration;
        const clipDur = Math.min(end - start, targetDuration);
        return {
            inputArgs: `-ss ${start} -t ${clipDur} -i "${mainVideoPath}"`,
            filterSegment: `[0:v]trim=start=0:duration=${clipDur},setpts=PTS-STARTPTS[trimmed_main_video];\n[0:a]atrim=start=0:duration=${clipDur},asetpts=PTS-STARTPTS,volume=${SHARED_CONFIG.audio.volumes.mainVideo}[main_audio_proc]`,
            extraInputCount: 0,
        };
    }

    if (mode === 'random_clips' || mode === 'multi_clip') {
        // Get total duration of main video to pick valid random ranges
        const totalDur = await getMediaDurationInSeconds(mainVideoPath);
        let clips = [];

        if (mode === 'multi_clip' && Array.isArray(sm.multiClip?.clips) && sm.multiClip.clips.length > 0) {
            clips = sm.multiClip.clips; // [{ startSec, durationSec }, ...]
        } else {
            // random_clips: pick random non-overlapping segments
            const minClip = sm.randomClips?.minClipSec ?? 8;
            const maxClip = sm.randomClips?.maxClipSec ?? 20;
            const avoidFirst = sm.randomClips?.avoidFirstSec ?? 60;
            const avoidLast = sm.randomClips?.avoidLastSec ?? 30;
            const safeStart = avoidFirst;
            const safeEnd = Math.max(safeStart + maxClip, totalDur - avoidLast);

            let remaining = targetDuration;
            let usedRanges = [];
            let attempts = 0;
            while (remaining > 0 && attempts < 200) {
                attempts++;
                const clipDur = Math.min(remaining, minClip + Math.floor(Math.random() * (maxClip - minClip + 1)));
                const maxStart = safeEnd - clipDur;
                if (maxStart <= safeStart) break;
                const start = safeStart + Math.floor(Math.random() * (maxStart - safeStart));
                // Check no overlap with existing clips (avoid reuse)
                const overlaps = usedRanges.some(r => start < r.end && (start + clipDur) > r.start);
                if (!overlaps) {
                    clips.push({ startSec: start, durationSec: clipDur });
                    usedRanges.push({ start, end: start + clipDur });
                    remaining -= clipDur;
                }
            }
            // Sort clips chronologically for natural flow
            clips.sort((a, b) => a.startSec - b.startSec);
        }

        if (clips.length === 0) {
            // Fallback to sequential
            console.warn('   ⚠️ No clips generated for random mode, falling back to sequential');
            return {
                inputArgs: `-ss 60 -i "${mainVideoPath}"`,
                filterSegment: `[0:v]trim=start=0:duration=${targetDuration},setpts=PTS-STARTPTS[trimmed_main_video];\n[0:a]atrim=start=0:duration=${targetDuration},asetpts=PTS-STARTPTS,volume=${SHARED_CONFIG.audio.volumes.mainVideo}[main_audio_proc]`,
                extraInputCount: 0,
            };
        }

        // Each clip is a separate -ss -t -i input starting at index 0..N-1
        // All share the same mainVideoPath — FFmpeg handles separate seeks per input
        const inputArgs = clips.map(c => `-ss ${c.startSec} -t ${c.durationSec} -i "${mainVideoPath}"`).join(' ');

        // Build concat filter: [0:v][1:v]...[N:v] concat=n=N:v=1:a=1
        const n = clips.length;
        const vLabels = clips.map((_, i) => `[${i}:v]`).join('');
        const aLabels = clips.map((_, i) => `[${i}:a]`).join('');
        const filterSegment = `${vLabels}concat=n=${n}:v=1:a=0[trimmed_main_video];\n${aLabels}concat=n=${n}:v=0:a=1[concat_audio];\n[concat_audio]atrim=start=0:duration=${targetDuration},asetpts=PTS-STARTPTS,volume=${SHARED_CONFIG.audio.volumes.mainVideo}[main_audio_proc]`;

        return {
            inputArgs,
            filterSegment,
            extraInputCount: n, // clips.length inputs used for main video (indices 0..n-1)
        };
    }

    // Default fallback
    return {
        inputArgs: `-ss 180 -i "${mainVideoPath}"`,
        filterSegment: `[0:v]trim=start=0:duration=${targetDuration},setpts=PTS-STARTPTS[trimmed_main_video];\n[0:a]atrim=start=0:duration=${targetDuration},asetpts=PTS-STARTPTS,volume=${SHARED_CONFIG.audio.volumes.mainVideo}[main_audio_proc]`,
        extraInputCount: 0,
    };
}

// ==========================================
// 🎬 FFMPEG PIPELINE
// ==========================================
async function generateFFmpegCommand(inputs, outputVideo, duration) {
    const { mainVideo, templateVideo, soundAudio, voiceAudio, logo, titleImage } = inputs;
    const {
        templateX, templateY,
        templateW = 1440, templateH = -1,
        logoX, logoY,
        logoW: cfgLogoW, logoH: cfgLogoH, logoScale,
        titleX = 0, titleY = 1150, titleW = 1440, titleH = 300, titleDuration = 5,
    } = CONFIG.layout;
    const [logoW, logoH] = (cfgLogoW && cfgLogoH)
        ? [cfgLogoW, cfgLogoH]
        : logoScale.split(":").map(Number);

    // ── Source Mode: build main video input args + filter segment ──────────────
    const sourceResult = await buildMainVideoSource(mainVideo, duration);
    const { inputArgs: mainInputArgs, filterSegment: mainFilterSegment, extraInputCount } = sourceResult;

    // Input index offset: main video occupies indices 0..(extraInputCount-1) for multi-clip,
    // or just index 0 for single-input modes.
    // After main video inputs: templateVideo, soundAudio, voiceAudio, [titleImage], logo
    const tplIdx   = extraInputCount > 0 ? extraInputCount     : 1;
    const musicIdx = tplIdx + 1;
    const voiceIdx = musicIdx + 1;
    // title and logo indices depend on whether titleImage exists
    const titleIdx = voiceIdx + 1;
    const logoIdx  = titleImage && fs.existsSync(titleImage) ? titleIdx + 1 : titleIdx;

    const filterComplexParts = [];

    // 1. Main video (from source mode) — produces [trimmed_main_video] and [main_audio_proc]
    filterComplexParts.push(mainFilterSegment);

    // 2. Audio: music + voice (main audio already handled inside mainFilterSegment)
    const musicVol = CONFIG.audio.volumes.backgroundMusic;
    const voiceVol = CONFIG.audio.volumes.voiceNarration;
    filterComplexParts.push(
        `[${musicIdx}:a]atrim=start=0:duration=${duration},asetpts=PTS-STARTPTS[sound_trimmed]`,
        `[sound_trimmed]volume=${musicVol}[processed_sound]`,
        `[${voiceIdx}:a]atrim=start=0:duration=${duration},asetpts=PTS-STARTPTS[voice_trimmed]`,
        `[voice_trimmed]volume=${voiceVol}[processed_voice]`
    );

    // 3. Template video with blur zones
    const blurZones = Array.isArray(CONFIG.blurZones) ? CONFIG.blurZones : (Array.isArray(CONFIG.layout.blurZones) ? CONFIG.layout.blurZones : []);
    filterComplexParts.push(`[${tplIdx}:v]scale=${templateW}:${templateH}[scaled_template]`);

    if (blurZones.length === 0) {
        filterComplexParts.push(`[scaled_template]null[final_blurred_template]`);
    } else {
        const splitCount = blurZones.length + 1;
        const splitLabels = [`[orig_template]`, ...blurZones.map((_, i) => `[blur_in_${i}]`)].join('');
        filterComplexParts.push(`[scaled_template]split=${splitCount}${splitLabels}`);
        blurZones.forEach((zone, i) => {
            const cropX = Math.max(0, zone.x), cropY = Math.max(0, zone.y);
            filterComplexParts.push(
                `[blur_in_${i}]gblur=sigma=${zone.sigma}[blurred_full_${i}]`,
                `[blurred_full_${i}]crop=w=${zone.w}:h=${zone.h}:x=${cropX}:y=${cropY}[blurred_crop_${i}]`
            );
        });
        blurZones.forEach((zone, i) => {
            const inStream  = i === 0 ? 'orig_template' : `temp_tpl_${i - 1}`;
            const outStream = i === blurZones.length - 1 ? 'final_blurred_template' : `temp_tpl_${i}`;
            filterComplexParts.push(
                `[${inStream}][blurred_crop_${i}]overlay=x=${Math.max(0,zone.x)}:y=${Math.max(0,zone.y)}[${outStream}]`
            );
        });
    }

    // 4. Composite: main + template
    filterComplexParts.push(
        `[trimmed_main_video][final_blurred_template]overlay=x=${templateX}:y=${templateY}[video_with_template]`
    );

    // 4b. FX: color grading (eq), fade, vignette applied to composite
    const fx = CONFIG.fx || {};
    let fxStream = 'video_with_template';

    // Speed
    const speed = (typeof fx.speed === 'number' && isFinite(fx.speed)) ? fx.speed : 1;
    if (speed !== 1) {
        const pts = (1 / speed).toFixed(4);
        filterComplexParts.push(`[${fxStream}]setpts=${pts}*PTS[fxspeed_video]`);
        fxStream = 'fxspeed_video';
        filterComplexParts.push(`[main_audio_proc]atempo=${speed}[main_audio_proc_speed]`);
    }

    // Color grading — only apply eq if any value differs from default
    const brightness = (typeof fx.brightness === 'number' && isFinite(fx.brightness)) ? fx.brightness : 0;
    const contrast   = (typeof fx.contrast   === 'number' && isFinite(fx.contrast))   ? fx.contrast   : 1;
    const saturation = (typeof fx.saturation === 'number' && isFinite(fx.saturation)) ? fx.saturation : 1;
    if (brightness !== 0 || contrast !== 1 || saturation !== 1) {
        filterComplexParts.push(
            `[${fxStream}]eq=brightness=${brightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}[fxeq_video]`
        );
        fxStream = 'fxeq_video';
    }

    // Fade in/out
    const fadeIn  = (typeof fx.fadeInDur  === 'number' && fx.fadeInDur  > 0) ? fx.fadeInDur  : 0;
    const fadeOut = (typeof fx.fadeOutDur === 'number' && fx.fadeOutDur > 0) ? fx.fadeOutDur : 0;
    if (fadeIn > 0) {
        filterComplexParts.push(`[${fxStream}]fade=t=in:st=0:d=${fadeIn}[fxfadein_video]`);
        fxStream = 'fxfadein_video';
    }
    if (fadeOut > 0) {
        filterComplexParts.push(`[${fxStream}]fade=t=out:st=${duration - fadeOut}:d=${fadeOut}[fxfadeout_video]`);
        fxStream = 'fxfadeout_video';
    }

    // Vignette
    if (fx.vignette === true) {
        filterComplexParts.push(`[${fxStream}]vignette[fxvignette_video]`);
        fxStream = 'fxvignette_video';
    }

    const mainAudioLabel = speed !== 1 ? 'main_audio_proc_speed' : 'main_audio_proc';

    // 5. Title overlay
    let videoStream = fxStream;
    if (titleImage && fs.existsSync(titleImage)) {
        filterComplexParts.push(
            `[${fxStream}][${titleIdx}:v]overlay=x=${titleX}:y=${titleY}:enable='between(t,0,${titleDuration})'[video_with_title]`
        );
        videoStream = 'video_with_title';
    }

    // 6. Logo overlay
    filterComplexParts.push(
        `[${logoIdx}:v]scale=${logoW}:${logoH},format=rgba[scaled_logo]`,
        `[${videoStream}][scaled_logo]overlay=x=${logoX}:y=${logoY}:enable='between(t,0,${duration})'[final_video_output_stream]`
    );

    // 7. Audio mix
    filterComplexParts.push(
        `[${mainAudioLabel}][processed_sound][processed_voice]amix=inputs=3:duration=longest[outa]`
    );

    const filterComplex = filterComplexParts.join(";");

    // Build full input string
    let inputsStr = `-y ${mainInputArgs} -i "${templateVideo}" -stream_loop -1 -i "${soundAudio}" -i "${voiceAudio}"`;
    if (titleImage && fs.existsSync(titleImage)) inputsStr += ` -i "${titleImage}"`;
    inputsStr += ` -i "${logo}"`;

    const sm = SHARED_CONFIG.sourceMode?.mode ?? 'sequential';
    console.log(`   🎞️  Source mode: ${sm} | clips: ${extraInputCount > 1 ? extraInputCount : 1}`);

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
        
        if (video.skip) {
            console.log(`   ⏭️ Marked as skip. Skipping...`);
            continue;
        }

        if (video.status && video.status.toLowerCase() === "done" && !FORCE_RERENDER) {
            console.log(`   ⏭️ Status is 'done'. Skipping... (use --force to re-render)`);
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
        const ffmpegCommand = await generateFFmpegCommand(inputs, outputVideoPath, targetDuration);
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
