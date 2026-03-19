/**
 * Shared Configuration Loader
 * Used by all modules to access common settings
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let configCache = null;

export function loadConfig() {
    if (configCache) return configCache;
    
    const configPath = path.join(__dirname, '..', 'config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
    }
    
    configCache = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return configCache;
}

export function getConfig() {
    return loadConfig();
}

export function getAudioConfig() {
    return loadConfig().audio;
}

export function getVideoConfig() {
    return loadConfig().video;
}

export function getTTSConfig() {
    return loadConfig().tts;
}

export function getNewsConfig() {
    return loadConfig().newsGeneration;
}

export function getCrawlerConfig() {
    return loadConfig().crawler;
}

export function getPathConfig() {
    return loadConfig().paths;
}

export default {
    loadConfig,
    getConfig,
    getAudioConfig,
    getVideoConfig,
    getTTSConfig,
    getNewsConfig,
    getCrawlerConfig,
    getPathConfig
};
