
import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import JSON5 from "json5";
import { getNewsConfig, getPathConfig } from "./config-loader.mjs";
import { getActiveKeyValue, markQuotaExceeded, markKeyUsed, getApiKeyStatus } from "./api-manager.mjs";

dotenv.config();
const newsConfig = getNewsConfig();
const pathConfig = getPathConfig();

// Show API key status at startup
getApiKeyStatus('gemini');

function extractTextFromVtt(vttPath) {
    const content = readFileSync(vttPath, "utf8");
    return content
        .split('\n')
        .filter(line =>
            line.trim() !== "" &&
            !line.startsWith("WEBVTT") &&
            !/^\d+$/.test(line.trim()) &&
            !/^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/.test(line.trim()) &&
            !/^NOTE/.test(line.trim())
        )
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractTextFromSrt(filePath) {
    const content = readFileSync(filePath, "utf8");
    return content
        .split("\n")
        .filter(line => !/^\d+$/.test(line) && !/-->/g.test(line) && line.trim() !== "")
        .join(" ")
        .trim();
}

async function generateNewsFromText(text, retryCount = 0, maxRetries = 4) {
    try {
        const currentApiKey = getActiveKeyValue('gemini');
        const googleGenAI = new GoogleGenAI({ apiKey: currentApiKey });
        
        const prompt = `
Bạn là một nhà báo chuyên nghiệp viết cho mục THỜI SỰ. Phân tích nội dung dưới đây và viết bài báo thời sự.

CHỈ trả về DỮ LIỆU JSON HỢP LỆ, KHÔNG giải thích, KHÔNG ghi chú, KHÔNG xuống dòng ngoài khối JSON, và KHÔNG xuất bất kỳ ký tự nào khác ngoài JSON.

{
  "Content": "...",
  "Title": "..."
}

HƯỚNG DẪN VIẾT THỜI SỰ:
1. Title: Tựa đề ngắn gọn, lôi cuốn, phản ánh sự kiện chính. Không quá 100 ký tự, không ký tự đặc biệt.
2. Content: Bài báo THỜI SỰ với độ dài ${newsConfig.minWords}-${newsConfig.maxWords} từ. Yêu cầu:
   - Lối mở: Giới thiệu sự kiện trong 2-3 dòng, trả lời câu hỏi gì, ai, khi nào, ở đâu
   - Nội dung chính: Phân tích chi tiết sự kiện, nguyên nhân, hệ quả
   - Phong cách: ${newsConfig.style}
   - Tone: ${newsConfig.tone}
   - Viết bằng tiếng Việt, các từ khóa quan trọng nên in đậm (nếu là trích dẫn trực tiếp thì dùng dấu ngoặc)
3. Nếu Content < ${newsConfig.minWords} từ, tự bổ sung chi tiết, phân tích để đủ độ dài

TUYỆT ĐỐI: Escape đúng chuẩn JSON toàn bộ chuỗi Content và Title trước khi xuất.

Nội dung gốc cần viết thành thời sự:
${text}
`;

        const response = await googleGenAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        markKeyUsed('gemini');
        return response.text;
        
    } catch (error) {
        const isQuotaError = error?.error?.code === 429 || 
                             error?.error?.message?.includes('quota') ||
                             error?.error?.message?.includes('exceeded');
        
        if (isQuotaError && retryCount < maxRetries) {
            console.log(`⚠️  API quota exceeded, switching to next key... (attempt ${retryCount + 1}/${maxRetries})`);
            markQuotaExceeded('gemini');
            
            // Wait a bit before retrying
            await new Promise(r => setTimeout(r, 1000));
            return generateNewsFromText(text, retryCount + 1, maxRetries);
        }
        
        throw error;
    }
}

function parseToNewsJson(llmOutput) {
    if (!llmOutput) return { Title: "", Content: "", Hashtag: "" };
    
    // Remove markdown formatting (**text** -> text)
    let cleaned = llmOutput.replace(/\*\*/g, '');
    
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return { Title: "", Content: "", Hashtag: "" };

    let raw = match[0];
    
    // Clean invalid control characters and problematic Unicode
    raw = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
    raw = raw.replace(/[\u2028\u2029]/g, ' ');
    
    try {
        const parsed = JSON5.parse(raw);
        return {
            Title: (parsed.Title ?? "").trim(),
            Content: (parsed.Content ?? "").trim(),
            Hashtag: (parsed.Hashtag ?? "").trim()
        };
    } catch (e) {
        console.error("❌ JSON5 parse error:", e.message);
        console.log("📄 JSON lỗi:\n", raw.substring(0, 500));
        return { Title: "", Content: "", Hashtag: "" };
    }
}

function escapeForJson(text) {
    return (text || "")
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}

async function main() {
    // Use YESTERDAY's date to match crawler output
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dd = String(yesterday.getDate()).padStart(2, '0');
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yyyy = yesterday.getFullYear();
    const ddmmyyyy = `${dd}${mm}${yyyy}`;
    const baseDir = join(pathConfig.outputDir, ddmmyyyy);
    const subfolders = readdirSync(baseDir).map(name => join(baseDir, name))
        .filter(p => statSync(p).isDirectory());

    let total = 0;

    for (const folder of subfolders) {
        // Scan recursively for subtitle files (they may be in subfolders)
        let subtitleFiles = [];
        const scanDir = (dir) => {
            try {
                const items = readdirSync(dir);
                for (const item of items) {
                    const itemPath = join(dir, item);
                    if (statSync(itemPath).isDirectory()) {
                        scanDir(itemPath); // Recurse
                    } else if (item.endsWith(".vi.vtt") || item.endsWith(".vi.srt") || 
                               item.endsWith(".srt") || item.endsWith(".vtt")) {
                        subtitleFiles.push(itemPath);
                    }
                }
            } catch (e) {
                // Skip on error
            }
        };
        scanDir(folder);

        if (subtitleFiles.length === 0) continue;

        let bestFile = null;
        let maxLength = 0;

        for (const file of subtitleFiles) {
            const content = file.endsWith(".srt")
                ? extractTextFromSrt(file)
                : extractTextFromVtt(file);

            if (content.length > maxLength) {
                maxLength = content.length;
                bestFile = file;
            }
        }

        if (!bestFile) continue;

        try {
            const rawText = bestFile.endsWith(".srt")
                ? extractTextFromSrt(bestFile)
                : extractTextFromVtt(bestFile);

            if (rawText.length < 100) {
                console.log(`⚠️ Subtitle quá ngắn (${rawText.length} ký tự): ${bestFile}`);
                continue;
            }

            let llmResult = await generateNewsFromText(rawText);
            let json = parseToNewsJson(llmResult);

            // Nếu Content < config.minWords ký tự, tự động gọi lại Gemini tối đa 2 lần nữa
            let retryCount = 0;
            while ((json.Content || "").length < newsConfig.minWords && retryCount < 2) {
                console.log(`🔁 Content quá ngắn (${(json.Content || "").length} ký tự), thử sinh lại...`);
                llmResult = await generateNewsFromText(rawText);
                json = parseToNewsJson(llmResult);
                retryCount++;
            }

            if (!json.Content || json.Content.length < 50) {
                console.error(`❌ Nội dung không đủ để sinh voice: ${folder}`);
                continue;
            }

            const safeJson = {
                Title: escapeForJson(json.Title),
                Content: escapeForJson(json.Content),
                Hashtag: escapeForJson(json.Hashtag)
            };

            const outputPath = join(folder, "generated-content.json");
            writeFileSync(outputPath, JSON.stringify(safeJson, null, 2), "utf8");
            console.log(`✅ Created: ${outputPath}`);
            total++;
        } catch (err) {
            console.error(`❌ Error in ${folder}: ${err.message}`);
        }
    }

    console.log(`🎉 Done. Generated content for ${total} folder(s).`);
}

main();
