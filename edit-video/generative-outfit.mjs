#!/usr/bin/env node
/**
 * Generative Outfit — Gemini Web Playwright Automation
 *
 * Flow: Chrome (logged-in session) → gemini.google.com → upload 2 ảnh + prompt
 *       → đợi generate → tải ảnh về → lặp cho tới khi xong
 *
 * Selectors verified from real Gemini DOM (2025):
 *   Upload : button[data-test-id="hidden-local-image-upload-button"]
 *   Input  : .ql-editor[contenteditable="true"]  (Quill inside rich-textarea)
 *   Send   : button[aria-label="Gửi tin nhắn"]   (vi locale) / button.send-button
 *   Image  : img.image.loaded[src^="blob:"]      → read blob via page.evaluate
 *
 * Usage:
 *   node generative-outfit.mjs --mode compose \
 *     --model  /path/to/model.jpg \
 *     --outfit /path/to/outfit.jpg \
 *     --prompts "Chụp toàn thân" "Chụp 3/4 góc nghiêng" \
 *     --output-dir ./temp-images/run_123 \
 *     --run-id  run_123
 */

import { createRequire } from 'module'
import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from 'fs'
import { dirname, resolve, basename, join, extname } from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Dùng playwright-core từ social-upload-tools (đã cài sẵn) ───────────────
const _require = createRequire(import.meta.url)
const { chromium } = _require(
  '../social-upload-tools/social-tool-main/node_modules/playwright-core/index.js'
)

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const getArg     = (flag, def = null) => { const i = args.indexOf(flag); return i !== -1 && args[i+1] ? args[i+1] : def }
const hasFlag    = (flag) => args.includes(flag)
const getMultiArg = (flag) => {
  const i = args.indexOf(flag); const r = []
  if (i !== -1) for (let j = i+1; j < args.length && !args[j].startsWith('--'); j++) r.push(args[j])
  return r
}

const mode        = getArg('--mode', 'compose')
const runId       = getArg('--run-id', `run_${Date.now()}`)
const showBrowser = !hasFlag('--headless')

console.log(`📝 Generative Outfit — mode: ${mode} | runId: ${runId}`)

// ─── Launch Chrome với profile của user (đã login Google/Gemini) ─────────────
async function launchBrowser() {
  const platform = os.platform()
  let userDataDir, executablePath

  let chromeParentDir
  if (platform === 'darwin') {
    chromeParentDir = join(os.homedir(), 'Library/Application Support/Google/Chrome')
    userDataDir    = join(chromeParentDir, 'Default')
    executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  } else if (platform === 'win32') {
    chromeParentDir = join(process.env.LOCALAPPDATA ?? join(os.homedir(), 'AppData/Local'), 'Google/Chrome/User Data')
    userDataDir    = join(chromeParentDir, 'Default')
    executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  } else {
    throw new Error('Unsupported platform: ' + platform)
  }

  // Xoá singleton lock ở CẢ HAI nơi: thư mục Chrome gốc VÀ profile Default
  // Chrome đặt lock ở chromeParentDir, Playwright đặt lock ở userDataDir
  for (const dir of [chromeParentDir, userDataDir]) {
    for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
      try { unlinkSync(join(dir, f)) } catch {}
    }
  }

  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: !showBrowser,
    executablePath,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
    viewport: { width: 1280, height: 900 },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    acceptDownloads: true,
  })

  return browser
}

// ─── Mở tab Gemini mới ───────────────────────────────────────────────────────
async function openGeminiPage(browser) {
  const page = await browser.newPage()
  console.log('🌐 Mở Gemini...')
  await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)

  // Kiểm tra đã login chưa
  const url = page.url()
  if (url.includes('accounts.google.com') || url.includes('signin') || url.includes('ServiceLogin')) {
    console.error('❌ Chưa login Google. Mở Chrome và đăng nhập vào gemini.google.com trước.')
    throw new Error('NOT_LOGGED_IN')
  }

  // Đợi input area + upload button xuất hiện (Gemini đã load xong)
  try {
    await page.waitForSelector('.ql-editor[contenteditable="true"]', { timeout: 15000 })
    // Đợi upload button (mat-mdc-button-touch-target inside upload button)
    await page.waitForSelector('button[aria-controls="upload-file-menu"], .upload-card-button', { timeout: 10000 }).catch(() => {})
    console.log('✅ Gemini đã load, URL:', url)
  } catch {
    console.log('⚠️ Timeout chờ input - tiếp tục thử...')
  }

  return page
}

// ─── Upload từng ảnh vào Gemini ────────────────────────────────────────────────
// Flow đúng: click editor → click "+" button → menu xuất hiện → click "Tải ảnh"
// → Playwright bắt filechooser của Gemini → setFiles → ảnh được upload lên server Gemini
async function uploadOneImage(page, imagePath) {
  console.log(`📤 Upload: ${basename(imagePath)}`)
  if (!existsSync(imagePath)) throw new Error(`File không tồn tại: ${imagePath}`)

  // ─── Focus vào editor trước để upload button hiện ra ─────────────────────────
  try {
    await page.click('.ql-editor[contenteditable="true"]', { timeout: 5000 })
    await page.waitForTimeout(400)
  } catch {}

  // ─── Cách 1: Click "+" → menu → "Tải ảnh" (flow chính xác của Gemini) ────────
  const PLUS_BTN = [
    'button[aria-controls="upload-file-menu"]',
    'button[aria-label="Mở trình đơn tải tệp lên"]',
    '.upload-card-button',
    'button.upload-card-button',
  ]

  for (const plusSel of PLUS_BTN) {
    try {
      await page.waitForSelector(plusSel, { state: 'visible', timeout: 6000 })
      console.log(`  → Upload button: ${plusSel}`)

      const [fc] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 18000 }),
        (async () => {
          await page.click(plusSel)
          await page.waitForTimeout(800) // chờ CDK menu animation

          // Lấy tất cả menu items đang hiển thị
          const menuItemSels = [
            '[role="menuitem"]',
            '.mat-mdc-menu-item',
            '.mat-menu-item',
          ]

          let clicked = false
          for (const mSel of menuItemSels) {
            const items = page.locator(mSel)
            const count = await items.count()
            if (count === 0) { await page.waitForTimeout(200); continue }

            // Log tất cả các text để debug
            const allTexts = await items.allTextContents()
            console.log(`  → Các menu items hiện có: ${allTexts.map(t => `"${t.trim()}"`).join(', ')}`)

            // Tìm chính xác mục "Tải tệp lên" hoặc chứa chữ "tải"
            let targetIdx = -1
            for (let idx = 0; idx < allTexts.length; idx++) {
              const text = allTexts[idx].toLowerCase()
              if (text.includes('tải') || text.includes('upload') || text.includes('file') || text.includes('tệp')) {
                targetIdx = idx
                break
              }
            }

            if (targetIdx !== -1) {
              const target = items.nth(targetIdx)
              const txt = await target.textContent().catch(() => '')
              await target.click({ force: true })
              console.log(`  → Click chính xác menu item: "${txt.trim()}"`)
              clicked = true
              break
            } else {
              // Nếu không thấy, thử click phần tử thứ 2 (thường là "Tải tệp lên" vì thứ 1 là "Ảnh")
              if (count > 1) {
                const target = items.nth(1)
                const txt = await target.textContent().catch(() => '')
                await target.click({ force: true })
                console.log(`  → Click phần tử thứ 2 (fallback): "${txt.trim()}"`)
                clicked = true
                break
              }
            }
          }

          if (!clicked) {
            // Không tìm thấy menu item nào — có thể click "+" trực tiếp mở filechooser
            console.log('  → Không thấy menu item, thử nhấn Enter...')
            await page.keyboard.press('Enter')
          }
        })(),
      ])

      await fc.setFiles([imagePath])
      console.log(`✅ Upload (menu flow): ${basename(imagePath)}`)
      await page.waitForTimeout(2500) // chờ Gemini upload lên server
      return
    } catch (e) {
      console.log(`⚠️ Plus button (${plusSel}) fail: ${e.message.slice(0, 100)}`)
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(400)
    }
  }

  // ─── Cách 2: Di chuyển hidden button vào viewport rồi Playwright click ────────
  // Playwright tạo user gesture thật (mouse events), không bị Chrome block
  for (const testId of ['hidden-local-image-upload-button', 'hidden-local-file-upload-button']) {
    try {
      const BTN = `button[data-test-id="${testId}"]`
      if (await page.locator(BTN).count() === 0) continue

      // Đặt button vào giữa viewport để Playwright click được
      await page.evaluate((sel) => {
        const el = document.querySelector(sel)
        if (!el) return
        el.style.cssText = `
          position: fixed !important;
          top: 50% !important; left: 50% !important;
          transform: translate(-50%, -50%) !important;
          width: 10px !important; height: 10px !important;
          opacity: 0.01 !important; z-index: 2147483647 !important;
          pointer-events: auto !important;
        `
      }, BTN)
      await page.waitForTimeout(200)

      const [fc] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 8000 }),
        page.locator(BTN).click(),
      ])
      await fc.setFiles([imagePath])
      console.log(`✅ Upload (forced ${testId}): ${basename(imagePath)}`)
      await page.waitForTimeout(2500)
      return
    } catch (e) {
      console.log(`⚠️ Forced ${testId} fail: ${e.message.slice(0, 80)}`)
    }
  }

  // ─── Cách 3: Drag & drop vào text-input-field (xapfileselectordropzone) ───────
  try {
    console.log('⏳ Thử drag & drop...')
    const buf  = readFileSync(imagePath)
    const ext  = extname(imagePath).slice(1).toLowerCase() || 'jpeg'
    const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', png: 'image/png' }[ext] || `image/${ext}`

    await page.evaluate(({ bytes, name, mime }) => {
      const zone = document.querySelector('[xapfileselectordropzone]') || document.querySelector('.text-input-field')
      if (!zone) return
      const file = new File([new Uint8Array(bytes)], name, { type: mime })
      const dt   = new DataTransfer(); dt.items.add(file)
      ;['dragenter','dragover','drop'].forEach(ev =>
        zone.dispatchEvent(new DragEvent(ev, { dataTransfer: dt, bubbles: true, cancelable: true }))
      )
    }, { bytes: Array.from(buf), name: basename(imagePath), mime })

    await page.waitForTimeout(2000)
    // Kiểm tra thumbnail blob xuất hiện
    const blobs = await page.evaluate(() =>
      [...document.querySelectorAll('img[src^="blob:"]')].length
    )
    if (blobs > 0) {
      console.log(`✅ Upload (drag&drop, ${blobs} blob imgs): ${basename(imagePath)}`)
      return
    }
    console.log('⚠️ Drag & drop: không thấy blob thumbnail')
  } catch (e) {
    console.log(`⚠️ Drag & drop fail: ${e.message.slice(0, 80)}`)
  }

  throw new Error(`Không thể upload ảnh vào Gemini: ${basename(imagePath)}`)
}

// ─── Upload nhiều ảnh tuần tự ─────────────────────────────────────────────────
async function uploadImages(page, imagePaths) {
  console.log(`📤 Upload ${imagePaths.length} ảnh...`)
  for (const imgPath of imagePaths) {
    await uploadOneImage(page, imgPath)
  }
  // Đợi thumbnail preview hiện ra
  await page.waitForTimeout(1000)
  console.log('✅ Upload xong tất cả ảnh')
}

// ─── Nhập prompt vào Quill editor và gửi ─────────────────────────────────────
async function typeAndSend(page, prompt) {
  console.log(`💬 Nhập prompt (${prompt.length} ký tự)...`)

  // Gemini dùng Quill editor — selector verified từ DOM
  const EDITOR = '.ql-editor[contenteditable="true"]'

  await page.waitForSelector(EDITOR, { timeout: 10000 })

  // Click vào editor để focus
  await page.click(EDITOR)
  await page.waitForTimeout(300)

  // Xoá nội dung cũ (nếu có)
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  await page.waitForTimeout(200)

  // Gõ prompt bằng keyboard.type (hoạt động tốt với contenteditable)
  await page.keyboard.type(prompt, { delay: 10 })
  await page.waitForTimeout(500)

  // Gửi — thử button "Gửi tin nhắn" trước, rồi Enter
  const SEND_BTN = 'button[aria-label="Gửi tin nhắn"], button.send-button'
  let sent = false

  try {
    const btn = page.locator(SEND_BTN).first()
    // Đợi button không bị disabled
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel)
        return el && !el.hasAttribute('aria-disabled') && el.getAttribute('aria-disabled') !== 'true'
      },
      'button[aria-label="Gửi tin nhắn"], button.send-button',
      { timeout: 5000 }
    ).catch(() => {})

    if (await btn.count() > 0) {
      await btn.click({ force: true })
      sent = true
      console.log('✅ Gửi qua button "Gửi tin nhắn"')
    }
  } catch (e) {
    console.log(`⚠️ Send button fail: ${e.message}`)
  }

  if (!sent) {
    await page.keyboard.press('Enter')
    console.log('✅ Gửi qua Enter')
  }
}

// ─── Đợi Gemini generate ảnh xong ────────────────────────────────────────────
async function waitForGeneration(page, timeoutMs = 120000) {
  console.log('⏳ Đợi Gemini generate ảnh...')
  const start = Date.now()

  // Đợi nút gửi trở về trạng thái disabled (đang xử lý) — tức là request đã gửi đi
  await page.waitForTimeout(2000)

  // Polling: kiểm tra xem ảnh đã xuất hiện chưa
  const GENERATED_IMG = 'img.image.loaded[src^="blob:"], img.image[src^="blob:"]'

  let found = false
  const pollEnd = Date.now() + timeoutMs
  while (Date.now() < pollEnd) {
    const count = await page.locator(GENERATED_IMG).count().catch(() => 0)
    if (count > 0) {
      found = true
      break
    }

    // Kiểm tra nếu send button đã re-enable (generate xong)
    const btnEnabled = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Gửi tin nhắn"], button.send-button')
      if (!btn) return false
      return btn.getAttribute('aria-disabled') !== 'true' && !btn.hasAttribute('aria-disabled')
    }).catch(() => false)

    // Chỉ dừng khi button enabled VÀ đã chờ ít nhất 10 giây
    if (btnEnabled && (Date.now() - start) > 10000) {
      console.log('✅ Send button re-enabled — generate xong')
      await page.waitForTimeout(2000) // thêm thời gian để ảnh render
      break
    }

    await page.waitForTimeout(1500)
  }

  const elapsed = Math.round((Date.now() - start) / 1000)
  if (found) {
    console.log(`✅ Phát hiện ảnh generated (${elapsed}s)`)
  } else {
    console.log(`⚠️ Hết timeout (${elapsed}s) — thử download ảnh hiện tại`)
  }

  // Thêm thời gian settle để ảnh render xong
  await page.waitForTimeout(2000)
}

// ─── Đọc ảnh blob từ browser và lưu về disk ──────────────────────────────────
async function downloadGeneratedImage(page, outputPath) {
  console.log('💾 Tìm và tải ảnh từ response...')

  mkdirSync(dirname(resolve(outputPath)), { recursive: true })

  // ─── Cách 1: img.image.loaded với blob URL (verified từ DOM) ─────────────────
  try {
    const BLOB_IMG = 'img.image.loaded[src^="blob:"], img.image[src^="blob:"]'
    const imgs = page.locator(BLOB_IMG)
    const count = await imgs.count()

    if (count > 0) {
      // Lấy ảnh cuối cùng (response mới nhất)
      const lastImg = imgs.last()
      const blobUrl = await lastImg.getAttribute('src')

      if (blobUrl && blobUrl.startsWith('blob:')) {
        console.log(`🖼️  Blob URL: ${blobUrl.slice(0, 60)}...`)

        // Đọc blob từ browser context (fetch trong page)
        const imgBytes = await page.evaluate(async (url) => {
          try {
            const res = await fetch(url)
            if (!res.ok) return null
            const ab = await res.arrayBuffer()
            return Array.from(new Uint8Array(ab))
          } catch (e) {
            return null
          }
        }, blobUrl)

        if (imgBytes && imgBytes.length > 5000) {
          writeFileSync(outputPath, Buffer.from(imgBytes))
          console.log(`✅ Lưu blob image: ${outputPath} (${Math.round(imgBytes.length / 1024)} KB)`)
          return true
        } else {
          console.log(`⚠️ Blob rỗng hoặc quá nhỏ (${imgBytes?.length ?? 0} bytes)`)
        }
      }
    }
  } catch (e) {
    console.log(`⚠️ Blob image fail: ${e.message}`)
  }

  // ─── Cách 2: Tìm img với alt "do AI tạo" ─────────────────────────────────────
  try {
    const AI_IMG = 'img[alt*="do AI tạo"], img[alt*="AI-generated"], img[alt*="generated"]'
    const aiImgs = page.locator(AI_IMG)
    const count = await aiImgs.count()
    if (count > 0) {
      const lastImg = aiImgs.last()
      const src = await lastImg.getAttribute('src')
      if (src) {
        let imgBytes = null
        if (src.startsWith('blob:')) {
          imgBytes = await page.evaluate(async (url) => {
            try {
              const res = await fetch(url)
              const ab = await res.arrayBuffer()
              return Array.from(new Uint8Array(ab))
            } catch { return null }
          }, src)
        } else if (src.startsWith('data:')) {
          const b64 = src.split(',')[1]
          imgBytes = Array.from(Buffer.from(b64, 'base64'))
        }

        if (imgBytes && imgBytes.length > 5000) {
          writeFileSync(outputPath, Buffer.from(imgBytes))
          console.log(`✅ Lưu AI img (alt): ${outputPath} (${Math.round(imgBytes.length / 1024)} KB)`)
          return true
        }
      }
    }
  } catch (e) {
    console.log(`⚠️ AI alt img fail: ${e.message}`)
  }

  // ─── Cách 3: Tất cả img lớn cuối cùng trong response ─────────────────────────
  try {
    // Lấy tất cả ảnh lớn trong trang, filter theo kích thước
    const largeSrc = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img[src^="blob:"], img[src^="data:image"]'))
      // Filter ảnh đủ lớn (> 100px)
      const large = imgs.filter(img => img.naturalWidth > 100 && img.naturalHeight > 100)
      return large.length > 0 ? large[large.length - 1].src : null
    })

    if (largeSrc) {
      let imgBytes = null
      if (largeSrc.startsWith('blob:')) {
        imgBytes = await page.evaluate(async (url) => {
          try {
            const res = await fetch(url)
            const ab = await res.arrayBuffer()
            return Array.from(new Uint8Array(ab))
          } catch { return null }
        }, largeSrc)
      } else if (largeSrc.startsWith('data:')) {
        const b64 = largeSrc.split(',')[1]
        imgBytes = Array.from(Buffer.from(b64, 'base64'))
      }

      if (imgBytes && imgBytes.length > 5000) {
        writeFileSync(outputPath, Buffer.from(imgBytes))
        console.log(`✅ Lưu large img: ${outputPath} (${Math.round(imgBytes.length / 1024)} KB)`)
        return true
      }
    }
  } catch (e) {
    console.log(`⚠️ Large img fail: ${e.message}`)
  }

  // ─── Cách 4: Screenshot element ảnh ─────────────────────────────────────────
  try {
    const imgEl = page.locator('img.image').last()
    if (await imgEl.count() > 0) {
      const bb = await imgEl.boundingBox()
      if (bb && bb.width > 100 && bb.height > 100) {
        const pngPath = outputPath.replace(/\.\w+$/, '.png')
        await imgEl.screenshot({ path: pngPath })
        console.log(`✅ Screenshot element: ${pngPath}`)
        return true
      }
    }
  } catch (e) {
    console.log(`⚠️ Screenshot element fail: ${e.message}`)
  }

  // Debug: in ra tất cả img trên trang để hiểu DOM
  try {
    const debugImgs = await page.evaluate(() => {
      return [...document.querySelectorAll('img')].map(img => ({
        src: img.src.slice(0, 80),
        cls: img.className,
        alt: img.alt,
        w: img.naturalWidth,
        h: img.naturalHeight,
      })).filter(i => i.w > 50 && !i.src.includes('gstatic'))
    })
    console.log(`🔍 Debug: ${debugImgs.length} img lớn:`, JSON.stringify(debugImgs.slice(0, 5)))
  } catch {}

  console.log('❌ Không tìm được ảnh generated')
  return false
}

// ─── Tạo một ảnh try-on (một lần gọi Gemini) ─────────────────────────────────
async function generateOne(page, modelPath, outfitPath, prompt, outputPath, maxAttempts = 2) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`\n🔄 Retry ${attempt}/${maxAttempts}...`)
        // Mở conversation mới
        await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(3000)
        // Đợi editor sẵn sàng
        await page.waitForSelector('.ql-editor[contenteditable="true"]', { timeout: 15000 }).catch(() => {})
      }

      // Upload cả 2 ảnh tuần tự
      await uploadImages(page, [resolve(modelPath), resolve(outfitPath)])

      // Nhập prompt và gửi
      await typeAndSend(page, prompt)

      // Đợi generate xong
      await waitForGeneration(page, 120000)

      // Tải ảnh về
      const success = await downloadGeneratedImage(page, outputPath)
      if (success) return true

      console.log(`⚠️ Attempt ${attempt}: không lấy được ảnh`)

    } catch (e) {
      console.log(`⚠️ Attempt ${attempt} error: ${e.message}`)
      if (attempt === maxAttempts) throw e
    }

    await page.waitForTimeout(2000)
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MODE: COMPOSE ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
if (mode === 'compose') {
  const modelPath   = getArg('--model') || getArg('--background')
  const outfitPath  = getArg('--outfit') || getArg('--extracted-outfit')
  const engine      = getArg('--engine', 'browser')
  const contextMode = getArg('--context-mode', 'model')
  const prompts     = getMultiArg('--prompts')
  const outputDir   = getArg('--output-dir', `./temp-images/${runId}`)
  const maxAttempts = parseInt(getArg('--max-attempts', '2'))
  const styleHint   = getArg('--style-hint', '')

  if (!modelPath || !outfitPath || !prompts.length) {
    console.error('❌ Thiếu: --model, --outfit, --prompts')
    process.exit(1)
  }
  if (!existsSync(resolve(modelPath))) { console.error(`❌ Model không tồn tại: ${modelPath}`); process.exit(1) }
  if (!existsSync(resolve(outfitPath))) { console.error(`❌ Outfit không tồn tại: ${outfitPath}`); process.exit(1) }

  mkdirSync(resolve(outputDir), { recursive: true })

  console.log(`\n🎨 Compose ${prompts.length} ảnh`)
  console.log(`👤 Model : ${basename(modelPath)}`)
  console.log(`👗 Outfit: ${basename(outfitPath)}`)
  console.log(`📁 Output: ${outputDir}`)
  console.log(`🌐 Browser: ${showBrowser ? 'hiển thị' : 'ẩn (headless)'}`)

  let browser
  const results = []

  try {
    browser = await launchBrowser()
    const page = await openGeminiPage(browser)

    for (let idx = 0; idx < prompts.length; idx++) {
      const anglePrompt = prompts[idx]
      const outputPath  = join(resolve(outputDir), `tryon-${idx + 1}.png`)

      console.log(`\n───────────────────────────────────────`)
      console.log(`📸 Generating angle ${idx + 1}/${prompts.length}: "${anglePrompt}"`)

      // Build prompt đầy đủ
      const fullPrompt = [
        ...(contextMode === 'background' ? [
          'Ảnh 1 là phông nền (background), Ảnh 2 là trang phục/sản phẩm.',
          'Hãy đặt Ảnh 2 vào trong Ảnh 1 sao cho tự nhiên nhất, đúng ánh sáng và tỉ lệ.',
          'Giữ nguyên: bối cảnh của phông nền ở Ảnh 1.',
          'Giữ nguyên: màu sắc, chi tiết của Ảnh 2.',
        ] : [
          'Ảnh 1 là người mẫu, Ảnh 2 là trang phục sản phẩm.',
          'Hãy tạo ảnh người mẫu MẶC trang phục từ Ảnh 2.',
          'Giữ nguyên: khuôn mặt, vóc dáng của người mẫu.',
          'Giữ nguyên: màu sắc, chi tiết, logo của trang phục.',
        ]),
        styleHint ? `Phong cách: ${styleHint}.` : '',
        anglePrompt,
        'Tỉ lệ ảnh dọc 9:16. Chất lượng cao, ánh sáng studio chuyên nghiệp.',
      ].filter(Boolean).join('\n')

      try {
        let success = false
        
        if (engine === 'api') {
          console.log(`⚠️ Gemini API SDK hiện không hỗ trợ Image-to-Image trực tiếp. Đang trả về lỗi để hệ thống dự phòng (nếu có).`)
          throw new Error('API_NOT_STABLE_FOR_IMAGES_YET')
        } else {
          success = await generateOne(page, modelPath, outfitPath, fullPrompt, outputPath, maxAttempts)
        }

        if (success) {
          const sizeKb = Math.round(readFileSync(outputPath).length / 1024)
          console.log(`✅ Lưu: ${outputPath} (${sizeKb} KB)`)

          // Emit event để Next.js API stream về UI
          console.log(`GENERATIVE_IMAGE_READY:${JSON.stringify({
            imagePath: resolve(outputPath),
            anglePrompt,
            sizeKb,
            index: idx,
          })}`)

          results.push({ path: resolve(outputPath), angle: anglePrompt, index: idx, sizeKb })
        } else {
          console.log(`⚠️ Bỏ qua ảnh ${idx + 1} (không lấy được ảnh)`)
        }
      } catch (err) {
        console.log(`❌ Lỗi ảnh ${idx + 1}: ${err.message}`)
      }

      // Mở conversation mới cho angle tiếp theo
      if (idx < prompts.length - 1) {
        console.log('⏳ Chuẩn bị conversation tiếp theo...')
        await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(3000)
        await page.waitForSelector('.ql-editor[contenteditable="true"]', { timeout: 15000 }).catch(() => {})
      }
    }

    console.log(`\n═══════════════════════════════════════`)
    console.log(`🎉 Hoàn thành: ${results.length}/${prompts.length} ảnh`)
    console.log(`GENERATIVE_COMPOSE_RESULT:${JSON.stringify({
      success: results.length > 0,
      images: results,
      outputDir: resolve(outputDir),
      totalCount: results.length,
      requestedCount: prompts.length,
    })}`)

  } catch (err) {
    console.error(`❌ Fatal: ${err.message}`)
    console.log(`GENERATIVE_COMPOSE_RESULT:${JSON.stringify({
      success: false,
      error: err.message,
      images: results,
      outputDir: resolve(outputDir),
      totalCount: results.length,
    })}`)
    process.exit(1)
  } finally {
    if (browser) {
      try { await browser.close() } catch {}
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MODE: EXTRACT-PRODUCT / EXTRACT-MODEL ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
else if (mode === 'extract-product' || mode === 'extract-model' || mode === 'extract') {
  const inputPath  = getArg('--input')
  const outputPath = getArg('--output')

  if (!inputPath || !outputPath) { console.error('❌ Thiếu: --input, --output'); process.exit(1) }

  mkdirSync(dirname(resolve(outputPath)), { recursive: true })

  // Phân biệt prompt theo mode
  let prompt = ''
  if (mode === 'extract-product' || mode === 'extract') {
    prompt = `Hãy tách sản phẩm quần áo hoặc phụ kiện ra khỏi nền. Giữ lại toàn bộ sản phẩm: quần áo, phụ kiện, logo, chi tiết. Loại bỏ: người mặc, tay, chân, nền cũ. Đặt sản phẩm trên nền trắng sạch. Giữ nguyên 100% màu sắc gốc, texture, đường viền rõ nét. Tạo ảnh output sạch sẽ, sẵn sàng dùng.`
  } else if (mode === 'extract-model') {
    prompt = `Hãy tạo character sheet người mẫu này với 3 góc nhìn: (1) Mặt thẳng, nhìn camera, toàn thân. (2) Ngoại cảnh 3/4 phải. (3) Ngoại cảnh 3/4 trái. Nền trắng sạch, đồng nhất. Giữ nguyên: khuôn mặt, mắt, tóc, da. Tư thế tự nhiên, ánh sáng studio chuyên nghiệp. Tạo ảnh output rõ nét.`
  }

  let browser
  try {
    browser = await launchBrowser()
    const page = await openGeminiPage(browser)

    await uploadImages(page, [resolve(inputPath)])
    await typeAndSend(page, prompt)
    await waitForGeneration(page, 120000)
    const success = await downloadGeneratedImage(page, outputPath)

    if (success) {
      const sizeKb = Math.round(readFileSync(outputPath).length / 1024)
      console.log(`✅ Extracted: ${outputPath} (${sizeKb} KB)`)
      console.log(`EXTRACTION_RESULT:${JSON.stringify({ success: true, imagePath: resolve(outputPath), sizeKb })}`)
    } else {
      console.log(`EXTRACTION_RESULT:${JSON.stringify({ success: false, error: 'No image in response. Gemini may have refused the prompt about real people or produced only text.' })}`)
      process.exit(1)
    }
  } catch (err) {
    console.error(`❌ ${err.message}`)
    console.log(`EXTRACTION_RESULT:${JSON.stringify({ success: false, error: err.message })}`)
    process.exit(1)
  } finally {
    if (browser) try { await browser.close() } catch {}
  }
}

else {
  console.error(`❌ Unknown mode: ${mode}`)
  process.exit(1)
}
