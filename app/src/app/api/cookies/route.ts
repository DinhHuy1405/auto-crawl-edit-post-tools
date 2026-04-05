import { NextRequest, NextResponse } from 'next/server'
import { PATHS } from '@/lib/config'
import fs from 'fs'
import path from 'path'

const COOKIES_DIR = path.join(path.dirname(PATHS.cookieFile), 'cookies')
const ACCOUNTS_FILE = path.join(COOKIES_DIR, 'accounts.json')

interface CookieAccount {
  id: string
  label: string
  enabled: boolean
  createdAt: string
}

function readAccounts(): CookieAccount[] {
  if (!fs.existsSync(ACCOUNTS_FILE)) return []
  try { return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')) } catch { return [] }
}

function writeAccounts(accounts: CookieAccount[]) {
  fs.mkdirSync(COOKIES_DIR, { recursive: true })
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf8')
}

function cookieFilePath(id: string) {
  return path.join(COOKIES_DIR, `cookie-${id}.txt`)
}

// GET /api/cookies - list all accounts with their cookie content
export async function GET() {
  try {
    const accounts = readAccounts()
    const result = accounts.map(acc => ({
      ...acc,
      content: fs.existsSync(cookieFilePath(acc.id))
        ? fs.readFileSync(cookieFilePath(acc.id), 'utf8')
        : '',
    }))
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/cookies - add new account
export async function POST(req: NextRequest) {
  try {
    const { label, content } = await req.json()
    const accounts = readAccounts()
    const id = Date.now().toString()
    const newAccount: CookieAccount = {
      id, label: label || `Account ${accounts.length + 1}`,
      enabled: true, createdAt: new Date().toISOString(),
    }
    accounts.push(newAccount)
    writeAccounts(accounts)
    fs.mkdirSync(COOKIES_DIR, { recursive: true })
    fs.writeFileSync(cookieFilePath(id), content || '', 'utf8')
    return NextResponse.json(newAccount)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PUT /api/cookies - update account (label, content, enabled)
export async function PUT(req: NextRequest) {
  try {
    const { id, label, content, enabled } = await req.json()
    const accounts = readAccounts()
    const idx = accounts.findIndex(a => a.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (label !== undefined) accounts[idx].label = label
    if (enabled !== undefined) accounts[idx].enabled = enabled
    writeAccounts(accounts)
    if (content !== undefined) {
      fs.mkdirSync(COOKIES_DIR, { recursive: true })
      fs.writeFileSync(cookieFilePath(id), content, 'utf8')
    }
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE /api/cookies - remove account
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    const accounts = readAccounts()
    const filtered = accounts.filter(a => a.id !== id)
    writeAccounts(filtered)
    const fp = cookieFilePath(id)
    if (fs.existsSync(fp)) fs.unlinkSync(fp)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
