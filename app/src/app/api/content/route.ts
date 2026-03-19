import { NextRequest, NextResponse } from 'next/server'
import { readGeneratedContent, writeGeneratedContent } from '@/lib/videos'
import path from 'path'

export async function GET(req: NextRequest) {
  const folderPath = req.nextUrl.searchParams.get('folder')
  if (!folderPath) return NextResponse.json({ error: 'Missing folder' }, { status: 400 })
  try {
    const content = readGeneratedContent(decodeURIComponent(folderPath))
    return NextResponse.json(content || {})
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const folderPath = req.nextUrl.searchParams.get('folder')
  if (!folderPath) return NextResponse.json({ error: 'Missing folder' }, { status: 400 })
  try {
    const body = await req.json()
    writeGeneratedContent(decodeURIComponent(folderPath), body)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
