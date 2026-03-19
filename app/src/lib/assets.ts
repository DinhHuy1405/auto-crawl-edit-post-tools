import fs from 'fs'
import path from 'path'
import { ROOT_DIR } from './config'

export interface AssetFile {
  name: string
  path: string
  relativePath: string
  size: number
  extension: string
}

function scanDir(dir: string, exts: string[], base: string): AssetFile[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && exts.includes(path.extname(e.name).toLowerCase()))
    .map(e => {
      const full = path.join(dir, e.name)
      const stat = fs.statSync(full)
      return {
        name: e.name,
        path: full,
        relativePath: path.relative(base, full),
        size: stat.size,
        extension: path.extname(e.name).toLowerCase(),
      }
    })
}

export function getTemplateVideos(): AssetFile[] {
  const dir = path.join(ROOT_DIR, 'edit-video', 'assets', 'f')
  return scanDir(dir, ['.mp4', '.mov', '.mkv'], ROOT_DIR)
}

export function getBackgroundMusic(): AssetFile[] {
  const dir = path.join(ROOT_DIR, 'edit-video', 'assets')
  return scanDir(dir, ['.mp3', '.wav', '.aac', '.m4a'], ROOT_DIR)
}

export function getLogos(): AssetFile[] {
  const dir = path.join(ROOT_DIR, 'edit-video', 'assets')
  return scanDir(dir, ['.png', '.jpg', '.jpeg', '.webp', '.svg'], ROOT_DIR)
}

export function getFonts(): AssetFile[] {
  const dir = path.join(ROOT_DIR, 'edit-video', 'assets')
  return [
    ...scanDir(dir, ['.ttf', '.otf', '.woff', '.woff2'], ROOT_DIR),
    ...scanDir(path.join(dir, 'Anton'), ['.ttf', '.otf'], ROOT_DIR),
  ]
}

export function getAssetPublicPath(assetPath: string): string {
  const rel = path.relative(ROOT_DIR, assetPath)
  return `/api/file?path=${encodeURIComponent(rel)}`
}
