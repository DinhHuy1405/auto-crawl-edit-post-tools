import fs from 'fs'
import path from 'path'

export const ROOT_DIR = process.env.ROOT_DIR || path.join(process.cwd(), '..')

export const PATHS = {
  config: path.join(ROOT_DIR, 'config.json'),
  apiKeys: path.join(ROOT_DIR, 'api-keys.json'),
  videosJson: path.join(ROOT_DIR, 'edit-video', 'videos.json'),
  editVideoDir: path.join(ROOT_DIR, 'edit-video'),
  socialUploadDir: path.join(ROOT_DIR, 'social-upload-tools'),
  crawlDir: path.join(ROOT_DIR, 'crawl-upload-tools'),
  uploadDatabase: path.join(ROOT_DIR, 'social-upload-tools', 'videos-database.json'),
  socialConfig: path.join(ROOT_DIR, 'social-upload-tools', 'config.json'),
}

export interface AppConfig {
  paths: {
    outputDir: string
    editVideoDir: string
    socialUploadDir: string
    crawlDir: string
    templateDir: string
    publicDir: string
  }
  audio: {
    volumes: { mainVideo: number; backgroundMusic: number; voiceNarration: number }
    codec: string
    bitrate: string
    sampleRate: number
  }
  video: {
    codec: string
    preset: string
    resolution: string
    maxDurationSec: number
  }
  templates: {
    mainVideo: string
    templateVideo: string
    backgroundMusic: string
    logo: string
  }
  layout: {
    templateX: number
    templateY: number
    logoX: number
    logoY: number
    logoScale: string
  }
  tts: {
    provider: string
    model: string
    voice: string
    language: string
    sampleRate: number
    audioFormat: string
    style: string
  }
  newsGeneration: {
    provider: string
    model: string
    language: string
    type: string
    style: string
    minWords: number
    maxWords: number
    tone: string
  }
  crawler: {
    useJDownloader: boolean
    downloadFormat: string
    minDurationSec?: number
    channels?: { id: string; label: string; enabled: boolean }[]
  }
  upload: {
    platforms: string[]
    showBrowser: boolean
    timeout: number
  }
}

export function readConfig(): AppConfig {
  const raw = fs.readFileSync(PATHS.config, 'utf8')
  return JSON.parse(raw)
}

export function writeConfig(config: AppConfig): void {
  fs.writeFileSync(PATHS.config, JSON.stringify(config, null, 2), 'utf8')
}

export interface ApiKey {
  name: string
  key: string
  env: string
  status: 'active' | 'quota_exceeded' | 'standby'
  lastUsed: string | null
  quotaExceededAt: string | null
}

export interface ApiKeysConfig {
  gemini: ApiKey[]
  tts: ApiKey[]
}

export function readApiKeys(): ApiKeysConfig {
  if (!fs.existsSync(PATHS.apiKeys)) return { gemini: [], tts: [] }
  const raw = fs.readFileSync(PATHS.apiKeys, 'utf8')
  return JSON.parse(raw)
}

export function writeApiKeys(keys: ApiKeysConfig): void {
  fs.writeFileSync(PATHS.apiKeys, JSON.stringify(keys, null, 2), 'utf8')
}
