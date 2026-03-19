import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths
const RENDERED_JSON_PATH = path.join(__dirname, "../edit-video/videos.json");
const UPLOAD_DB_PATH = path.join(__dirname, "videos-database.json");

function prepareUploadDatabase() {
    console.log(`\n========================================`);
    console.log(`📤 PREPARING videos-database.json FOR UPLOAD`);
    console.log(`========================================`);
    
    if (!fs.existsSync(RENDERED_JSON_PATH)) {
        console.error(`❌ Source videos.json not found: ${RENDERED_JSON_PATH}`);
        return;
    }

    let renderedVideos = [];
    try {
        renderedVideos = JSON.parse(fs.readFileSync(RENDERED_JSON_PATH, "utf8"));
    } catch (e) {
        console.error(`❌ Could not parse rendered videos.json: ${e.message}`);
        return;
    }

    // Only pick videos that are "done" and have an output path
    const readyVideos = renderedVideos.filter(v => v.status === "done" && v.outputPath && fs.existsSync(v.outputPath));

    if (readyVideos.length === 0) {
        console.log(`⏭️ No newly fully-rendered videos found. Data is empty.`);
        return;
    }

    let uploadDb = [];
    if (fs.existsSync(UPLOAD_DB_PATH)) {
        try {
            uploadDb = JSON.parse(fs.readFileSync(UPLOAD_DB_PATH, "utf8"));
        } catch (e) {
            console.log("⚠️ Could not parse existing videos-database.json. Starting fresh.");
        }
    }

    let addedCount = 0;

    for (const render of readyVideos) {
        // Did we already add this file path?
        const alreadyExists = uploadDb.some(v => v.file_path === render.outputPath);
        
        if (!alreadyExists) {
            const safeTitle = render.title.substring(0, 100); // 100 chars max title
            const uniqueId = `vid_${Date.now()}_${Math.floor(Math.random()*1000)}`;
            
            uploadDb.push({
                "id": uniqueId,
                "type": "video",
                "video_name": safeTitle,
                "title": safeTitle,
                "description": `${safeTitle} #tintuc #thethao #giaitri #news #xuhuong2026 #capnhat #thoisu`,
                "file_path": render.outputPath,
                "status": "ready",
                "created_at": new Date().toISOString(),
                "facebook": { "uploaded": false },
                "tiktok": { "uploaded": false },
                "threads": { "uploaded": false },
                "youtube": { "uploaded": false }
            });
            addedCount++;
        }
    }

    fs.writeFileSync(UPLOAD_DB_PATH, JSON.stringify(uploadDb, null, 2), "utf8");
    console.log(`✅ Upload Database prepared! Added ${addedCount} new videos to queue. Total ready videos: ${uploadDb.length}`);
}

prepareUploadDatabase();
