import { NextRequest, NextResponse } from 'next/server'
import { getTemplateVideos, getBackgroundMusic, getLogos, getFonts } from '@/lib/assets'
import { ROOT_DIR } from '@/lib/config'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  try {
    switch (type) {
      case 'templates': return NextResponse.json(getTemplateVideos())
      case 'music': return NextResponse.json(getBackgroundMusic())
      case 'logos': return NextResponse.json(getLogos())
      case 'fonts': return NextResponse.json(getFonts())
      default:
        return NextResponse.json({
          templates: getTemplateVideos(),
          music: getBackgroundMusic(),
          logos: getLogos(),
          fonts: getFonts(),
        })
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // Upload a new asset file
  try {
    const type = req.nextUrl.searchParams.get('type') || 'logos'
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const targetDir = path.join(ROOT_DIR, 'edit-video', 'assets', type === 'templates' ? 'f' : '')
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    const filePath = path.join(targetDir, file.name)
    fs.writeFileSync(filePath, buffer)
    return NextResponse.json({ ok: true, path: filePath, name: file.name })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const filePath = req.nextUrl.searchParams.get('path')
    if (!filePath) return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    const absPath = path.join(ROOT_DIR, filePath)
    // Safety check - only delete within assets dir
    if (!absPath.includes('edit-video/assets')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
