import fs from 'fs'
import path from 'path'
import { PATHS } from './config'

export interface VideoEntry {
  title: string
  videoLink: string
  voiceLink: string
  soundLink: string
  imageLink: string
  status: 'not yet' | 'done' | 'error'
  outputPath: string
}

export interface UploadVideo {
  id: string
  type: string
  video_name: string
  title: string
  description: string
  file_path: string
  status: string
  created_at: string
  facebook: { uploaded: boolean; uploaded_at?: string | null; reel_id?: string; error?: string; output?: string }
  tiktok: { uploaded: boolean; uploaded_at?: string | null; error?: string }
  threads: { uploaded: boolean; uploaded_at?: string | null; error?: string }
  youtube: { uploaded: boolean }
}

export function readVideosJson(): VideoEntry[] {
  if (!fs.existsSync(PATHS.videosJson)) return []
  try {
    return JSON.parse(fs.readFileSync(PATHS.videosJson, 'utf8'))
  } catch { return [] }
}

export function writeVideosJson(videos: VideoEntry[]): void {
  fs.writeFileSync(PATHS.videosJson, JSON.stringify(videos, null, 2), 'utf8')
}

export function readUploadDatabase(): UploadVideo[] {
  if (!fs.existsSync(PATHS.uploadDatabase)) return []
  try {
    const data = JSON.parse(fs.readFileSync(PATHS.uploadDatabase, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

export function writeUploadDatabase(videos: UploadVideo[]): void {
  fs.writeFileSync(PATHS.uploadDatabase, JSON.stringify(videos, null, 2), 'utf8')
}

export interface GeneratedContent {
  Title: string
  Content: string
  Hashtag?: string
}

export function readGeneratedContent(folderPath: string): GeneratedContent | null {
  const p = path.join(folderPath, 'generated-content.json')
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}

export function writeGeneratedContent(folderPath: string, content: GeneratedContent): void {
  const p = path.join(folderPath, 'generated-content.json')
  fs.writeFileSync(p, JSON.stringify(content, null, 2), 'utf8')
}

export function scanOutputFolders(outputDir: string) {
  if (!fs.existsSync(outputDir)) return []
  return fs.readdirSync(outputDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^\d{8}$/.test(e.name))
    .map(e => e.name)
    .sort((a, b) => b.localeCompare(a))
}

export function scanSubFolders(dateFolder: string) {
  if (!fs.existsSync(dateFolder)) return []
  return fs.readdirSync(dateFolder, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => {
      const full = path.join(dateFolder, e.name)
      const hasContent = fs.existsSync(path.join(full, 'generated-content.json'))
      const hasVoice = fs.existsSync(path.join(full, 'output.wav'))
      const videoFile = findVideoInDir(full)
      return {
        name: e.name,
        path: full,
        hasContent,
        hasVoice,
        videoFile,
        ready: hasContent && hasVoice && !!videoFile,
      }
    })
}

function findVideoInDir(dir: string): string | null {
  const exts = new Set(['.mp4', '.mkv', '.webm', '.mov'])
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const fp = path.join(dir, e.name)
    if (e.isFile() && exts.has(path.extname(e.name).toLowerCase())) return fp
    if (e.isDirectory()) {
      const sub = findVideoInDir(fp)
      if (sub) return sub
    }
  }
  return null
}
