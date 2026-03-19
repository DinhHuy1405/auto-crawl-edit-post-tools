import { NextRequest, NextResponse } from 'next/server'
import { readVideosJson, writeVideosJson, readUploadDatabase, scanOutputFolders, scanSubFolders } from '@/lib/videos'
import { readConfig, ROOT_DIR } from '@/lib/config'
import fs from 'fs'
import path from 'path'

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
