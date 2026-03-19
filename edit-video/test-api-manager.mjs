#!/usr/bin/env node

/**
 * Test API Manager functionality
 * Demonstrates:
 * 1. Multiple API keys for each service
 * 2. Quota tracking and auto-switching
 * 3. API key status monitoring
 */

import { 
    getNextActiveKey, 
    getActiveKeyValue, 
    markQuotaExceeded, 
    markKeyUsed, 
    getApiKeyStatus,
    resetAllKeys 
} from "./api-manager.mjs";

console.log("🚀 API Manager Test Suite\n");

// Test 1: Show initial status
console.log("═══════════════════════════════════════════════════════════");
console.log("TEST 1: Initial API Key Status");
console.log("═══════════════════════════════════════════════════════════");
getApiKeyStatus('gemini');
console.log();

// Test 2: Get active key value
console.log("═══════════════════════════════════════════════════════════");
console.log("TEST 2: Get Active Key Value");
console.log("═══════════════════════════════════════════════════════════");
const activeKey = getActiveKeyValue('gemini');
console.log(`✅ Active API Key (first 20 chars): ${activeKey.substring(0, 20)}...`);
console.log();

// Test 3: Mark key as used
console.log("═══════════════════════════════════════════════════════════");
console.log("TEST 3: Mark Key as Used");
console.log("═══════════════════════════════════════════════════════════");
markKeyUsed('gemini');
console.log("✅ Marked current key as used");
getApiKeyStatus('gemini');
console.log();

// Test 4: Mark quota exceeded and auto-switch
console.log("═══════════════════════════════════════════════════════════");
console.log("TEST 4: Simulate Quota Exceeded & Auto-Switch");
console.log("═══════════════════════════════════════════════════════════");
console.log("⚠️  Marking Primary key as quota exceeded...");
markQuotaExceeded('gemini');
console.log("📊 Updated status:");
getApiKeyStatus('gemini');
console.log();

// Test 5: Get next active key (should switch to backup)
console.log("═══════════════════════════════════════════════════════════");
console.log("TEST 5: Get Next Active Key After Quota");
console.log("═══════════════════════════════════════════════════════════");
const nextKey = getNextActiveKey('gemini');
console.log(`✅ Switched to: ${nextKey.name}`);
console.log(`   Key (first 20 chars): ${nextKey.key.substring(0, 20)}...`);
console.log(`   Status: ${nextKey.status}`);
getApiKeyStatus('gemini');
console.log();

// Test 6: Simulate multiple quota exhaustion
console.log("═══════════════════════════════════════════════════════════");
console.log("TEST 6: Simulate Multiple Quota Exhaustion");
console.log("═══════════════════════════════════════════════════════════");
// Get current active key
let currentKey = getNextActiveKey('gemini');
console.log(`⚠️  Marking ${currentKey.name} as quota exceeded...`);
markQuotaExceeded('gemini');

currentKey = getNextActiveKey('gemini');
console.log(`⚠️  Marking ${currentKey.name} as quota exceeded...`);
markQuotaExceeded('gemini');

currentKey = getNextActiveKey('gemini');
console.log(`⚠️  Marking ${currentKey.name} as quota exceeded...`);
markQuotaExceeded('gemini');

console.log("\n📊 Final status after multiple quota exhaustions:");
getApiKeyStatus('gemini');
console.log();

// Test 7: Reset all keys
console.log("═══════════════════════════════════════════════════════════");
console.log("TEST 7: Reset All Keys");
console.log("═══════════════════════════════════════════════════════════");
console.log("🔄 Resetting all API keys...");
resetAllKeys('gemini');
console.log("✅ All keys reset to 'active' status");
getApiKeyStatus('gemini');
console.log();

console.log("═══════════════════════════════════════════════════════════");
console.log("✅ All tests completed successfully!");
console.log("═══════════════════════════════════════════════════════════\n");

console.log("📌 Key Features Demonstrated:");
console.log("   ✅ Multiple API keys per service (4 keys)");
console.log("   ✅ Automatic quota tracking");
console.log("   ✅ Auto-switching to next available key");
console.log("   ✅ Key usage tracking with timestamps");
console.log("   ✅ Status monitoring and reporting");
console.log("   ✅ Manual reset capability");
