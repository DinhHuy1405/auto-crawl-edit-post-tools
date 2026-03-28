/**
 * TikTok Upload from JSON Database
 * Upload videos lên TikTok từ JSON database thay vì Google Sheet
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const DATABASE_PATH = path.join(__dirname, 'videos-database.json');

// Load video database functions
import { 
    loadDatabase, 
    saveDatabase, 
    getVideosForTiktok,
    updateTiktokStatus 
} from './video-database.mjs';

// Hàm tạo ID video theo format ddmmyy_time_số thứ tự
function generateTiktokVideoId(sequenceNumber) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${day}${month}${year}_${hours}${minutes}${seconds}_${String(sequenceNumber).padStart(3, '0')}`;
}

// Hàm tạo file setting cho TikTok upload
function createTiktokSetting(videoPath, description, outputPath) {
    const setting = {
        "show_browser": CONFIG.settings?.show_browser ?? true,
        "is_close_browser": true,
        "video_path": videoPath,
        "description": description,
        "audience": CONFIG.tiktok.audience || "Everyone",
        "is_ai_generated": false,
        "run_copyright_check": false,
        "is_comment_on": CONFIG.tiktok.enable_comments !== false,
        "is_duet_on": CONFIG.tiktok.enable_duet === true,
        "is_stitch_on": CONFIG.tiktok.enable_stitch === true
    };

    fs.writeFileSync(outputPath, JSON.stringify(setting, null, 2));
    return outputPath;
}

// Hàm upload video lên TikTok
async function uploadVideoToTiktok(video, videoId) {
    try {
        console.log(`\n🚀 Uploading: ${video.title}`);
        console.log(`📝 Description: ${video.description}`);
        console.log(`🆔 Video ID: ${videoId}`);
        console.log(`📁 File: ${video.file_path}`);

        // Kiểm tra file tồn tại
        if (!fs.existsSync(video.file_path)) {
            throw new Error(`Video file not found: ${video.file_path}`);
        }

        // Tạo file setting tạm
        const settingPath = `./temp_tiktok_setting_${videoId}.json`;
        createTiktokSetting(video.file_path, video.title, settingPath);

        // Thực hiện upload bằng tool có sẵn
        const absoluteSettingPath = path.resolve(settingPath);
        const uploadCommand = `node dist/main.js post-tiktok "${absoluteSettingPath}"`;
        
        console.log(`⚙️ Executing: ${uploadCommand}`);
        
        const stdout = execSync(uploadCommand, { 
            stdio: 'pipe',
            timeout: CONFIG.settings.upload_timeout * 1000,
            cwd: path.join(__dirname, CONFIG.directories.social_tool_path)
        }).toString();

        // Xóa file setting tạm
        if (fs.existsSync(settingPath)) {
            fs.unlinkSync(settingPath);
        }

        console.log(`✅ Upload success for video ID: ${videoId}`);
        console.log(`Output: ${stdout}`);
        
        return { success: true, video_id: videoId, output: stdout };
        
    } catch (error) {
        console.error(`❌ Upload failed for video ID ${videoId}:`, error.message);
        
        // Xóa file setting tạm nếu có lỗi
        const settingPath = `./temp_tiktok_setting_${videoId}.json`;
        if (fs.existsSync(settingPath)) {
            fs.unlinkSync(settingPath);
        }
        
        return { success: false, error: error.message };
    }
}

// Hàm chính upload batch hoặc video cụ thể
async function uploadBatchToTiktok(specificVideoId = null) {
    try {
        console.log('🚀 Starting TikTok upload from JSON database...');
        
        if (specificVideoId) {
            console.log(`🎯 Uploading specific video: ${specificVideoId}`);
        }
        
        console.log('=========================================================');
        
        // Load videos cần upload TikTok
        let videosToUpload = getVideosForTiktok(uploadDate);
        
        // Nếu có specificVideoId, chỉ upload video đó
        if (specificVideoId) {
            videosToUpload = videosToUpload.filter(v => v.id === specificVideoId);
            
            if (videosToUpload.length === 0) {
                console.log(`❌ Video ${specificVideoId} not found or not ready for TikTok upload!`);
                return;
            }
        }
        
        if (!videosToUpload || videosToUpload.length === 0) {
            console.log('❌ No videos found for TikTok upload!');
            console.log('Condition: status = "ready" AND tiktok.uploaded = false AND file exists');
            return;
        }

        console.log(`📊 Found ${videosToUpload.length} videos to upload:`);
        videosToUpload.forEach((video, index) => {
            console.log(`${index + 1}. ${video.title} (${video.file_path})`);
        });

        // Start upload immediately without confirmation
        console.log('\n▶️  Starting upload now...');

        // Thực hiện upload từng video
        let sequenceNumber = 1;
        let successCount = 0;
        let failCount = 0;

        for (const video of videosToUpload) {
            const videoId = generateTiktokVideoId(sequenceNumber);
            
            console.log(`\n📹 [${sequenceNumber}/${videosToUpload.length}] Processing...`);
            console.log(`🔄 Video: ${video.title}`);
            
            const result = await uploadVideoToTiktok(video, videoId);

            // Cập nhật status trong database
            if (result.success) {
                updateTiktokStatus(video.id, true, { 
                    video_id: result.video_id,
                    output: result.output 
                });
                successCount++;
            } else {
                updateTiktokStatus(video.id, false, { 
                    error: result.error 
                });
                failCount++;
            }

            sequenceNumber++;
            
            // No delay between videos - upload quickly
            if (sequenceNumber <= videosToUpload.length) {
                console.log(`⏳ Preparing next video...`);
            }
        }

        console.log(`\n🎉 TikTok batch upload completed!`);
        console.log(`✅ Success: ${successCount} videos`);
        console.log(`❌ Failed: ${failCount} videos`);

        // Show updated statistics
        const db = loadDatabase();
        if (db && Array.isArray(db)) {
            const stats = {
                total: db.length,
                tiktok_uploaded: db.filter(v => v.tiktok?.uploaded).length,
                facebook_uploaded: db.filter(v => v.facebook?.uploaded).length,
                threads_uploaded: db.filter(v => v.threads?.uploaded).length,
                pending_tiktok: db.filter(v => !v.tiktok?.uploaded).length
            };
            
            console.log('\n📊 Updated Statistics:');
            console.log(`📹 Total videos: ${stats.total}`);
            console.log(`📱 TikTok uploaded: ${stats.tiktok_uploaded}`);
            console.log(`📘 Facebook uploaded: ${stats.facebook_uploaded}`);
            console.log(`🎵 Threads uploaded: ${stats.threads_uploaded}`);
        }

    } catch (error) {
        console.error('❌ Error in TikTok batch upload:', error);
        process.exit(1);
    }
}

// Parse args: --date YYYY-MM-DD
const _ttArgs = process.argv.slice(2);
const _ttDateIdx = _ttArgs.indexOf('--date');
const uploadDate = _ttDateIdx !== -1 ? _ttArgs[_ttDateIdx + 1] : null;
const specificVideoId = _ttArgs.find(a => !a.startsWith('--') && a !== (_ttDateIdx !== -1 ? _ttArgs[_ttDateIdx + 1] : null)) ?? null;

console.log('🎬 TikTok Upload from JSON Database');
console.log('===================================');

uploadBatchToTiktok(specificVideoId)
    .then(() => {
        console.log('🏁 TikTok upload script completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 TikTok upload script failed:', error);
        process.exit(1);
    });