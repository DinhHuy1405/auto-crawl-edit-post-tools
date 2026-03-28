import { NextRequest, NextResponse } from 'next/server'
import { readUploadDatabase, writeUploadDatabase, readVideosJson, writeVideosJson } from '@/lib/videos'
import { PATHS } from '@/lib/config'
import fs from 'fs'

function readSocialConfig() {
  try { return JSON.parse(fs.readFileSync(PATHS.socialConfig, 'utf8')) } catch { return {} }
}
function writeSocialConfig(data: Record<string, unknown>) {
  fs.writeFileSync(PATHS.socialConfig, JSON.stringify(data, null, 2), 'utf8')
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}


export async function GET(req: NextRequest) {
  try {
    const db = readUploadDatabase()
    const today = todayStr()
    const dateParam = req.nextUrl.searchParams.get('date') || req.nextUrl.searchParams.get('today') === '1' && today || null
    const matchDate = (v: { upload_date?: string; created_at?: string }) => {
      if (!dateParam) return true
      const ud = v.upload_date as string | undefined
      const ca = v.created_at as string | undefined
      return ud ? ud === dateParam : (ca ? ca.startsWith(dateParam) : false)
    }
    const pendingVideos = db.filter(v => !v.skip && v.status === 'ready' && (!v.threads?.uploaded || !v.tiktok?.uploaded || !v.facebook?.uploaded))
    const filteredVideos = dateParam ? pendingVideos.filter(matchDate) : pendingVideos
    const videos = dateParam !== null ? filteredVideos : db
    const stats = {
      total: db.length,
      today_total: filteredVideos.length,
      today_pending: filteredVideos.length,
      ready: db.filter(v => v.status === 'ready').length,
      facebook_uploaded: db.filter(v => v.facebook?.uploaded).length,
      tiktok_uploaded: db.filter(v => v.tiktok?.uploaded).length,
      threads_uploaded: db.filter(v => v.threads?.uploaded).length,
      facebook_pending: filteredVideos.filter(v => !v.facebook?.uploaded).length,
      tiktok_pending: filteredVideos.filter(v => !v.tiktok?.uploaded).length,
      threads_pending: filteredVideos.filter(v => !v.threads?.uploaded).length,
      today,
    }
    const showBrowser: boolean = readSocialConfig()?.settings?.show_browser ?? true
    return NextResponse.json({ videos, stats, showBrowser })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  // Update a specific video's platform status
  try {
    const { id, platform, data } = await req.json()
    const db = readUploadDatabase()
    const video = db.find(v => v.id === id)
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    video[platform as 'facebook' | 'tiktok' | 'threads'] = {
      ...video[platform as 'facebook' | 'tiktok' | 'threads'],
      ...data,
    }
    writeUploadDatabase(db)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // Toggle show_browser in social-upload-tools/config.json
  try {
    const { showBrowser } = await req.json()
    const cfg = readSocialConfig()
    cfg.settings = { ...cfg.settings, show_browser: showBrowser }
    writeSocialConfig(cfg)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  // Toggle skip flag on a video
  try {
    const { id, skip } = await req.json()
    const db = readUploadDatabase()
    const video = db.find(v => v.id === id)
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    
    video.skip = skip
    writeUploadDatabase(db)

    // Sync the skip state to edit-video/videos.json so the Render step also skips it
    if (video.title) {
      const videosJson = readVideosJson()
      // Match using substring since prepare-upload truncates to 100 chars
      const targetVideo = videosJson.find(v => v.title.substring(0, 100) === video.title)
      if (targetVideo) {
        targetVideo.skip = skip
        writeVideosJson(videosJson)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
