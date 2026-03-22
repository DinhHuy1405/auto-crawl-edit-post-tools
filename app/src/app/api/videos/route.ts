import { NextRequest, NextResponse } from 'next/server'
import { readVideosJson, writeVideosJson, readUploadDatabase, scanOutputFolders, scanSubFolders } from '@/lib/videos'
import { readConfig, ROOT_DIR } from '@/lib/config'
import fs from 'fs'
import path from 'path'

export interface RenderedVideo {
  id: string
  title: string
  filePath: string
  voicePath: string | null
  voiceDurationSec: number | null
  sizeMb: number
  date: string
  folder: string
  publicPath: string
  voicePublicPath: string | null
}

function scanRenderedVideos(outputDir: string): RenderedVideo[] {
  const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.webm', '.mov'])
  const results: RenderedVideo[] = []
  if (!fs.existsSync(outputDir)) return results

  const dates = fs.readdirSync(outputDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^\d{8}$/.test(e.name))
    .map(e => e.name)
    .sort((a, b) => b.localeCompare(a))

  for (const date of dates) {
    const dateDir = path.join(outputDir, date)
    const folders = fs.readdirSync(dateDir, { withFileTypes: true }).filter(e => e.isDirectory())
    for (const folder of folders) {
      const folderPath = path.join(dateDir, folder.name)
      // Find rendered video file
      let videoFile: string | null = null
      for (const f of fs.readdirSync(folderPath, { withFileTypes: true })) {
        if (f.isFile() && VIDEO_EXTS.has(path.extname(f.name).toLowerCase())) {
          videoFile = path.join(folderPath, f.name)
          break
        }
      }
      if (!videoFile) continue

      // Voice WAV
      const wavPath = path.join(folderPath, 'output.wav')
      const hasVoice = fs.existsSync(wavPath)

      // Size
      const stat = fs.statSync(videoFile)
      const sizeMb = Math.round((stat.size / 1024 / 1024) * 10) / 10

      // Voice duration from WAV header (PCM: byte 28-31 = sample rate, byte 24-27 = num channels)
      let voiceDurationSec: number | null = null
      if (hasVoice) {
        try {
          const buf = Buffer.alloc(44)
          const fd = fs.openSync(wavPath, 'r')
          fs.readSync(fd, buf, 0, 44, 0)
          fs.closeSync(fd)
          const audioFormat = buf.readUInt16LE(20)
          const sampleRate = buf.readUInt32LE(24)
          const byteRate = buf.readUInt32LE(28)
          const fileStat = fs.statSync(wavPath)
          if (audioFormat === 1 && byteRate > 0) {
            // PCM: duration = (fileSize - 44) / byteRate
            voiceDurationSec = Math.round(((fileStat.size - 44) / byteRate) * 10) / 10
          } else if (sampleRate > 0) {
            voiceDurationSec = Math.round(((fileStat.size - 44) / sampleRate) * 10) / 10
          }
        } catch {}
      }

      const relVideo = path.relative(ROOT_DIR, videoFile)
      const relVoice = hasVoice ? path.relative(ROOT_DIR, wavPath) : null

      results.push({
        id: `${date}_${folder.name}`,
        title: folder.name,
        filePath: videoFile,
        voicePath: hasVoice ? wavPath : null,
        voiceDurationSec,
        sizeMb,
        date,
        folder: folder.name,
        publicPath: `/api/file?path=${encodeURIComponent(relVideo)}`,
        voicePublicPath: relVoice ? `/api/file?path=${encodeURIComponent(relVoice)}` : null,
      })
    }
  }
  return results
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  try {
    if (type === 'upload-db') {
      return NextResponse.json(readUploadDatabase())
    }
    if (type === 'folders') {
      const config = readConfig()
      const dates = scanOutputFolders(config.paths.outputDir)
      return NextResponse.json({ dates, outputDir: config.paths.outputDir })
    }
    if (type === 'subfolders') {
      const date = req.nextUrl.searchParams.get('date')
      const config = readConfig()
      const dateFolder = path.join(config.paths.outputDir, date!)
      return NextResponse.json(scanSubFolders(dateFolder))
    }
    if (type === 'rendered') {
      const config = readConfig()
      return NextResponse.json(scanRenderedVideos(config.paths.outputDir))
    }
    if (type === 'voice-duration') {
      const filePath = req.nextUrl.searchParams.get('path')
      if (!filePath) return NextResponse.json({ error: 'Missing path' }, { status: 400 })
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(ROOT_DIR, filePath)
      if (!fs.existsSync(absPath)) return NextResponse.json({ durationSec: null })
      try {
        const buf = Buffer.alloc(44)
        const fd = fs.openSync(absPath, 'r')
        fs.readSync(fd, buf, 0, 44, 0)
        fs.closeSync(fd)
        const audioFormat = buf.readUInt16LE(20)
        const byteRate = buf.readUInt32LE(28)
        const fileStat = fs.statSync(absPath)
        let durationSec: number | null = null
        if (audioFormat === 1 && byteRate > 0) {
          durationSec = Math.round(((fileStat.size - 44) / byteRate) * 10) / 10
        }
        return NextResponse.json({ durationSec })
      } catch (e) {
        return NextResponse.json({ durationSec: null, error: String(e) })
      }
    }
    // Default: return videos.json
    return NextResponse.json(readVideosJson())
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    if (Array.isArray(body)) {
      writeVideosJson(body)
    } else {
      // Update single entry by index
      const { index, data } = body
      const videos = readVideosJson()
      videos[index] = { ...videos[index], ...data }
      writeVideosJson(videos)
    }
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
