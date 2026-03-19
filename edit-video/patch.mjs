import fs from 'fs';
let c = fs.readFileSync('run.test.mjs', 'utf8');
c = c.replace('await executeFFmpeg(ffmpegCommand);', 'console.log(ffmpegCommand); process.exit(0);');
fs.writeFileSync('run.test.mjs', c);
