import { NextRequest, NextResponse } from 'next/server'
import { readConfig, writeConfig, readApiKeys, writeApiKeys } from '@/lib/config'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  try {
    if (type === 'api-keys') {
      const keys = readApiKeys()
      // Mask key values for security
      const masked = {
        gemini: keys.gemini.map(k => ({ ...k, key: k.key.slice(0, 8) + '...' + k.key.slice(-4) })),
        tts: keys.tts.map(k => ({ ...k, key: k.key.slice(0, 8) + '...' + k.key.slice(-4) })),
      }
      return NextResponse.json(masked)
    }
    return NextResponse.json(readConfig())
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  try {
    const body = await req.json()
    if (type === 'api-keys') {
      writeApiKeys(body)
      return NextResponse.json({ ok: true })
    }
    writeConfig(body)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // Reset quota exceeded for a specific key
  try {
    const { service, name } = await req.json()
    const keys = readApiKeys()
    const list = service === 'tts' ? keys.tts : keys.gemini
    const key = list.find(k => k.name === name)
    if (key) {
      key.status = 'active'
      key.quotaExceededAt = null
      writeApiKeys(keys)
    }
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
