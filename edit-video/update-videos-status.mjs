import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_JSON = path.join(__dirname, "videos.json");
const OUTPUT_DIR = "/Users/nguyendinhhuy/Documents/Edit Video/Thời Sự/17032026";

let videos = JSON.parse(fs.readFileSync(VIDEOS_JSON, "utf8"));

// Map output files to render order
const outputFiles = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.match(/^\d{8}_\d{6}_\d+\.mp4$/))
    .sort();

console.log("Found rendered videos:", outputFiles);

// Update videos.json with output paths
for (let i = 0; i < videos.length && i < outputFiles.length; i++) {
    const outputPath = path.join(OUTPUT_DIR, outputFiles[i]);
    videos[i].status = "done";
    videos[i].outputPath = outputPath;
    console.log(`Video ${i+1}: ${outputPath}`);
}

fs.writeFileSync(VIDEOS_JSON, JSON.stringify(videos, null, 2), "utf8");
console.log("✅ videos.json updated with rendered output paths!");
