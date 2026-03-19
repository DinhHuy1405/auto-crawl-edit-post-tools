#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const baseDir = "/Users/nguyendinhhuy/Documents/Edit Video/Thời Sự/17032026";

// Get all video folders
const folders = fs.readdirSync(baseDir)
    .filter(name => fs.statSync(path.join(baseDir, name)).isDirectory())
    .slice(0, 1); // Just first 1 for quick test

console.log(`📂 Setting up test data for ${folders.length} folder(s)...`);

for (const folder of folders) {
    const folderPath = path.join(baseDir, folder);
    
    // Create test content JSON
    const testContent = {
        Title: "Test Video - " + folder.substring(0, 30),
        Content: "Đây là một video thử nghiệm được tạo ra để kiểm tra quy trình workflow hoàn chỉnh. Video này chứa âm thanh nền, giọng đọc tTS, và video gốc được trộn lại với nhau. Quy trình bao gồm tải xuống video, tạo bài viết, tạo giọng đọc, xử lý video, và tải lên các nền tảng mạng xã hội.",
        Hashtag: "#test #workflow"
    };
    
    fs.writeFileSync(
        path.join(folderPath, "generated-content.json"),
        JSON.stringify(testContent, null, 2)
    );
    
    console.log(`✅ Created test content for: ${folder}`);
}

console.log(`\n✅ Test data setup complete!`);
console.log(`Now run: node run-workflow.mjs (will skip crawl, start from news generation)\n`);
