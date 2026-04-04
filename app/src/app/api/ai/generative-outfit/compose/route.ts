/**
 * POST /api/ai/generative-outfit/compose
 * Generates multi-angle outfit composites using Gemini Free (Playwright)
 * Takes extracted outfit + background + angle prompts
 * Streams SSE with progress and generated images
 */

import { spawn } from 'child_process'
import { resolve } from 'path'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      backgroundImagePath,
      extractedOutfitPath,
      anglePrompts,
      aspectRatio,
      maxAttemptsPerAngle,
      enhancePrompts,
      styleHint,
      runId
    } = body

    if (!backgroundImagePath || !extractedOutfitPath || !anglePrompts?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: backgroundImagePath, extractedOutfitPath, anglePrompts' },
        { status: 400 }
      )
    }

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const send = (type: string, data: any) => {
          controller.enqueue(`data: ${JSON.stringify({ type, ...data })}\n\n`)
        }

        // Build command args
        const args = [
          resolve(process.cwd(), '../../../edit-video/generative-outfit.mjs'),
          '--mode', 'compose',
          '--background', backgroundImagePath,
          '--outfit', extractedOutfitPath,
          '--aspect-ratio', aspectRatio || '9:16',
          '--output-dir', `./temp-images/${runId}`,
          '--run-id', runId
        ]

        // Add angle prompts
        args.push('--prompts')
        anglePrompts.forEach(p => args.push(p))

        // Optional flags
        if (maxAttemptsPerAngle) {
          args.push('--max-attempts', String(maxAttemptsPerAngle))
        }
        if (enhancePrompts) {
          args.push('--enhance-prompts')
        }
        if (styleHint) {
          args.push('--style-hint', styleHint)
        }

        // Spawn generative-outfit.mjs
        const proc = spawn('node', args)

        let logBuffer = ''
        let imageCount = 0

        proc.stdout?.on('data', (chunk) => {
          const text = chunk.toString()
          logBuffer += text

          // Process log lines
          const lines = logBuffer.split('\n')
          logBuffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue

            // Log lines
            if (line.startsWith('✅') || line.startsWith('📝') || line.startsWith('⚠️')) {
              const level = line.startsWith('✅') ? 'success' : line.startsWith('⚠️') ? 'warning' : 'info'
              send('log', { message: line, level })
            }

            // Progress lines: "Generating angle X/Y: ..."
            if (line.includes('Generating angle')) {
              const match = line.match(/Generating angle (\d+)\/(\d+)/)
              if (match) {
                const angleIndex = parseInt(match[1]) - 1
                const totalAngles = parseInt(match[2])
                send('progress', {
                  currentAngle: angleIndex,
                  totalAngles,
                  anglePrompt: anglePrompts[angleIndex] || ''
                })
              }
            }

            // Image ready lines
            if (line.startsWith('GENERATIVE_IMAGE_READY:')) {
              try {
                const result = JSON.parse(line.replace('GENERATIVE_IMAGE_READY:', ''))
                send('image-ready', {
                  imagePath: result.imagePath,
                  anglePrompt: result.anglePrompt,
                  aspectRatio: aspectRatio,
                  imageIndex: imageCount++
                })
              } catch (e) {
                send('log', { message: `Parse error: ${String(e)}`, level: 'error' })
              }
            }

            // Done line
            if (line.startsWith('GENERATIVE_COMPOSE_RESULT:')) {
              try {
                const result = JSON.parse(line.replace('GENERATIVE_COMPOSE_RESULT:', ''))
                send('done', {
                  success: result.success,
                  totalImages: result.images?.length || imageCount,
                  outputDir: result.outputDir,
                  error: result.error
                })
              } catch (e) {
                send('log', { message: `Parse error: ${String(e)}`, level: 'error' })
                send('done', { success: false, error: 'Result parsing failed' })
              }
            }
          }
        })

        proc.stderr?.on('data', (chunk) => {
          send('log', { message: chunk.toString(), level: 'error' })
        })

        proc.on('close', (code) => {
          if (code !== 0 && imageCount === 0) {
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
