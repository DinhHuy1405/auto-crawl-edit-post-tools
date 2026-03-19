import { readFileSync } from "fs";
const runJs = readFileSync("run.test.mjs", "utf8");
console.log(runJs.match(/ffmpegCommand = generateFFmpegCommand.*/)[0]);
