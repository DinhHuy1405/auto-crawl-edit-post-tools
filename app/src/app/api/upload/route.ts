import { NextRequest, NextResponse } from 'next/server'
import { readUploadDatabase, writeUploadDatabase } from '@/lib/videos'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isToday(v: { upload_date?: string; created_at?: string }) {
  const today = todayStr()
  if (v.upload_date) return v.upload_date === today
  if (v.created_at) return v.created_at.startsWith(today)
  return false
}

export async function GET(req: NextRequest) {
  try {
    const db = readUploadDatabase()
    const todayOnly = req.nextUrl.searchParams.get('today') === '1'
    const videos = todayOnly ? db.filter(isToday) : db
    const today = todayStr()
    const todayVideos = db.filter(isToday)
    const stats = {
      total: db.length,
      today_total: todayVideos.length,
      today_pending: todayVideos.filter(v => !v.skip && v.status === 'ready' && (!v.threads?.uploaded || !v.tiktok?.uploaded || !v.facebook?.uploaded)).length,
      ready: db.filter(v => v.status === 'ready').length,
      facebook_uploaded: db.filter(v => v.facebook?.uploaded).length,
      tiktok_uploaded: db.filter(v => v.tiktok?.uploaded).length,
      threads_uploaded: db.filter(v => v.threads?.uploaded).length,
      facebook_pending: todayVideos.filter(v => !v.skip && !v.facebook?.uploaded && v.status === 'ready').length,
      tiktok_pending: todayVideos.filter(v => !v.skip && !v.tiktok?.uploaded && v.status === 'ready').length,
      threads_pending: todayVideos.filter(v => !v.skip && !v.threads?.uploaded && v.status === 'ready').length,
      today,
    }
    return NextResponse.json({ videos, stats })
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

export async function PATCH(req: NextRequest) {
  // Toggle skip flag on a video
  try {
    const { id, skip } = await req.json()
    const db = readUploadDatabase()
    const video = db.find(v => v.id === id)
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    video.skip = skip
    writeUploadDatabase(db)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
