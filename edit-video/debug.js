#!/usr/bin/env node

const { readdirSync, statSync } = require('fs');
const { join } = require('path');

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const dd = String(yesterday.getDate()).padStart(2, '0');
const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
const yyyy = yesterday.getFullYear();
const ddmmyyyy = `${dd}${mm}${yyyy}`;
const baseDir = `/Users/nguyendinhhuy/Documents/Edit Video/Thời Sự/${ddmmyyyy}`;

console.log('🔍 Debugging folder structure:');
console.log(`Date: ${ddmmyyyy}`);
console.log(`Base Dir: ${baseDir}`);
console.log(`Exists: ${require('fs').existsSync(baseDir)}\n`);

const subfolders = readdirSync(baseDir)
  .map(name => join(baseDir, name))
  .filter(p => statSync(p).isDirectory());

console.log(`Found ${subfolders.length} subfolder(s):\n`);

for (let i = 0; i < subfolders.length; i++) {
  const folder = subfolders[i];
  console.log(`\n[${i+1}] ${folder}`);
  
  const files = readdirSync(folder);
  const srtFiles = files.filter(f => f.endsWith('.srt'));
  const vttFiles = files.filter(f => f.endsWith('.vtt'));
  const subFolders = files.filter(f => {
    try { return statSync(join(folder, f)).isDirectory(); } catch { return false; }
  });
  
  console.log(`   Files: ${files.length}, SRT: ${srtFiles.length}, VTT: ${vttFiles.length}, Subfolders: ${subFolders.length}`);
  
  if (subFolders.length > 0) {
    subFolders.forEach(sub => {
      const subPath = join(folder, sub);
      const subFiles = readdirSync(subPath);
      const subSrt = subFiles.filter(f => f.endsWith('.srt')).length;
      const subVtt = subFiles.filter(f => f.endsWith('.vtt')).length;
      console.log(`      └─ ${sub}: ${subFiles.length} files (SRT: ${subSrt}, VTT: ${subVtt})`);
    });
  }
}
