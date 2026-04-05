import { NextRequest, NextResponse } from 'next/server'
import { ROOT_DIR } from '@/lib/config'
import fs from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const ext = path.extname(file.name) || '.jpg'
    const filename = `upload_${Date.now()}${ext}`
    const saveDir = path.join(ROOT_DIR, 'temp-images', 'uploads')
    fs.mkdirSync(saveDir, { recursive: true })
    const savePath = path.join(saveDir, filename)

    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(savePath, buffer)

    return NextResponse.json({ path: savePath, name: file.name, filename })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const filePath = req.nextUrl.searchParams.get('path')
    if (!filePath) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

    // Support both relative (from ROOT_DIR) and absolute paths
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(ROOT_DIR, filePath)

    if (!fs.existsSync(absPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const stat = fs.statSync(absPath)
    const ext = path.extname(absPath).toLowerCase()
    const mimeMap: Record<string, string> = {
      '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
      '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
      '.aac': 'audio/aac', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    }
    const contentType = mimeMap[ext] || 'application/octet-stream'

    // Support range requests for video streaming
    const range = req.headers.get('range')
    if (range && (contentType.startsWith('video/') || contentType.startsWith('audio/'))) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024, stat.size - 1)
      const chunkSize = end - start + 1
      const stream = fs.createReadStream(absPath, { start, end })
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(Buffer.from(chunk))
      return new NextResponse(Buffer.concat(chunks), {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': contentType,
        },
      })
    }

    const buffer = fs.readFileSync(absPath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
