import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { ROOT_DIR, PATHS } from '@/lib/config'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'

// Map runId → process for cancellation
const runningJobs = new Map<string, ReturnType<typeof spawn>>()

// ─── GET: list clip jobs ─────────────────────────────────────────────────────
export async function GET() {
  const tempDir = path.join(ROOT_DIR, 'temp-clips')
  if (!fs.existsSync(tempDir)) return NextResponse.json({ jobs: [] })

  const jobs = fs.readdirSync(tempDir)
    .filter(d => fs.statSync(path.join(tempDir, d)).isDirectory())
    .map(d => {
      const jobDir  = path.join(tempDir, d)
      const clipsDir = path.join(jobDir, 'clips')
      const clips = fs.existsSync(clipsDir)
        ? fs.readdirSync(clipsDir).filter(f => f.endsWith('.mp4')).sort().map(f => ({
            name: f,
            path: path.join(clipsDir, f),
            size: fs.statSync(path.join(clipsDir, f)).size,
          }))
        : []
      return { id: d, dir: jobDir, clipsDir, clips, clipCount: clips.length }
    })
    .sort((a, b) => b.id.localeCompare(a.id))

  return NextResponse.json({ jobs })
}

// ─── POST: start a clip-cut job ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { url, duration = 60, startTime, endTime, maxClips = 0, runId, title } = body

  if (!url?.trim()) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const jobTitle = title?.trim() || `job_${Date.now()}`
  const outputDir = path.join(ROOT_DIR, 'temp-clips', jobTitle)

  const scriptArgs = [
    path.join(ROOT_DIR, 'edit-video', 'clip-cutter.mjs'),
    '--url',      url.trim(),
    '--duration', String(duration),
    '--output',   outputDir,
    '--title',    jobTitle,
  ]
  if (startTime)       scriptArgs.push('--start', startTime)
  if (endTime)         scriptArgs.push('--end',   endTime)
  if (maxClips > 0)    scriptArgs.push('--max-clips', String(maxClips))

  const stream = new ReadableStream({
    start(controller) {
      const enc = (s: string) => new TextEncoder().encode(s)
      let closed = false

      const send = (type: string, payload: object) => {
        if (closed) return
        controller.enqueue(enc(`data: ${JSON.stringify({ type, ...payload })}\n\n`))
      }

      send('log', { message: `🎬 Starting clip cutter job: ${jobTitle}`, level: 'info' })
      send('log', { message: `📥 URL: ${url}`, level: 'dim' })
      send('log', { message: `✂️  Duration: ${duration}s  MaxClips: ${maxClips || 'all'}`, level: 'dim' })
      send('log', { message: '─'.repeat(60), level: 'dim' })

      const proc = spawn('node', scriptArgs, {
        cwd: ROOT_DIR,
        env: { ...process.env, FORCE_COLOR: '0' },
      })

      if (runId) runningJobs.set(runId, proc)

      let resultJson: object | null = null

      const handleLine = (line: string, isStderr = false) => {
        if (!line.trim()) return

        // Parse result JSON emitted by the script
        if (line.startsWith('CLIP_CUTTER_RESULT:')) {
          try { resultJson = JSON.parse(line.slice('CLIP_CUTTER_RESULT:'.length)) } catch {}
          return
        }

        const level = line.includes('❌') || line.toLowerCase().includes('error') ? 'error'
          : line.includes('✅') ? 'success'
          : line.includes('⚠️') ? 'warning'
          : isStderr && !line.includes('frame=') ? 'warning'
          : 'default'
        send('log', { message: line, level })
      }

      proc.stdout.on('data', (d: Buffer) =>
        d.toString().split('\n').forEach(l => handleLine(l, false)))
      proc.stderr.on('data', (d: Buffer) =>
        d.toString().split('\n').forEach(l => handleLine(l, true)))

      proc.on('close', (code) => {
        if (runId) runningJobs.delete(runId)
        send('log', { message: '─'.repeat(60), level: 'dim' })
        if (code === 0) {
          send('log', { message: '✅ Clip cutting completed!', level: 'success' })
          send('done', { success: true, code, result: resultJson, jobTitle, outputDir })
        } else {
          send('log', { message: `❌ Clip cutting failed (exit ${code})`, level: 'error' })
          send('done', { success: false, code, jobTitle })
        }
        if (!closed) { closed = true; controller.close() }
      })

      proc.on('error', (err) => {
        send('log', { message: `Process error: ${err.message}`, level: 'error' })
        send('done', { success: false, error: err.message })
        if (!closed) { closed = true; controller.close() }
      })
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// ─── DELETE: cancel a running job ────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('runId')
  if (runId && runningJobs.has(runId)) {
    runningJobs.get(runId)!.kill('SIGTERM')
    runningJobs.delete(runId)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
