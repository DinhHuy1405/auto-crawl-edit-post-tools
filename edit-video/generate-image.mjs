#!/usr/bin/env node
/**
 * AI Image Generator using Google Gemini Imagen API
 *
 * Usage:
 *   node generate-image.mjs --prompt "..."
 *                           [--enhance]            auto-enhance prompt via Gemini
 *                           [--ratio 9:16]         aspect ratio (9:16|16:9|1:1|4:3)
 *                           [--output <path>]      full output path (.png)
 *                           [--style <style>]      style hint appended to prompt
 *                           [--count <n>]          number of images (1-4)
 */
import { GoogleGenAI } from '@google/genai'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { getActiveKeyValue, markKeyUsed, markQuotaExceeded } from './api-manager.mjs'

dotenv.config()

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

const args = process.argv.slice(2)
const getArg = (flag, def = null) => {
  const idx = args.indexOf(flag)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def
}
const hasFlag = (flag) => args.includes(flag)

const rawPrompt   = getArg('--prompt')
const enhance     = hasFlag('--enhance')
const aspectRatio = getArg('--ratio', '9:16')
const style       = getArg('--style', '')
const count       = Math.min(4, Math.max(1, parseInt(getArg('--count', '1'), 10)))
const defaultOut  = join(__dirname, '..', 'temp-images', `img_${Date.now()}.png`)
const outputPath  = getArg('--output', defaultOut)

if (!rawPrompt) {
  console.error('❌ Error: --prompt is required')
  process.exit(1)
}

// Ensure output directory exists
mkdirSync(dirname(resolve(outputPath)), { recursive: true })

// ─── Step 1: Optionally enhance prompt via Gemini Flash ──────────────────────
async function enhancePrompt(prompt, apiKey) {
  const genAI = new GoogleGenAI({ apiKey })
  const systemPrompt = `You are an expert at writing detailed image generation prompts for AI art.
Given a short concept, expand it into a vivid, detailed image prompt.
Return ONLY the improved prompt text, no explanations, no quotes.
Keep it under 300 words. Focus on: lighting, colors, composition, mood, style.
The image should be photorealistic unless a different style is requested.`

  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nConcept: ${prompt}` }] }],
  })
  markKeyUsed('gemini')
  return response.text?.trim() ?? prompt
}

// ─── Step 2: Generate image via Imagen ───────────────────────────────────────
async function generateImages(prompt, apiKey, retryCount = 0, maxRetries = 3) {
  const genAI = new GoogleGenAI({ apiKey })

  const fullPrompt = style ? `${prompt}, ${style}` : prompt
  console.log(`🎨 Generating ${count} image(s) [${aspectRatio}]`)
  console.log(`📝 Prompt: "${fullPrompt.substring(0, 120)}..."`)

  try {
    const response = await genAI.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: fullPrompt,
      config: {
        numberOfImages: count,
        aspectRatio,
        outputMimeType: 'image/png',
      },
    })

    markKeyUsed('gemini')

    const images = response.generatedImages ?? []
    if (images.length === 0) throw new Error('No images returned from API')

    const savedPaths = []
    images.forEach((img, i) => {
      const bytes = img?.image?.imageBytes
      if (!bytes) { console.warn(`⚠️  Image ${i + 1} has no data, skipping`); return }

      // For multiple images, suffix the filename
      let savePath = outputPath
      if (count > 1) {
        const ext = outputPath.endsWith('.png') ? '.png' : '.png'
        savePath = outputPath.replace(/\.png$/, `_${i + 1}.png`)
      }

      writeFileSync(savePath, Buffer.from(bytes, 'base64'))
      savedPaths.push(savePath)
      const kb = Math.round(Buffer.from(bytes, 'base64').length / 1024)
      console.log(`✅ Image ${i + 1} saved: ${savePath}  (${kb} KB)`)
    })

    return savedPaths
  } catch (err) {
    const isQuota = err.message?.includes('quota') || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')
    const isUnavailableError = err.message?.includes('503') || err.message?.includes('UNAVAILABLE') || err.message?.includes('experiencing high demand') || err.message?.toLowerCase().includes('temporarily unavailable')
    
    if (isQuota || isUnavailableError) {
      if (isQuota) {
        markQuotaExceeded('gemini')
      }
      
      if (retryCount < maxRetries) {
        if (isQuota) {
          console.log(`⚠️  Quota exceeded, retrying with next key (attempt ${retryCount + 1}/${maxRetries})...`)
        } else {
          console.log(`⚠️  API service unavailable (503), retrying in 5 seconds... (attempt ${retryCount + 1}/${maxRetries})`)
        }
        
        const newKey = isQuota ? getActiveKeyValue('gemini') : apiKey;
        const waitTime = isUnavailableError ? 5000 : 1000;
        
        await new Promise(r => setTimeout(r, waitTime));
        return generateImages(prompt, newKey, retryCount + 1, maxRetries)
      }
    }
    throw err
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  let prompt = rawPrompt

  const apiKey = getActiveKeyValue('gemini')

  if (enhance) {
    console.log('✨ Enhancing prompt with Gemini...')
    try {
      prompt = await enhancePrompt(rawPrompt, apiKey)
      console.log(`📝 Enhanced prompt: "${prompt.substring(0, 120)}..."`)
    } catch (err) {
      console.warn('⚠️  Prompt enhancement failed, using original:', err.message)
    }
  }

  try {
    const savedPaths = await generateImages(prompt, apiKey)

    console.log('\nGENERATE_IMAGE_RESULT:' + JSON.stringify({
      success: true,
      prompt,
      aspectRatio,
      count: savedPaths.length,
      paths: savedPaths,
      primaryPath: savedPaths[0] ?? null,
    }))
  } catch (err) {
    console.error('❌ Image generation failed:', err.message)
    console.log('\nGENERATE_IMAGE_RESULT:' + JSON.stringify({
      success: false,
      error: err.message,
    }))
    process.exit(1)
  }
}

main()
