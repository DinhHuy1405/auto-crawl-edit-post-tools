#!/usr/bin/env node
/**
 * Clip Cutter - Downloads a long video and cuts it into short clips
 *
 * Usage:
 *   node clip-cutter.mjs --url <youtube/facebook url or youtube id>
 *                        --duration <seconds>
 *                        [--start <hh:mm:ss>]
 *                        [--end <hh:mm:ss>]
 *                        [--max-clips <n>]
 *                        [--output <dir>]
 *                        [--title <name>]
 */
import { execSync, spawnSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

const args = process.argv.slice(2)
const getArg = (flag, def = null) => {
  const idx = args.indexOf(flag)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def
}

const rawUrl    = getArg('--url')
const duration  = parseInt(getArg('--duration', '60'), 10)
const startTime = getArg('--start', null)
const endTime   = getArg('--end', null)
const maxClips  = parseInt(getArg('--max-clips', '0'), 10)  // 0 = no limit
const title     = getArg('--title', `clips_${Date.now()}`)
const outputDir = getArg('--output', join(__dirname, '..', 'temp-clips', title))

if (!rawUrl) {
  console.error('❌ Error: --url is required')
  process.exit(1)
}

// Resolve YouTube ID / full URL
let videoUrl = rawUrl.trim()
if (!videoUrl.startsWith('http')) {
  // Treat as YouTube ID
  videoUrl = `https://www.youtube.com/watch?v=${videoUrl}`
}

// Create output dirs
const clipsDir = join(outputDir, 'clips')
mkdirSync(clipsDir, { recursive: true })

const tmpFile = join(outputDir, 'source.mp4')

console.log(`📥 Source: ${videoUrl}`)
console.log(`📁 Output: ${clipsDir}`)
console.log(`✂️  Clip duration: ${duration}s`)

// ─── Step 1: Download ────────────────────────────────────────────────────────
console.log('\n─── Downloading video ──────────────────────────────────────────')

const ytdlpArgs = [
  '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
  '--merge-output-format', 'mp4',
  '-o', tmpFile,
  '--no-playlist',
  '--newline',
  videoUrl,
]

console.log(`🔧 yt-dlp ${ytdlpArgs.join(' ')}`)

const dl = spawnSync('yt-dlp', ytdlpArgs, { stdio: 'inherit' })
if (dl.status !== 0) {
  console.error('❌ Download failed (exit code', dl.status, ')')
  process.exit(1)
}

if (!existsSync(tmpFile)) {
  console.error('❌ Downloaded file not found:', tmpFile)
  process.exit(1)
}

console.log('✅ Download complete')

// ─── Step 2: Probe duration ──────────────────────────────────────────────────
console.log('\n─── Probing video ──────────────────────────────────────────────')
let totalDuration = 0
try {
  const probeOut = execSync(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${tmpFile}"`,
  ).toString().trim()
  totalDuration = parseFloat(probeOut)
  const m = Math.floor(totalDuration / 60)
  const s = Math.floor(totalDuration % 60)
  console.log(`⏱️  Total duration: ${m}m ${s}s (${Math.ceil(totalDuration / duration)} potential clips)`)
} catch (err) {
  console.error('⚠️  Could not probe duration:', err.message)
}

// ─── Step 3: Split with FFmpeg ───────────────────────────────────────────────
console.log('\n─── Splitting into clips ────────────────────────────────────────')

const ffArgs = ['-i', tmpFile, '-c', 'copy']

if (startTime) {
  ffArgs.push('-ss', startTime)
  console.log(`⏩ Start from: ${startTime}`)
}
if (endTime) {
  ffArgs.push('-to', endTime)
  console.log(`⏹  End at: ${endTime}`)
}

ffArgs.push(
  '-f', 'segment',
  '-segment_time', String(duration),
  '-reset_timestamps', '1',
  '-avoid_negative_ts', 'make_zero',
)

if (maxClips > 0) {
  ffArgs.push('-segment_list_size', String(maxClips))
  console.log(`🔢 Max clips: ${maxClips}`)
}

const outputPattern = join(clipsDir, 'clip_%03d.mp4')
ffArgs.push(outputPattern)

console.log(`🔧 ffmpeg ${ffArgs.join(' ')}`)

const ff = spawnSync('ffmpeg', ffArgs, { stdio: 'inherit' })
if (ff.status !== 0) {
  console.error('❌ FFmpeg splitting failed (exit code', ff.status, ')')
  process.exit(1)
}

// ─── Step 4: Collect & report clips ─────────────────────────────────────────
const clips = readdirSync(clipsDir)
  .filter(f => f.endsWith('.mp4'))
  .sort()
  .map(f => {
    const fullPath = join(clipsDir, f)
    const stat = statSync(fullPath)
    return { name: f, path: fullPath, size: stat.size }
  })

// Trim to maxClips if needed (segment_list_size only limits list, not files)
const finalClips = maxClips > 0 ? clips.slice(0, maxClips) : clips

// Remove extra clips if maxClips was set
if (maxClips > 0 && clips.length > maxClips) {
  clips.slice(maxClips).forEach(c => {
    try { unlinkSync(c.path) } catch {}
  })
}

console.log(`\n✅ Created ${finalClips.length} clips`)
finalClips.forEach((c, i) => {
  const sizeMb = (c.size / 1024 / 1024).toFixed(1)
  console.log(`  [${i + 1}] ${c.name}  (${sizeMb} MB)`)
})

// Output JSON result for the API to parse
console.log('\nCLIP_CUTTER_RESULT:' + JSON.stringify({
  success: true,
  clipCount: finalClips.length,
  outputDir: clipsDir,
  sourceFile: tmpFile,
  clips: finalClips,
  totalDuration,
}))
