import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { ROOT_DIR, PATHS } from '@/lib/config'
import path from 'path'
import fs from 'fs'

function getUploadPlatforms(): string[] {
  try {
    const raw = fs.readFileSync(path.join(ROOT_DIR, 'config.json'), 'utf8')
    const cfg = JSON.parse(raw)
    const platforms = cfg?.upload?.platforms
    if (Array.isArray(platforms) && platforms.length > 0) return platforms
  } catch {}
  return ['tiktok', 'threads', 'facebook']
}

// Global process map to allow stopping
const runningProcesses = new Map<string, ReturnType<typeof spawn>>()

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { step, runId } = await req.json()

  // Prefer project venv python if present (keeps same environment as run-workflow.mjs)
  const venvPython = path.join(ROOT_DIR, '.venv', 'bin', 'python3')
  const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3'

  const steps: Record<string, { cmd: string; args: string[]; cwd: string; label: string }> = {
    crawl: {
      cmd: pythonCmd,
      args: [path.join(ROOT_DIR, 'crawl-upload-tools', 'crawl', 'crawl-video.py')],
      cwd: ROOT_DIR,
      label: '🕷️ Crawling videos...',
    },
    news: {
      cmd: 'node',
      args: ['generate-news.js'],
      cwd: path.join(ROOT_DIR, 'edit-video'),
      label: '📰 Generating news...',
    },
    voice: {
      cmd: 'node',
      args: ['generate-voice.js'],
      cwd: path.join(ROOT_DIR, 'edit-video'),
      label: '🎤 Generating voice...',
    },
    prepare: {
      cmd: 'node',
      args: ['prepare-videos.mjs'],
      cwd: path.join(ROOT_DIR, 'edit-video'),
      label: '📋 Preparing videos list...',
    },
    render: {
      cmd: 'node',
      args: ['run.mjs'],
      cwd: path.join(ROOT_DIR, 'edit-video'),
      label: '🎬 Rendering videos...',
    },
    'prepare-upload': {
      cmd: 'node',
      args: ['prepare-upload.mjs'],
      cwd: path.join(ROOT_DIR, 'social-upload-tools'),
      label: '📦 Preparing upload database...',
    },
    upload: {
      cmd: 'node',
      args: ['upload-all-platforms.mjs', ...getUploadPlatforms()],
      cwd: path.join(ROOT_DIR, 'social-upload-tools'),
      label: '📤 Uploading to platforms...',
    },
    full: {
      cmd: 'node',
      args: ['run-workflow.mjs'],
      cwd: ROOT_DIR,
      label: '🚀 Running full workflow...',
    },
  }

  const stepConfig = steps[step]
  if (!stepConfig) {
    return NextResponse.json({ error: `Unknown step: ${step}` }, { status: 400 })
  }

  const stream = new ReadableStream({
    start(controller) {
      const encode = (data: string) => new TextEncoder().encode(data)

      let isClosed = false;
      const sendEvent = (type: string, payload: object) => {
        if (isClosed) return;
        controller.enqueue(encode(`data: ${JSON.stringify({ type, ...payload })}\n\n`))
      }

      sendEvent('log', { message: stepConfig.label, level: 'info' })
      sendEvent('log', { message: `CMD: ${stepConfig.cmd} ${stepConfig.args.join(' ')}`, level: 'dim' })
      sendEvent('log', { message: `CWD: ${stepConfig.cwd}`, level: 'dim' })
      sendEvent('log', { message: '-'.repeat(60), level: 'dim' })

      try {
        const proc = spawn(stepConfig.cmd, stepConfig.args, {
          cwd: stepConfig.cwd,
          env: { ...process.env, FORCE_COLOR: '0' },
        })

        if (runId) runningProcesses.set(runId, proc)

        proc.stdout.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n')
          for (const line of lines) {
            if (!line.trim()) continue
            const level = line.includes('❌') || line.includes('FAILED') || line.includes('ERROR') ? 'error'
              : line.includes('✅') || line.includes('SUCCESS') ? 'success'
              : line.includes('⚠️') || line.includes('WARNING') ? 'warning'
              : line.includes('📤') || line.includes('🎬') || line.includes('⏳') ? 'info'
              : 'default'
            sendEvent('log', { message: line, level })
          }
        })

        proc.stderr.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n')
          for (const line of lines) {
            if (!line.trim()) continue
            // Some tools write normal output to stderr
            const level = line.toLowerCase().includes('error') ? 'error' : 'warning'
            sendEvent('log', { message: line, level })
          }
        })

        proc.on('close', (code) => {
          if (runId) runningProcesses.delete(runId)
          sendEvent('log', { message: '-'.repeat(60), level: 'dim' })
          if (code === 0) {
            sendEvent('log', { message: `✅ Step "${step}" completed successfully`, level: 'success' })
            sendEvent('done', { success: true, step, code })
          } else {
            sendEvent('log', { message: `❌ Step "${step}" failed (exit code ${code})`, level: 'error' })
            sendEvent('done', { success: false, step, code })
          }
          if (!isClosed) {
            isClosed = true;
            controller.close()
          }
        })

        proc.on('error', (err) => {
          sendEvent('log', { message: `Process error: ${err.message}`, level: 'error' })
          sendEvent('done', { success: false, step, error: err.message })
          if (!isClosed) {
            isClosed = true;
            controller.close()
          }
        })
      } catch (err: unknown) {
        sendEvent('log', { message: `Failed to start: ${String(err)}`, level: 'error' })
        sendEvent('done', { success: false, step, error: String(err) })
        if (!isClosed) {
          isClosed = true;
          controller.close()
        }
      }
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

export async function DELETE(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('runId')
  if (runId && runningProcesses.has(runId)) {
    const proc = runningProcesses.get(runId)!
    proc.kill('SIGTERM')
    runningProcesses.delete(runId)
    return NextResponse.json({ ok: true, message: 'Process terminated' })
  }
  return NextResponse.json({ error: 'No running process found' }, { status: 404 })
}
