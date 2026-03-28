/**
 * Facebook Upload from JSON Database
 * Upload videos lên Facebook từ JSON database thay vì Google Sheet
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
    getVideosForFacebook,
    updateFacebookStatus 
} from './video-database.mjs';

// Hàm tạo file setting cho Facebook upload
function createFacebookSetting(videoPath, description, page, outputPath, profileId = null) {
    const setting = {
        show_browser: CONFIG.settings?.show_browser ?? true,
        is_close_browser: true,
        video_path: videoPath,
        description: description
    };
    
    // Use profile_id if available, otherwise use page name
    if (profileId) {
        setting.profile_id = profileId;
    } else {
        setting.page = page || CONFIG.facebook.page_name || "Default Page";
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(setting, null, 2));
    return outputPath;
}

// Hàm upload video lên Facebook
async function uploadVideoToFacebook(video) {
    try {
        console.log(`\n🚀 Uploading: ${video.title}`);
        console.log(`📝 Description: ${video.description}`);
        console.log(`📁 File: ${video.file_path}`);

        // Kiểm tra file tồn tại
        if (!fs.existsSync(video.file_path)) {
            throw new Error(`Video file not found: ${video.file_path}`);
        }

        // Tạo file setting tạm
        const settingPath = path.resolve(`/tmp/fb-setting-${video.id}.json`);
        createFacebookSetting(
            video.file_path,
            video.title,
            CONFIG.facebook.page_name,
            settingPath,
            CONFIG.facebook.profile_id
        );

        console.log(`⚙️ Created setting file: ${settingPath}`);

        // Thực hiện upload bằng tool có sẵn
        const uploadCommand = `node dist/main.js post-reels-facebook "${settingPath}"`;
        console.log(`⚙️ Executing: ${uploadCommand}`);
        
        const stdout = execSync(uploadCommand, {
            stdio: 'pipe',
            timeout: CONFIG.settings.upload_timeout * 1000,
            cwd: path.join(__dirname, CONFIG.directories.social_tool_path)
        }).toString();

        // Extract Facebook ID from output if available
        let fbId = null;
        const match = stdout.match(/id=(\d+)/);
        if (match && match[1]) {
            fbId = match[1];
        } else {
            // Create fallback ID
            fbId = `fb_${Date.now()}_${video.id}`;
        }

        // Xóa file setting tạm
        if (fs.existsSync(settingPath)) {
            fs.unlinkSync(settingPath);
        }

        console.log(`✅ Upload success for video: ${video.title}`);
        console.log(`🆔 Facebook ID: ${fbId}`);
        console.log(`Output: ${stdout}`);
        
        return { success: true, reel_id: fbId, output: stdout };
        
    } catch (error) {
        console.error(`❌ Upload failed for video: ${video.title}`, error.message);
        
        // Create fallback ID even on error để tránh retry
        const fallbackId = `fb_error_${Date.now()}_${video.id}`;
        
        // Xóa file setting tạm nếu có lỗi
        const settingPath = `/tmp/fb-setting-${video.id}.json`;
        if (fs.existsSync(settingPath)) {
            fs.unlinkSync(settingPath);
        }
        
        return { 
            success: false, 
            error: error.message,
            reel_id: fallbackId // Fallback ID to prevent retries
        };
    }
}

// Hàm chính upload batch hoặc video cụ thể
async function uploadBatchToFacebook(specificVideoId = null) {
    try {
        console.log('🚀 Starting Facebook upload from JSON database...');
        
        if (specificVideoId) {
            console.log(`🎯 Uploading specific video: ${specificVideoId}`);
        }
        
        console.log('=======================================================');
        
        // Load videos cần upload Facebook
        let videosToUpload = getVideosForFacebook(uploadDate);
        
        // Nếu có specificVideoId, chỉ upload video đó
        if (specificVideoId) {
            videosToUpload = videosToUpload.filter(v => v.id === specificVideoId);
            
            if (videosToUpload.length === 0) {
                console.log(`❌ Video ${specificVideoId} not found or not ready for Facebook upload!`);
                return;
            }
        }
        
        if (!videosToUpload || videosToUpload.length === 0) {
            console.log('❌ No videos found for Facebook upload!');
            console.log('Condition: status = "ready" AND facebook.uploaded = false AND file exists');
            return;
        }

        console.log(`📊 Found ${videosToUpload.length} videos to upload:`);
        videosToUpload.forEach((video, index) => {
            console.log(`${index + 1}. ${video.title} (${video.file_path})`);
        });

        // Start upload immediately without confirmation
        console.log('\n▶️  Starting upload now...');

        // Thực hiện upload từng video
        let successCount = 0;
        let failCount = 0;

        for (const [index, video] of videosToUpload.entries()) {
            console.log(`\n📹 [${index + 1}/${videosToUpload.length}] Processing...`);
            console.log(`🔄 Video: ${video.title}`);
            
            const result = await uploadVideoToFacebook(video);

            // Cập nhật status trong database
            if (result.success) {
                updateFacebookStatus(video.id, true, { 
                    reel_id: result.reel_id,
                    output: result.output 
                });
                successCount++;
                console.log(`✅ Success: ${video.title} -> ${result.reel_id}`);
            } else {
                // Vẫn cập nhật với fallback ID để không bị retry
                updateFacebookStatus(video.id, false, { 
                    reel_id: result.reel_id, // Fallback ID
                    error: result.error 
                });
                failCount++;
                console.log(`❌ Failed: ${video.title} -> ${result.reel_id} (fallback)`);
            }

            // Không cần delay giữa các upload Facebook
            // Facebook tool có thể handle việc này internally
        }

        console.log(`\n🎉 Facebook batch upload completed!`);
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
                pending_facebook: db.filter(v => !v.facebook?.uploaded).length
            };
            
            console.log('\n📊 Updated Statistics:');
            console.log(`📹 Total videos: ${stats.total}`);
            console.log(`📱 TikTok uploaded: ${stats.tiktok_uploaded}`);
            console.log(`📘 Facebook uploaded: ${stats.facebook_uploaded}`);
            console.log(`⏳ Pending TikTok: ${stats.pending_tiktok}`);
            console.log(`⏳ Pending Facebook: ${stats.pending_facebook}`);
        }

    } catch (error) {
        console.error('❌ Error in Facebook batch upload:', error);
        process.exit(1);
    }
}

// Parse args: --date YYYY-MM-DD
const _fbArgs = process.argv.slice(2);
const _fbDateIdx = _fbArgs.indexOf('--date');
const uploadDate = _fbDateIdx !== -1 ? _fbArgs[_fbDateIdx + 1] : null;
const specificVideoId = _fbArgs.find(a => !a.startsWith('--') && a !== (_fbDateIdx !== -1 ? _fbArgs[_fbDateIdx + 1] : null)) ?? null;

console.log('📘 Facebook Upload from JSON Database');
console.log('=====================================');

uploadBatchToFacebook(specificVideoId)
    .then(() => {
        console.log('🏁 Facebook upload script completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Facebook upload script failed:', error);
        process.exit(1);
    });