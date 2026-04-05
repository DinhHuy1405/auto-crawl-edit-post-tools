/**
 * POST /api/ai/generative-outfit/extract
 * Extracts outfit/product from image background using Gemini Free (Playwright)
 * Streams SSE with progress logs
 */

import { spawn } from 'child_process'
import { resolve } from 'path'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sourceImagePath, runId, mode = 'extract-product' } = body

    if (!sourceImagePath || !runId) {
      return NextResponse.json({ error: 'Missing sourceImagePath or runId' }, { status: 400 })
    }

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const send = (type: string, data: any) => {
          controller.enqueue(`data: ${JSON.stringify({ type, ...data })}\n\n`)
        }

        const outName = mode === 'extract-model' ? 'model-extracted.jpg' : 'product-extracted.png'

        // Spawn generative-outfit.mjs with extract mode
        const proc = spawn('node', [
          resolve(process.cwd(), '../../../edit-video/generative-outfit.mjs'),
          '--mode', mode,
          '--input', sourceImagePath,
          '--output', `./temp-images/${runId}/${outName}`,
          '--run-id', runId
        ])

        let logBuffer = ''

        proc.stdout?.on('data', (chunk) => {
          const text = chunk.toString()
          logBuffer += text

          // Process log lines
          const lines = logBuffer.split('\n')
          logBuffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('✅') || line.startsWith('📝') || line.startsWith('⚠️')) {
              const level = line.startsWith('✅') ? 'success' : line.startsWith('⚠️') ? 'warning' : 'info'
              send('log', { message: line, level })
            }
            if (line.startsWith('EXTRACTION_RESULT:')) {
              try {
                const result = JSON.parse(line.replace('EXTRACTION_RESULT:', ''))
                if (result.success) {
                  send('extraction-done', {
                    imagePath: result.imagePath,
                    message: 'Outfit extracted successfully'
                  })
                  send('done', { success: true })
                }
              } catch (e) {
                send('log', { message: `Parse error: ${String(e)}`, level: 'error' })
              }
            }
          }
        })

        proc.stderr?.on('data', (chunk) => {
          send('log', { message: chunk.toString(), level: 'error' })
        })

        proc.on('close', (code) => {
          if (code !== 0) {
            send('done', { success: false, error: `Process exited with code ${code}` })
          }
          controller.close()
        })

        proc.on('error', (err) => {
          send('log', { message: `Process error: ${err.message}`, level: 'error' })
          send('done', { success: false, error: err.message })
          controller.close()
        })
      }
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
