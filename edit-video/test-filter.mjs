import fs from 'fs';
import path from 'path';

const SHARED_CONFIG = JSON.parse(
    fs.readFileSync(path.join(__dirname || '.', '..', 'config.json'), 'utf8')
);

const CONFIG = {
    files: {
        defaultMainVideo: path.join('.', SHARED_CONFIG.paths.templateDir, SHARED_CONFIG.templates.mainVideo),
        defaultTemplateVideo: path.join('.', SHARED_CONFIG.paths.templateDir, SHARED_CONFIG.templates.templateVideo),
        defaultSoundAudio: path.join('.', SHARED_CONFIG.paths.publicDir, SHARED_CONFIG.templates.backgroundMusic),
        logo: path.join('.', SHARED_CONFIG.paths.publicDir, SHARED_CONFIG.templates.logo)
    },
    layout: SHARED_CONFIG.layout,
    audio: SHARED_CONFIG.audio,
    video: SHARED_CONFIG.video
};

const duration = 160;
const mainVol = CONFIG.audio.volumes.mainVideo;
const musicVol = CONFIG.audio.volumes.backgroundMusic;
const voiceVol = CONFIG.audio.volumes.voiceNarration;
const logoScale = CONFIG.layout.logoScale;
const [logoW, logoH] = logoScale.split(":").map(Number);
const templateX = CONFIG.layout.templateX;
const templateY = CONFIG.layout.templateY;
const logoX = CONFIG.layout.logoX;
const logoY = CONFIG.layout.logoY;

const filterComplexParts = [];

filterComplexParts.push(
    `[0:v]trim=start=0:duration=${duration},setpts=PTS-STARTPTS[trimmed_main_video]`
);

filterComplexParts.push(
    `[0:a]volume=${mainVol}[main_audio_proc]`,
    `[2:a]atrim=start=0:duration=${duration},asetpts=PTS-STARTPTS[sound_trimmed]`,
    `[sound_trimmed]volume=${musicVol}[processed_sound]`,
    `[3:a]atrim=start=0:duration=${duration},asetpts=PTS-STARTPTS[voice_trimmed]`,
    `[voice_trimmed]volume=${voiceVol}[processed_voice]`
);

filterComplexParts.push(
    `[1:v]scale=1440:-1[scaled_template]`,
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

filterComplexParts.push(
    `[trimmed_main_video][final_blurred_template]overlay=x=${templateX}:y=${templateY}[video_with_template]`
);

filterComplexParts.push(
    `[4:v]scale=${logoW}:${logoH},format=rgba[scaled_logo]`,
    `[video_with_template][scaled_logo]overlay=x=${logoX}:y=${logoY}:enable='between(t,0,${duration})'[final_video_output_stream]`
);

filterComplexParts.push(
    `[main_audio_proc][processed_sound][processed_voice]amix=inputs=3:duration=longest[outa]`
);

const filterComplex = filterComplexParts.join(";");

console.log("📊 Audio Volumes:");
console.log("  mainVideo:", mainVol);
console.log("  backgroundMusic:", musicVol);
console.log("  voiceNarration:", voiceVol);
console.log("\n📋 Filter Complex:\n");
console.log(filterComplex);
console.log("\n🎬 amix command line expects 3 inputs: [main_audio_proc][processed_sound][processed_voice]amix=inputs=3");
