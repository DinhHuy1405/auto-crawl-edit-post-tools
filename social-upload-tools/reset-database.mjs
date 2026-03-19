import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "videos-database.json");

const newVideos = [
    {
        "id": "vid_1773814530800_001",
        "type": "video",
        "video_name": "Tây Ban Nha Lên Tiếng, Cục Diện Trung Đông Báo Động Đỏ",
        "title": "Tây Ban Nha Lên Tiếng, Cục Diện Trung Đông Báo Động Đỏ",
        "description": "Tây Ban Nha Lên Tiếng, Cục Diện Trung Đông Báo Động Đỏ #tintuc #thethao #giaitri #news #xuhuong2026 #capnhat #thoisu",
        "file_path": "/Users/nguyendinhhuy/Documents/Edit Video/Thời Sự/17032026/17032026_231752_3.mp4",
        "status": "ready",
        "created_at": new Date().toISOString(),
        "facebook": { "uploaded": false },
        "tiktok": { "uploaded": false },
        "threads": { "uploaded": false },
        "youtube": { "uploaded": false }
    },
    {
        "id": "vid_1773814530800_002",
        "type": "video",
        "video_name": "Thủ tướng Netanyahu và nghi vấn AI: Niềm tin lung lay trước Deepfake",
        "title": "Thủ tướng Netanyahu và nghi vấn AI: Niềm tin lung lay trước Deepfake",
        "description": "Thủ tướng Netanyahu và nghi vấn AI: Niềm tin lung lay trước Deepfake #tintuc #thethao #giaitri #news #xuhuong2026 #capnhat #thoisu",
        "file_path": "/Users/nguyendinhhuy/Documents/Edit Video/Thời Sự/17032026/17032026_231931_4.mp4",
        "status": "ready",
        "created_at": new Date().toISOString(),
        "facebook": { "uploaded": false },
        "tiktok": { "uploaded": false },
        "threads": { "uploaded": false },
        "youtube": { "uploaded": false }
    },
    {
        "id": "vid_1773814530800_003",
        "type": "video",
        "video_name": "Trung Đông Rực Lửa: Xung Đột Leo Thang, Mỹ Và Đồng Minh Chia Rẽ Sâu Sắc",
        "title": "Trung Đông Rực Lửa: Xung Đột Leo Thang, Mỹ Và Đồng Minh Chia Rẽ Sâu Sắc",
        "description": "Trung Đông Rực Lửa: Xung Đột Leo Thang, Mỹ Và Đồng Minh Chia Rẽ Sâu Sắc #tintuc #thethao #giaitri #news #xuhuong2026 #capnhat #thoisu",
        "file_path": "/Users/nguyendinhhuy/Documents/Edit Video/Thời Sự/17032026/17032026_232109_5.mp4",
        "status": "ready",
        "created_at": new Date().toISOString(),
        "facebook": { "uploaded": false },
        "tiktok": { "uploaded": false },
        "threads": { "uploaded": false },
        "youtube": { "uploaded": false }
    }
];

fs.writeFileSync(DB_PATH, JSON.stringify(newVideos, null, 2), "utf8");
console.log("✅ Database reset! Only 3 new videos retained (ready for upload)");
