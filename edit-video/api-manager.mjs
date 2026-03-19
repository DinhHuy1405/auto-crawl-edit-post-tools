/**
 * API Key Manager - Manages multiple Gemini API keys with auto-switching
 * Switches to next available key when quota is exceeded
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let apiKeysData = null;

function loadApiKeys() {
    if (apiKeysData) return apiKeysData;
    
    // api-keys.json is in parent directory (auto-crawl-edit-post-tools/)
    const configPath = path.join(__dirname, '..', 'api-keys.json');
    apiKeysData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return apiKeysData;
}

function saveApiKeys() {
    // api-keys.json is in parent directory (auto-crawl-edit-post-tools/)
    const configPath = path.join(__dirname, '..', 'api-keys.json');
    fs.writeFileSync(configPath, JSON.stringify(apiKeysData, null, 2));
}

export function getNextActiveKey(service = 'gemini') {
    const config = loadApiKeys();
    const keys = config[service] || [];
    
    // Find first non-quota-exceeded key
    const activeKey = keys.find(k => !k.quotaExceededAt);
    
    if (!activeKey) {
        console.warn(`⚠️  All ${service} API keys have exceeded quota!`);
        return keys[0]; // Return first key anyway
    }
    
    return activeKey;
}

export function getActiveKeyValue(service = 'gemini') {
    const keyObj = getNextActiveKey(service);
    return keyObj.key;
}

export function markQuotaExceeded(service = 'gemini', keyName = null) {
    const config = loadApiKeys();
    const keys = config[service] || [];
    
    const keyToMark = keyName 
        ? keys.find(k => k.name === keyName)
        : keys.find(k => !k.quotaExceededAt);
    
    if (keyToMark) {
        keyToMark.quotaExceededAt = new Date().toISOString();
        keyToMark.status = 'quota_exceeded';
        saveApiKeys();
        console.log(`❌ Marked ${keyToMark.name} as quota exceeded`);
        
        const nextKey = getNextActiveKey(service);
        console.log(`✅ Switching to: ${nextKey.name}`);
    }
}

export function markKeyUsed(service = 'gemini', keyName = null) {
    const config = loadApiKeys();
    const keys = config[service] || [];
    
    const keyToMark = keyName 
        ? keys.find(k => k.name === keyName)
        : keys.find(k => !k.quotaExceededAt);
    
    if (keyToMark) {
        keyToMark.lastUsed = new Date().toISOString();
        saveApiKeys();
    }
}

export function getApiKeyStatus(service = 'gemini') {
    const config = loadApiKeys();
    const keys = config[service] || [];
    
    const active = keys.filter(k => !k.quotaExceededAt);
    const exceeded = keys.filter(k => k.quotaExceededAt);
    
    console.log(`\n📊 ${service.toUpperCase()} API Keys Status:`);
    console.log(`   ✅ Active: ${active.length}/${keys.length}`);
    active.forEach(k => {
        console.log(`      • ${k.name} (${k.status})`);
    });
    if (exceeded.length > 0) {
        console.log(`   ⏸️  Quota Exceeded: ${exceeded.length}`);
        exceeded.forEach(k => {
            console.log(`      • ${k.name}`);
        });
    }
    console.log('');
}

export function resetAllKeys(service = 'gemini') {
    const config = loadApiKeys();
    const keys = config[service] || [];
    
    keys.forEach(k => {
        k.quotaExceededAt = null;
        k.status = 'active';
    });
    
    saveApiKeys();
    console.log(`🔄 Reset all ${service} API keys`);
}

export default {
    getNextActiveKey,
    getActiveKeyValue,
    markQuotaExceeded,
    markKeyUsed,
    getApiKeyStatus,
    resetAllKeys,
    loadApiKeys
};
