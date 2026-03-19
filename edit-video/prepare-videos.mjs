import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { getPathConfig } from "./config-loader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pathConfig = getPathConfig();

// Paths
const VIDEOS_JSON_PATH = path.join(__dirname, "videos.json");

// Output directory structure logic - use YESTERDAY's date to match crawler
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const dd = String(yesterday.getDate()).padStart(2, '0');
const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
const yyyy = yesterday.getFullYear();
const ddmmyyyy = `${dd}${mm}${yyyy}`;
const baseDir = path.join(pathConfig.outputDir, ddmmyyyy);

function generateVideosJson() {
    console.log(`\n========================================`);
    console.log(`📝 PREPARING videos.json FOR RENDERING`);
    console.log(`========================================`);
    
    if (!fs.existsSync(baseDir)) {
        console.error(`❌ Output directory doesn't exist yet: ${baseDir}`);
        console.log(`⚠️ Make sure the Python crawler has downloaded videos for yesterday.`);
        return;
    }

    const subfolders = fs.readdirSync(baseDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    if (subfolders.length === 0) {
        console.log(`⏭️ No folders found for target day (${ddmmyyyy}). Nothing to prepare.`);
        return;
    }

    let existingVideos = [];
    if (fs.existsSync(VIDEOS_JSON_PATH)) {
        try {
            existingVideos = JSON.parse(fs.readFileSync(VIDEOS_JSON_PATH, "utf8"));
        } catch (e) {
            console.log("⚠️ Could not parse existing videos.json, starting fresh.");
        }
    }

    const newVideosList = [];
    let count = 0;

    for (const folderName of subfolders) {
        const folderPath = path.join(baseDir, folderName);
        const jsonPath = path.join(folderPath, "generated-content.json");
        const wavPath = path.join(folderPath, "output.wav");

        // Check if both content and voice are ready
        if (fs.existsSync(jsonPath) && fs.existsSync(wavPath)) {
            try {
                const contentData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
                const title = contentData.Title || `Bản tin ngắn ngày ${ddmmyyyy}`;

                // Find MP4 file (recursive check in case of JDownloader subfolders)
                let mp4Path = "";
                const scanForVideo = (dir) => {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isFile() && entry.name.endsWith('.mp4')) {
                            return fullPath;
                        } else if (entry.isDirectory()) {
                            const found = scanForVideo(fullPath);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                
                mp4Path = scanForVideo(folderPath) || "";

                // Look for existing entry by checking if the voiceLink points to this wavPath
                const existingEntry = existingVideos.find(v => v.voiceLink === wavPath);
                
                if (existingEntry && existingEntry.status === "done") {
                    newVideosList.push(existingEntry); // Keep state (e.g. status: "done")
                } else {
                    newVideosList.push({
                        "title": title,
                        "videoLink": mp4Path,     // Added videoLink properly
                        "voiceLink": wavPath,     // Mandatory generated voice
                        "soundLink": "",          // Optional fallback
                        "imageLink": "",          
                        "status": "not yet",
                        "outputPath": ""
                    });
                    count++;
                }
            } catch (err) {
                console.error(`❌ Error reading JSON from ${folderName}: ${err.message}`);
            }
        }
    }

    fs.writeFileSync(VIDEOS_JSON_PATH, JSON.stringify(newVideosList, null, 2), "utf8");
    console.log(`✅ videos.json prepared successfully! (${count} new videos added, total: ${newVideosList.length})`);
}

generateVideosJson();
