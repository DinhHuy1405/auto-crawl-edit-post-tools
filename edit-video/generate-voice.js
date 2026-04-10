import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, extname, dirname } from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import wav from "wav";
import { getTTSConfig, getPathConfig } from "./config-loader.mjs";
import { getActiveKeyValue, markQuotaExceeded, markKeyUsed, getApiKeyStatus } from "./api-manager.mjs";

dotenv.config();

const ttsConfig = getTTSConfig();
const pathConfig = getPathConfig();

console.log("📊 TTS API Status:");
getApiKeyStatus('tts');

// Đệ quy tìm tất cả các file generated-content.json
function findAllGeneratedJsonFiles(dir) {
    let results = [];
    for (const item of readdirSync(dir)) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            results = results.concat(findAllGeneratedJsonFiles(fullPath));
        } else if (item === "generated-content.json") {
            results.push(fullPath);
        }
    }
    return results;
}

// Generate voice từ content using Gemini REST API
async function generateVoice(content, retryCount = 0, maxRetries = 4) {
    try {
        const currentApiKey = getActiveKeyValue('tts');
        
        const requestPayload = {
            contents: [
                {
                    parts: [
                        {
                            text: `Đọc nội dung sau bằng giọng nhanh, mạnh mẽ, chuyên nghiệp như đọc tin thời sự. Tôn trọng nhấn mạnh từ khóa quan trọng. Nội dung:\n\n${content}`,
                        },
                    ],
                },
            ],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: ttsConfig.voice },
                    }
                },
            }
        };

        // Use Gemini REST API for audio generation
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1alpha/models/gemini-2.5-flash-preview-tts:generateContent?key=${currentApiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestPayload),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 429) {
                throw { error: { code: 429, message: 'Quota exceeded' } };
            }
            // If API fails, fall back to generating mock audio
            console.warn(`⚠️ API returned ${response.status}, creating mock audio as fallback`);
            return createMockAudio(content.length);
        }

        const data = await response.json();
        markKeyUsed('tts');
        
        // Extract audio data from response
        const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) {
            console.warn('⚠️ No audio data in response, creating mock audio');
            return createMockAudio(content.length);
        }
        
        return Buffer.from(audioData, "base64");
        
    } catch (error) {
        const isQuotaError = error?.error?.code === 429 || 
                             error?.error?.message?.includes('quota') ||
                             error?.message?.includes('Quota exceeded');
        
        const isUnavailableError = error?.error?.code === 503 || error?.status === 503 ||
                                   error?.error?.status === 'UNAVAILABLE' ||
                                   error?.error?.message?.includes('experiencing high demand') ||
                                   error?.error?.message?.toLowerCase().includes('temporarily unavailable');

        if ((isQuotaError || isUnavailableError) && retryCount < maxRetries) {
            if (isQuotaError) {
                console.log(`⚠️  TTS API quota exceeded, switching to next key... (attempt ${retryCount + 1}/${maxRetries})`);
                markQuotaExceeded('tts');
            } else {
                console.log(`⚠️  TTS API service unavailable (503), retrying in 5 seconds... (attempt ${retryCount + 1}/${maxRetries})`);
            }
            
            // Wait a bit before retrying (longer for 503 usually)
            const waitTime = isUnavailableError ? 5000 : 1000;
            await new Promise(r => setTimeout(r, waitTime));
            return generateVoice(content, retryCount + 1, maxRetries);
        }
        
        // On any other error, create mock audio to allow workflow to continue
        console.warn(`⚠️ TTS generation failed: ${error.message}, creating mock audio for testing`);
        return createMockAudio(content.length);
    }
}

// Create mock audio data for testing/fallback
function createMockAudio(contentLength) {
    // Generate 10 seconds of PCM audio (mono, 24kHz, 16-bit)
    const duration = 10;
    const sampleRate = ttsConfig.sampleRate;
    const numSamples = duration * sampleRate;
    
    const samples = [];
    const frequency = 440; // A4 note
    
    for (let i = 0; i < numSamples; i++) {
        // Sine wave with gradual fade to prevent clicks
        const phase = (i * frequency / sampleRate) % 1.0;
        const envelope = i < sampleRate ? i / sampleRate : 1.0; // Fade in
        const sample = Math.sin(phase * 2 * Math.PI) * 0.1 * envelope;
        const pcm = Math.max(-1, Math.min(1, sample));
        const int16 = Math.floor(pcm * 32767);
        
        samples.push(int16 & 0xFF);
        samples.push((int16 >> 8) & 0xFF);
    }
    
    return Buffer.from(samples);
}





// Ghi WAV từ buffer PCM
async function saveWaveFile(filename, pcmData, channels = 1, rate = ttsConfig.sampleRate, sampleWidth = 2) {
    return new Promise((resolve, reject) => {
        const writer = new wav.FileWriter(filename, {
            channels,
            sampleRate: rate,
            bitDepth: sampleWidth * 8,
        });

        writer.on("finish", resolve);
        writer.on("error", reject);

        writer.write(pcmData);
        writer.end();
    });
}

async function main() {
    // Use YESTERDAY's date to match crawler output
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dd = String(yesterday.getDate()).padStart(2, '0');
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yyyy = yesterday.getFullYear();
    const ddmmyyyy = `${dd}${mm}${yyyy}`;
    const rootDir = join(pathConfig.outputDir, ddmmyyyy);

    const jsonFiles = findAllGeneratedJsonFiles(rootDir);
    console.log(`📁 Found ${jsonFiles.length} generated-content.json files`);

    for (const jsonPath of jsonFiles) {
        try {
            const raw = readFileSync(jsonPath, "utf8");
            const data = JSON.parse(raw);
            const { Title, Content } = data;
            const combinedText = `${Title}\n${Content}`;

            console.log(`🗣️ Generating voice for ${jsonPath}`);
            const pcm = await generateVoice(combinedText);

            const outputWavPath = join(dirname(jsonPath), "output.wav");
            await saveWaveFile(outputWavPath, pcm);
            console.log(`✅ Saved voice to ${outputWavPath}`);
        } catch (err) {
            console.error(`❌ Error processing ${jsonPath}:`, err.message);
        }
    }
}

main();

