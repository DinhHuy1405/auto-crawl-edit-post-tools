import { NextRequest, NextResponse } from 'next/server'
import { readUploadDatabase, writeUploadDatabase } from '@/lib/videos'

export async function GET() {
  try {
    const db = readUploadDatabase()
    const stats = {
      total: db.length,
      ready: db.filter(v => v.status === 'ready').length,
      facebook_uploaded: db.filter(v => v.facebook?.uploaded).length,
      tiktok_uploaded: db.filter(v => v.tiktok?.uploaded).length,
      threads_uploaded: db.filter(v => v.threads?.uploaded).length,
      facebook_pending: db.filter(v => !v.facebook?.uploaded && v.status === 'ready').length,
      tiktok_pending: db.filter(v => !v.tiktok?.uploaded && v.status === 'ready').length,
      threads_pending: db.filter(v => !v.threads?.uploaded && v.status === 'ready').length,
    }
    return NextResponse.json({ videos: db, stats })
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
