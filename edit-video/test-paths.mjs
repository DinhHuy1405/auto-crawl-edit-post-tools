import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED_CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));

const printPathInfo = (name, p) => console.log(`${name}: ${p} - Exists: ${fs.existsSync(p)}`);

printPathInfo("Main Video", path.join(__dirname, SHARED_CONFIG.paths.templateDir, SHARED_CONFIG.templates.mainVideo));
printPathInfo("Template Video", path.join(__dirname, SHARED_CONFIG.paths.templateDir, SHARED_CONFIG.templates.templateVideo));
printPathInfo("Background Music", path.join(__dirname, SHARED_CONFIG.paths.publicDir, SHARED_CONFIG.templates.backgroundMusic));
printPathInfo("Logo", path.join(__dirname, SHARED_CONFIG.paths.publicDir, SHARED_CONFIG.templates.logo));
