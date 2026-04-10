'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus, X, Loader2, Image as ImageIcon, FolderOpen,
  Sparkles, Play, Square, Check, Download, ChevronDown,
  Wand2, Settings2, Layers, AlertTriangle, RefreshCw,
  Pencil, ChevronUp, ChevronLeft, ChevronRight,
} from 'lucide-react'
import {
  Engine, OutputFmt, CtxMode,
  ProductItem, AngleConfig, ContextAsset, PipelineProgress,
  DEFAULT_ANGLES,
} from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9)

function imgUrl(path: string) {
  return `/api/file?path=${encodeURIComponent(path)}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Toggle pill (2 options) */
function Toggle<T extends string>({ value, options, onChange, disabled }: {
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className="flex bg-slate-100 p-0.5 rounded-lg">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} disabled={disabled}
          className={cn(
            'flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all leading-tight text-center',
            value === o.value ? 'bg-white shadow text-violet-700' : 'text-slate-500 hover:text-slate-700',
            disabled && 'opacity-50 cursor-not-allowed',
          )}>
          {o.label}
          {o.hint && <span className="block text-[9px] font-normal opacity-60">{o.hint}</span>}
        </button>
      ))}
    </div>
  )
}

/** Image upload drop zone */
function UploadZone({ preview, onFile, onClear, disabled, className, placeholder = 'Click hoặc thả ảnh' }: {
  preview?: string | null
  onFile: (f: File) => void
  onClear?: () => void
  disabled?: boolean
  className?: string
  placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onClick={() => !disabled && ref.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) onFile(f) }}
      className={cn(
        'relative border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden',
        disabled ? 'opacity-50 cursor-not-allowed border-slate-200' : 'hover:border-violet-400 hover:bg-violet-50/50',
        preview ? 'border-violet-300' : 'border-slate-200',
        className,
      )}
    >
      <input ref={ref} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-1 p-2 text-center">
          <ImageIcon className="w-5 h-5 text-slate-300" />
          <span className="text-[9px] text-slate-400 leading-tight">{placeholder}</span>
        </div>
      )}
      {preview && onClear && (
        <button onClick={e => { e.stopPropagation(); onClear() }}
          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10 shadow">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

/** Single product card in the list */
function ProductCard({ item, onRemove, onMoveUp, onMoveDown, running }: {
  item: ProductItem
  onRemove: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  running: boolean
}) {
  const allAngles = item.angles
  const doneCount = allAngles.filter(a => a.status === 'done').length
  const totalEnabled = allAngles.length

  return (
    <div className={cn(
      'flex gap-2.5 p-2 rounded-xl border transition-all',
      item.status === 'running' ? 'border-violet-300 bg-violet-50' :
      item.status === 'done'    ? 'border-green-200 bg-green-50/40' :
      item.status === 'error'   ? 'border-red-200 bg-red-50/40' :
      'border-slate-200 bg-white',
    )}>
      {/* Thumbnail + bg-removed */}
      <div className="flex gap-1 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.sourcePreview} alt="" className="w-10 h-10 object-cover rounded-lg border border-slate-100" />
        {item.bgStatus === 'done' && item.bgRemovedPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.bgRemovedPreview} alt="bg-removed" className="w-10 h-10 object-cover rounded-lg border-2 border-green-300" title="Đã bóc nền" />
        ) : item.bgStatus === 'processing' ? (
          <div className="w-10 h-10 rounded-lg border border-slate-200 bg-amber-50 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          </div>
        ) : null}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-slate-700 truncate">{item.fileName}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {/* Bg status badge */}
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-medium', {
            'bg-slate-100 text-slate-500': item.bgStatus === 'idle',
            'bg-amber-100 text-amber-600': item.bgStatus === 'processing',
            'bg-green-100 text-green-600': item.bgStatus === 'done',
            'bg-red-100 text-red-500':     item.bgStatus === 'error',
          })}>
            {item.bgStatus === 'idle' ? 'Chờ bóc nền' : item.bgStatus === 'processing' ? 'Bóc nền...' : item.bgStatus === 'done' ? '✓ Nền trắng' : '✗ Lỗi'}
          </span>
          {/* Progress */}
          {item.status !== 'pending' && (
            <span className="text-[9px] text-slate-400">{doneCount}/{totalEnabled} góc</span>
          )}
          {item.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-violet-400" />}
          {item.status === 'done' && <Check className="w-3 h-3 text-green-500" />}
          {item.status === 'error' && <AlertTriangle className="w-3 h-3 text-red-400" />}
        </div>

        {/* Angle results mini-grid */}
        {item.angles.some(a => a.status === 'done' && a.previewUrl) && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {item.angles.filter(a => a.status === 'done' && a.previewUrl).map(a => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a.angleId} src={a.previewUrl} alt={a.label} title={a.label}
                className="w-7 h-9 object-cover rounded border border-green-200" />
            ))}
            {item.angles.filter(a => a.status === 'running').map(a => (
              <div key={a.angleId} className="w-7 h-9 rounded border border-violet-200 bg-violet-50 flex items-center justify-center">
                <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reorder + Remove */}
      {!running && (
        <div className="flex flex-col items-center gap-0.5 shrink-0 self-start mt-0.5">
          <button onClick={onMoveUp} disabled={!onMoveUp}
            className="text-slate-300 hover:text-slate-500 disabled:opacity-0 transition-colors">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRemove} className="text-slate-300 hover:text-red-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={!onMoveDown}
            className="text-slate-300 hover:text-slate-500 disabled:opacity-0 transition-colors">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

/** Angle config — editable prompts + add custom */
const DEFAULT_ANGLE_IDS = new Set(['front', 'q3', 'close', 'dynamic', 'back', 'sit'])

function AngleConfigPanel({ angles, onChange, disabled }: {
  angles: AngleConfig[]
  onChange: (angles: AngleConfig[]) => void
  disabled: boolean
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const enabledCount = angles.filter(a => a.enabled).length

  const toggle = (id: string) => {
    if (disabled) return
    onChange(angles.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a))
  }
  const updatePrompt = (id: string, prompt: string) =>
    onChange(angles.map(a => a.id === id ? { ...a, prompt } : a))
  const updateLabel = (id: string, label: string) =>
    onChange(angles.map(a => a.id === id ? { ...a, label } : a))
  const removeAngle = (id: string) => {
    onChange(angles.filter(a => a.id !== id))
    if (editingId === id) setEditingId(null)
  }
  const addAngle = () => {
    const id = `custom_${Date.now()}`
    onChange([...angles, { id, label: 'Góc tùy chỉnh', prompt: '', enabled: true }])
    setEditingId(id)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-slate-600">Góc máy sinh ảnh</label>
        <span className="text-[10px] text-violet-600 font-medium">{enabledCount} góc được chọn</span>
      </div>

      <div className="space-y-1.5">
        {angles.map(a => (
          <div key={a.id} className={cn(
            'rounded-lg border transition-all',
            editingId === a.id ? 'border-violet-400 bg-violet-50/50' :
            a.enabled ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-white',
          )}>
            {/* Row */}
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <button onClick={() => toggle(a.id)} disabled={disabled}
                className={cn(
                  'w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-all flex items-center justify-center',
                  a.enabled ? 'border-violet-500 bg-violet-500' : 'border-slate-300 bg-white',
                  disabled && 'cursor-not-allowed',
                )}>
                {a.enabled && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </button>

              {editingId === a.id ? (
                <input value={a.label} onChange={e => updateLabel(a.id, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 text-[11px] font-medium bg-transparent border-b border-violet-300 focus:outline-none py-0.5" />
              ) : (
                <span onClick={() => !disabled && toggle(a.id)}
                  className="flex-1 text-[11px] font-medium text-slate-700 truncate cursor-pointer select-none">
                  {a.label}
                </span>
              )}

              {!disabled && (
                <button onClick={() => setEditingId(editingId === a.id ? null : a.id)}
                  className={cn('p-0.5 rounded shrink-0 transition-colors',
                    editingId === a.id ? 'text-violet-600' : 'text-slate-300 hover:text-violet-400')}>
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {!disabled && !DEFAULT_ANGLE_IDS.has(a.id) && (
                <button onClick={() => removeAngle(a.id)}
                  className="p-0.5 text-slate-300 hover:text-red-400 rounded shrink-0 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Prompt editor (expanded) */}
            {editingId === a.id && (
              <div className="px-2.5 pb-2.5">
                <textarea value={a.prompt} onChange={e => updatePrompt(a.id, e.target.value)}
                  rows={3} placeholder="Nhập prompt chi tiết cho góc chụp này..."
                  className="w-full text-[10px] px-2 py-1.5 border border-violet-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400/40 resize-none bg-white leading-relaxed" />
              </div>
            )}
          </div>
        ))}
      </div>

      {!disabled && (
        <button onClick={addAngle}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-slate-400 hover:text-violet-500 hover:bg-violet-50 border border-dashed border-slate-200 hover:border-violet-300 rounded-lg transition-all">
          <Plus className="w-3 h-3" /> Thêm góc tùy chỉnh
        </button>
      )}
      <p className="text-[9px] text-slate-400 mt-1.5">Click ● để bật/tắt · Click ✏ để sửa prompt</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AICreatorPanel({ disabled = false, onRunningChange }: { disabled?: boolean; onRunningChange?: (r: boolean) => void }) {
  // ── Global Settings ────────────────────────────────────────────────────────
  const [engine, setEngine]       = useState<Engine>('browser')
  const [outputFmt, setOutputFmt] = useState<OutputFmt>('images')
  const [ctxMode, setCtxMode]     = useState<CtxMode>('model')

  // ── Products ───────────────────────────────────────────────────────────────
  const [products, setProducts]   = useState<ProductItem[]>([])
  const [urlInput, setUrlInput]   = useState('')
  const productFileRef            = useRef<HTMLInputElement>(null)
  const folderFileRef             = useRef<HTMLInputElement>(null)
  const modelFolderRef            = useRef<HTMLInputElement>(null)
  const bgFolderRef               = useRef<HTMLInputElement>(null)

  // ── Context Asset (shared model or background) ─────────────────────────────
  const [ctx, setCtx] = useState<ContextAsset>({
    modelPrompt: 'Cô gái trẻ người Việt Nam khoảng 20 tuổi, gương mặt xinh xắn, vẻ đẹp tự nhiên, làn da trắng sáng, vóc dáng mảnh mai, đứng trong studio ánh sáng trắng chuyên nghiệp, nhìn thẳng vào camera',
    bgPrompt: 'Phòng studio sạch sẽ, ánh sáng đẹp, nền trắng tinh tế, chuyên nghiệp',
  })

  // ── Angles ─────────────────────────────────────────────────────────────────
  const [angles, setAngles] = useState<AngleConfig[]>(DEFAULT_ANGLES)

  // ── Pipeline ───────────────────────────────────────────────────────────────
  const [progress, setProgress] = useState<PipelineProgress>({
    phase: 'idle', currentProductIdx: 0, currentAngleIdx: 0,
    totalImages: 0, doneImages: 0, errorImages: 0,
  })
  const [logs, setLogs] = useState<{ msg: string; level: string }[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // ── Lightbox ────────────────────────────────────────────────────────────────
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  const running = progress.phase !== 'idle' && progress.phase !== 'done'

  // Notify parent of running state changes
  const prevRunningRef = useRef(false)
  if (running !== prevRunningRef.current) {
    prevRunningRef.current = running
    onRunningChange?.(running)
  }

  // ── Storage: restore on mount ──────────────────────────────────────────────
  useEffect(() => {
    // Restore prompts từ localStorage
    try {
      const saved = localStorage.getItem('ai-creator-ctx')
      if (saved) setCtx(prev => ({ ...prev, ...JSON.parse(saved) }))
    } catch {}
    // Restore angles config từ localStorage
    try {
      const saved = localStorage.getItem('ai-creator-angles')
      if (saved) {
        const parsed: { id: string; enabled: boolean; prompt: string; label: string }[] = JSON.parse(saved)
        setAngles(prev => {
          // Merge enabled/prompt changes vào default angles
          const merged = prev.map(a => {
            const s = parsed.find(x => x.id === a.id)
            return s ? { ...a, enabled: s.enabled, prompt: s.prompt, label: s.label } : a
          })
          // Thêm các custom angles (không có trong defaults)
          const defaultIds = new Set(prev.map(a => a.id))
          const customs = parsed.filter(x => !defaultIds.has(x.id))
          return [...merged, ...customs]
        })
      }
    } catch {}
    // Restore products từ sessionStorage (paths vẫn còn, blob URLs đã mất)
    try {
      const saved = sessionStorage.getItem('ai-creator-products')
      if (saved) {
        const prods: ProductItem[] = JSON.parse(saved)
        setProducts(prods.map(p => ({
          ...p,
          // Blob URL không còn hiệu lực sau reload — dùng API URL thay
          sourcePreview: p.sourcePath.startsWith('http') ? p.sourcePath : `/api/file?path=${encodeURIComponent(p.sourcePath)}`,
          bgRemovedPreview: p.bgRemovedPath ? `/api/file?path=${encodeURIComponent(p.bgRemovedPath)}` : undefined,
          // Reset trạng thái đang chạy về pending
          status: p.status === 'running' ? 'pending' : p.status,
          bgStatus: p.bgStatus === 'processing' ? 'idle' : p.bgStatus,
          angles: p.angles.map(a => ({ ...a, status: a.status === 'running' ? 'pending' : a.status })),
        })))
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Storage: persist on change ────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('ai-creator-ctx', JSON.stringify({ modelPrompt: ctx.modelPrompt, bgPrompt: ctx.bgPrompt }))
  }, [ctx.modelPrompt, ctx.bgPrompt])

  useEffect(() => {
    localStorage.setItem('ai-creator-angles', JSON.stringify(
      angles.map(a => ({ id: a.id, enabled: a.enabled, prompt: a.prompt, label: a.label }))
    ))
  }, [angles])

  useEffect(() => {
    if (!running) sessionStorage.setItem('ai-creator-products', JSON.stringify(products))
  }, [products, running])

  // ── Log auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // ── Lightbox: ESC để đóng ─────────────────────────────────────────────────
  useEffect(() => {
    if (lightboxIdx === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null)
      if (e.key === 'ArrowRight') setLightboxIdx(i => i !== null && i < allOutputImages.length - 1 ? i + 1 : i)
      if (e.key === 'ArrowLeft') setLightboxIdx(i => i !== null && i > 0 ? i - 1 : i)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIdx])

  // ── Post-processing results ────────────────────────────────────────────────
  const [outputVideos, setOutputVideos] = useState<string[]>([])

  // ── Log helper ────────────────────────────────────────────────────────────
  const log = useCallback((msg: string, level = 'default') => {
    setLogs(prev => [...prev.slice(-300), { msg, level }])
  }, [])

  // ── Move product up/down ───────────────────────────────────────────────────
  const moveProduct = useCallback((idx: number, dir: -1 | 1) => {
    setProducts(prev => {
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }, [])

  // ── File upload helper ─────────────────────────────────────────────────────
  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/file', { method: 'POST', body: fd })
    if (!res.ok) return null
    const { path } = await res.json()
    return path as string
  }, [])

  // ── Add product files ──────────────────────────────────────────────────────
  const addProductFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (!imageFiles.length) return

    for (const file of imageFiles) {
      const preview  = URL.createObjectURL(file)
      const savedPath = await uploadFile(file)
      if (!savedPath) { toast.error(`Upload thất bại: ${file.name}`); continue }

      const enabledAngles = angles.filter(a => a.enabled)
      setProducts(prev => [...prev, {
        id:           uid(),
        sourcePath:   savedPath,
        sourcePreview: preview,
        fileName:     file.name,
        bgStatus:     'idle',
        angles:       enabledAngles.map(a => ({ angleId: a.id, label: a.label, status: 'pending' })),
        status:       'pending',
      }])
    }
  }, [uploadFile, angles])

  const addProductUrl = useCallback((url: string) => {
    if (!url.trim()) return
    const enabledAngles = angles.filter(a => a.enabled)
    setProducts(prev => [...prev, {
      id:           uid(),
      sourcePath:   url.trim(),
      sourcePreview: url.trim(),
      fileName:     url.split('/').pop() || url,
      bgStatus:     'idle',
      angles:       enabledAngles.map(a => ({ angleId: a.id, label: a.label, status: 'pending' })),
      status:       'pending',
    }])
    setUrlInput('')
  }, [angles])

  // ── Upload context asset ───────────────────────────────────────────────────
  const handleCtxFile = useCallback(async (file: File, field: 'model' | 'bg') => {
    const preview = URL.createObjectURL(file)
    const saved   = await uploadFile(file)
    if (!saved) { toast.error('Upload thất bại'); return }
    if (field === 'model') setCtx(p => ({ ...p, modelImagePath: saved, modelImagePreview: preview }))
    else                   setCtx(p => ({ ...p, bgImagePath:    saved, bgImagePreview:    preview }))
  }, [uploadFile])

  // ── Load product folder ────────────────────────────────────────────────────
  const handleLoadProductFolder = useCallback((files: FileList | null) => {
    if (!files) return
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) { toast.error('Không tìm thấy ảnh trong folder'); return }
    addProductFiles(imageFiles)
    toast.success(`Đã thêm ${imageFiles.length} ảnh sản phẩm`)
  }, [addProductFiles])

  // ── Load model from folder ────────────────────────────────────────────────
  const handleLoadModelFolder = useCallback(async (files: FileList | null) => {
    if (!files) return
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) { toast.error('Không tìm thấy ảnh trong folder'); return }
    // Dùng ảnh đầu tiên làm model
    await handleCtxFile(imageFiles[0], 'model')
    toast.success(`Đã load model: ${imageFiles[0].name}`)
  }, [handleCtxFile])

  // ── Load background from folder ───────────────────────────────────────────
  const handleLoadBgFolder = useCallback(async (files: FileList | null) => {
    if (!files) return
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) { toast.error('Không tìm thấy ảnh trong folder'); return }
    // Dùng ảnh đầu tiên làm background
    await handleCtxFile(imageFiles[0], 'bg')
    toast.success(`Đã load background: ${imageFiles[0].name}`)
  }, [handleCtxFile])

  // ── Stream SSE helper ──────────────────────────────────────────────────────
  const streamSSE = useCallback(async (
    url: string,
    body: object,
    signal: AbortSignal,
    onEvent: (ev: Record<string, unknown>) => void,
  ): Promise<void> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.body) throw new Error('No stream')
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const parts = buf.split('\n\n'); buf = parts.pop() || ''
      for (const part of parts) {
        const line = part.replace(/^data: /, '').trim()
        if (!line) continue
        try { onEvent(JSON.parse(line)) } catch {}
      }
    }
  }, [])

  // ── Run Pipeline ───────────────────────────────────────────────────────────
  const runPipeline = useCallback(async () => {
    if (!products.length) { toast.error('Thêm ít nhất 1 ảnh sản phẩm'); return }
    const enabledAngles = angles.filter(a => a.enabled)
    if (!enabledAngles.length) { toast.error('Chọn ít nhất 1 góc máy'); return }
    if (ctxMode === 'model' && !ctx.modelImagePath && !ctx.modelPrompt.trim()) {
      toast.error('Cần ảnh mẫu hoặc text mô tả nhân vật'); return
    }

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const totalImages = products.length * enabledAngles.length
    setProgress({ phase: 'bg-remove', currentProductIdx: 0, currentAngleIdx: 0, totalImages, doneImages: 0, errorImages: 0 })
    setLogs([])
    setOutputVideos([])

    // Reset product states
    setProducts(prev => prev.map(p => ({
      ...p,
      bgStatus: 'idle',
      angles: enabledAngles.map(a => ({ angleId: a.id, label: a.label, status: 'pending' })),
      status: 'pending',
    })))

    let modelPath = ctx.modelImagePath || null

    // ── Phase 0: Nếu cần model + chưa có ảnh → generate từ text ─────────────
    if (ctxMode === 'model' && !modelPath && ctx.modelPrompt.trim()) {
      log('👤 Đang tạo nhân vật mẫu từ text prompt...', 'info')
      try {
        await streamSSE('/api/ai-creator', { prompt: ctx.modelPrompt, ratio: '9:16', runId: `model_${Date.now()}` }, ctrl.signal, ev => {
          if (ev.type === 'log') log(ev.message as string, ev.level as string || 'default')
          if (ev.type === 'done' && ev.success && (ev as Record<string, unknown>).imageResult) {
            const ir = (ev as Record<string, unknown>).imageResult as Record<string, unknown>
            modelPath = ir.primaryPath as string
            setCtx(p => ({ ...p, modelImagePath: modelPath!, modelImagePreview: imgUrl(modelPath!) }))
            log(`✅ Nhân vật mẫu: ${modelPath}`, 'success')
          }
        })
      } catch (e: unknown) { if ((e as Error).name !== 'AbortError') log(`❌ Tạo model thất bại: ${e}`, 'error') }
    }

    // ── Phase 1: Bóc nền từng sản phẩm ──────────────────────────────────────
    log('\n🖼️ Phase 1: Bóc nền sản phẩm (white background)...', 'info')
    setProgress(p => ({ ...p, phase: 'bg-remove' }))

    for (let pi = 0; pi < products.length; pi++) {
      if (ctrl.signal.aborted) break
      const prod = products[pi]
      setProgress(p => ({ ...p, currentProductIdx: pi }))

      setProducts(prev => prev.map((p, i) => i === pi ? { ...p, bgStatus: 'processing', status: 'running' } : p))
      log(`  → Bóc nền sản phẩm ${pi + 1}/${products.length}: ${prod.fileName}`, 'default')

      try {
        let bgRemovedPath: string | undefined
        await streamSSE('/api/ai/generative-outfit/extract', {
          sourceImagePath: prod.sourcePath,
          runId: `bgremove_${prod.id}`,
          engine,
        }, ctrl.signal, ev => {
          if (ev.type === 'log') log(ev.message as string, 'dim')
          if (ev.type === 'extraction-done') bgRemovedPath = (ev as Record<string, unknown>).imagePath as string
        })

        if (bgRemovedPath) {
          setProducts(prev => prev.map((p, i) => i === pi ? {
            ...p, bgStatus: 'done',
            bgRemovedPath, bgRemovedPreview: imgUrl(bgRemovedPath!),
          } : p))
          log(`  ✅ Đã bóc nền: ${bgRemovedPath.split('/').pop()}`, 'success')
        } else {
          // Fallback: dùng ảnh gốc nếu bóc nền thất bại
          setProducts(prev => prev.map((p, i) => i === pi ? {
            ...p, bgStatus: 'error',
            bgRemovedPath: prod.sourcePath, bgRemovedPreview: prod.sourcePreview,
          } : p))
          log(`  ⚠️ Bóc nền thất bại, dùng ảnh gốc`, 'warning')
        }
      } catch (e: unknown) {
        if ((e as Error).name === 'AbortError') break
        setProducts(prev => prev.map((p, i) => i === pi ? { ...p, bgStatus: 'error' } : p))
        log(`  ❌ Lỗi bóc nền: ${e}`, 'error')
      }
    }

    // ── Phase 2: Sinh ảnh multi-angle ────────────────────────────────────────
    log('\n🎨 Phase 2: Sinh ảnh đa góc máy...', 'info')
    setProgress(p => ({ ...p, phase: 'generating' }))
    let doneImages = 0; let errorImages = 0
    const allOutputPaths: string[] = []

    for (let pi = 0; pi < products.length; pi++) {
      if (ctrl.signal.aborted) break
      setProgress(p => ({ ...p, currentProductIdx: pi }))
      const prodSnapshot = products[pi]

      log(`\n📦 Sản phẩm ${pi + 1}/${products.length}: ${prodSnapshot.fileName}`, 'info')
      setProducts(prev => prev.map((p, i) => i === pi ? { ...p, status: 'running' } : p))

      // Lấy đường dẫn ảnh đã bóc nền (hoặc ảnh gốc)
      const outfitPath = prodSnapshot.bgRemovedPath || prodSnapshot.sourcePath

      for (let ai = 0; ai < enabledAngles.length; ai++) {
        if (ctrl.signal.aborted) break
        const angle = enabledAngles[ai]
        setProgress(p => ({ ...p, currentAngleIdx: ai }))

        // Set angle → running
        setProducts(prev => prev.map((p, i) => i === pi ? {
          ...p,
          angles: p.angles.map(a => a.angleId === angle.id ? { ...a, status: 'running' } : a),
        } : p))

        log(`  📸 [${ai + 1}/${enabledAngles.length}] ${angle.label}...`, 'default')

        try {
          let imagePath: string | undefined
          await streamSSE('/api/ai/generative-outfit/compose', {
            modelImagePath:  ctxMode === 'model' ? modelPath : undefined,
            backgroundImagePath: ctxMode === 'background' ? ctx.bgImagePath : undefined,
            outfitImagePath: outfitPath,
            anglePrompts: [angle.prompt],
            aspectRatio: '9:16',
            styleHint: 'professional fashion photography, studio lighting',
            runId: `${prodSnapshot.id}_${angle.id}`,
            aiEngine: engine,
            aiContextMode: ctxMode,
          }, ctrl.signal, ev => {
            if (ev.type === 'log') log(ev.message as string, 'dim')
            if (ev.type === 'image-ready') imagePath = (ev as Record<string, unknown>).imagePath as string
          })

          if (imagePath) {
            doneImages++
            allOutputPaths.push(imagePath)
            setProgress(p => ({ ...p, doneImages }))
            setProducts(prev => prev.map((p, i) => i === pi ? {
              ...p,
              angles: p.angles.map(a => a.angleId === angle.id ? {
                ...a, status: 'done', imagePath, previewUrl: imgUrl(imagePath!),
              } : a),
            } : p))
            log(`  ✅ Lưu: ${imagePath.split('/').pop()}`, 'success')
          } else {
            errorImages++
            setProgress(p => ({ ...p, errorImages }))
            setProducts(prev => prev.map((p, i) => i === pi ? {
              ...p,
              angles: p.angles.map(a => a.angleId === angle.id ? { ...a, status: 'error' } : a),
            } : p))
            log(`  ⚠️ Không lấy được ảnh cho góc: ${angle.label}`, 'warning')
          }
        } catch (e: unknown) {
          if ((e as Error).name === 'AbortError') break
          errorImages++
          setProgress(p => ({ ...p, errorImages }))
          setProducts(prev => prev.map((p, i) => i === pi ? {
            ...p,
            angles: p.angles.map(a => a.angleId === angle.id ? { ...a, status: 'error' } : a),
          } : p))
          log(`  ❌ Lỗi: ${e}`, 'error')
        }
      }

      setProducts(prev => prev.map((p, i) => i === pi ? { ...p, status: 'done' } : p))
    }

    // ── Phase 3: Post-processing ──────────────────────────────────────────────
    log(`\n🎞️ Phase 3: Post-processing (${outputFmt})...`, 'info')
    setProgress(p => ({ ...p, phase: 'post' }))

    if (outputFmt === 'video') {
      // Nhóm ảnh theo product, render video cho từng product
      for (let pi = 0; pi < products.length; pi++) {
        if (ctrl.signal.aborted) break
        const prod = products[pi]
        const imageSequence = prod.angles
          .filter(a => a.status === 'done' && a.imagePath)
          .map(a => a.imagePath!)

        if (imageSequence.length < 2) {
          log(`⚠️ Sản phẩm ${pi + 1} chỉ có ${imageSequence.length} ảnh, bỏ qua render video`, 'warning')
          continue
        }

        log(`  🎬 Render video sản phẩm ${pi + 1}: ${imageSequence.length} ảnh...`, 'info')
        // NOTE: API render-video cần được implement riêng
        // Đây là placeholder — kết nối vào existing render pipeline
        log(`  → [Placeholder] Gọi /api/render-video với ${imageSequence.length} ảnh`, 'dim')
      }
    }

    // Done
    const msg = `🎉 Hoàn thành! ${doneImages} ảnh tạo thành công, ${errorImages} lỗi`
    log(`\n${msg}`, 'success')
    toast.success(msg)
    setProgress(p => ({ ...p, phase: 'done' }))
  }, [products, angles, ctxMode, ctx, engine, outputFmt, log, streamSSE])

  const stopPipeline = useCallback(() => {
    abortRef.current?.abort()
    setProgress(p => ({ ...p, phase: 'idle' }))
    log('⛔ Đã dừng pipeline', 'warning')
  }, [log])

  // ── Derived ────────────────────────────────────────────────────────────────
  const enabledAngles = angles.filter(a => a.enabled)
  const allOutputImages = products.flatMap(p => p.angles.filter(a => a.status === 'done' && a.previewUrl).map(a => a.previewUrl!))
  const totalExpected = products.length * enabledAngles.length

  return (
    <div className="space-y-4">

      {/* ═══ HEADER STATUS BAR ═══════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">AI Affiliate Creator</p>
            <p className="text-xs opacity-70 mt-0.5">Sản phẩm → Bóc nền → Ghép model → Đa góc → Video/Ảnh</p>
          </div>
          <div className="flex items-center gap-2">
            {running ? (
              <button onClick={stopPipeline}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm">
                <Square className="w-3.5 h-3.5 fill-white" /> Dừng
              </button>
            ) : (
              <button onClick={runPipeline} disabled={disabled || !products.length}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-white text-violet-700 hover:bg-violet-50 rounded-lg transition-colors shadow-sm disabled:opacity-40">
                <Play className="w-3.5 h-3.5 fill-violet-600" /> Chạy Pipeline
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {running && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] opacity-80 mb-1">
              <span>
                {{
                  'bg-remove':   '🖼️ Đang bóc nền...',
                  'generating':  `🎨 Đang sinh ảnh (${progress.doneImages}/${totalExpected})`,
                  'post':        '🎞️ Post-processing...',
                  'done':        '✅ Hoàn thành',
                  'idle':        '',
                }[progress.phase]}
              </span>
              <span>{totalExpected > 0 ? Math.round((progress.doneImages / totalExpected) * 100) : 0}%</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${totalExpected > 0 ? (progress.doneImages / totalExpected) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ═══ ROW 1: Global Settings ══════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Settings2 className="w-3.5 h-3.5" /> Cài Đặt Chung
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Engine</label>
            <Toggle value={engine} onChange={setEngine} disabled={running} options={[
              { value: 'browser', label: 'Playwright', hint: 'Miễn phí' },
              { value: 'api',     label: 'Gemini API', hint: 'Trả phí' },
            ]} />
            <p className="text-[9px] text-slate-400 mt-1">
              {engine === 'browser' ? '→ Mở Chrome thật, dùng session đã login' : '→ Gọi trực tiếp Gemini Imagen API'}
            </p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Ngữ cảnh (Context Mode)</label>
            <Toggle value={ctxMode} onChange={setCtxMode} disabled={running} options={[
              { value: 'model',      label: '👤 Người Mẫu',  hint: 'Trang phục / Thời trang' },
              { value: 'background', label: '🖼️ Phông Nền',  hint: 'Nước hoa / Mỹ phẩm' },
            ]} />
            <p className="text-[9px] text-slate-400 mt-1">
              {ctxMode === 'model' ? '→ Ghép sản phẩm lên người mẫu (virtual try-on)' : '→ Đặt sản phẩm trên phông nền đẹp'}
            </p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Đầu ra (Output)</label>
            <Toggle value={outputFmt} onChange={setOutputFmt} disabled={running} options={[
              { value: 'images', label: '🖼️ Bộ ảnh',   hint: 'Download/Export' },
              { value: 'video',  label: '🎬 Video clip', hint: 'TikTok/Reels' },
            ]} />
            <p className="text-[9px] text-slate-400 mt-1">
              {outputFmt === 'images' ? '→ Xuất từng ảnh, đặt tên theo sản phẩm + góc' : '→ Ghép ảnh thành slideshow video cho từng sản phẩm'}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ ROW 2: Three-column main layout ════════════════════════════════ */}
      <div className="grid grid-cols-[300px_1fr_280px] gap-4">

        {/* ─ COL 1: Products Input ──────────────────────────────────────── */}
        <div className="space-y-3">

          {/* Product upload */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-violet-500" /> Ảnh Sản Phẩm
              <span className="ml-auto text-[10px] font-normal text-slate-400">{products.length} ảnh</span>
            </h3>

            {/* Upload actions */}
            <div className="flex gap-2 mb-3">
              {/* Single/Multi file */}
              <button
                onClick={() => !running && productFileRef.current?.click()}
                disabled={running}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium border-2 border-dashed border-violet-200 hover:border-violet-400 hover:bg-violet-50 text-violet-600 rounded-lg transition-all disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" /> Chọn ảnh
              </button>
              <input ref={productFileRef} type="file" accept="image/*" multiple hidden
                onChange={e => { addProductFiles(Array.from(e.target.files || [])); e.target.value = '' }} />

              {/* Folder */}
              <button
                onClick={() => !running && folderFileRef.current?.click()}
                disabled={running}
                title="Chọn cả thư mục"
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-500 hover:text-violet-600 rounded-lg transition-all disabled:opacity-40">
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
              {/* @ts-expect-error webkitdirectory not typed */}
              <input ref={folderFileRef} type="file" accept="image/*" multiple hidden webkitdirectory=""
                onChange={e => { addProductFiles(Array.from(e.target.files || [])); e.target.value = '' }} />
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); addProductFiles(Array.from(e.dataTransfer.files)) }}
              className="text-center py-3 text-[10px] text-slate-400 border border-dashed border-slate-200 rounded-lg mb-3">
              Thả nhiều ảnh vào đây
            </div>

            {/* URL input */}
            <div className="flex gap-1.5">
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)} disabled={running}
                onKeyDown={e => { if (e.key === 'Enter') addProductUrl(urlInput) }}
                placeholder="Hoặc dán URL ảnh..."
                className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400/40 focus:border-violet-400 bg-slate-50" />
              <button onClick={() => addProductUrl(urlInput)} disabled={running || !urlInput.trim()}
                className="px-2.5 py-1.5 text-xs text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Product list */}
            <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto">
              {products.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic text-center py-4">Chưa có sản phẩm. Upload ảnh hoặc chọn thư mục.</p>
              ) : products.map((prod, i) => (
                <ProductCard key={prod.id} item={prod} running={running}
                  onRemove={() => setProducts(prev => prev.filter((_, idx) => idx !== i))}
                  onMoveUp={i > 0 ? () => moveProduct(i, -1) : undefined}
                  onMoveDown={i < products.length - 1 ? () => moveProduct(i, 1) : undefined}
                />
              ))}
            </div>

            {products.length > 0 && !running && (
              <button onClick={() => setProducts([])}
                className="w-full mt-2 py-1.5 text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                Xoá tất cả
              </button>
            )}
          </div>
        </div>

        {/* ─ COL 2: Context Asset + Angle Config ────────────────────────── */}
        <div className="space-y-3">

          {/* Context Asset */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-emerald-500" />
              {ctxMode === 'model' ? '👤 Nhân Vật Mẫu (dùng chung cho tất cả sản phẩm)' : '🖼️ Phông Nền (dùng chung cho tất cả sản phẩm)'}
            </h3>

            <div className="flex gap-3">
              {/* Upload zone + Load folder button */}
              <div className="flex flex-col gap-1.5">
                <UploadZone
                  preview={ctxMode === 'model' ? ctx.modelImagePreview : ctx.bgImagePreview}
                  onFile={f => handleCtxFile(f, ctxMode === 'model' ? 'model' : 'bg')}
                  onClear={() => ctxMode === 'model'
                    ? setCtx(p => ({ ...p, modelImagePath: undefined, modelImagePreview: undefined }))
                    : setCtx(p => ({ ...p, bgImagePath: undefined, bgImagePreview: undefined }))
                  }
                  disabled={running}
                  className="w-28 h-28 shrink-0"
                  placeholder={ctxMode === 'model' ? 'Upload\nảnh mẫu' : 'Upload\nphông nền'}
                />
                {!running && (
                  <button
                    onClick={() => ctxMode === 'model' ? modelFolderRef.current?.click() : bgFolderRef.current?.click()}
                    className="px-2 py-1 text-[10px] text-slate-500 hover:text-violet-600 border border-slate-200 hover:border-violet-300 hover:bg-violet-50 rounded-lg transition-all flex items-center justify-center gap-1">
                    <FolderOpen className="w-3 h-3" /> Folder
                  </button>
                )}
              </div>
              {/* @ts-expect-error webkitdirectory not typed */}
              <input ref={modelFolderRef} type="file" accept="image/*" multiple hidden webkitdirectory=""
                onChange={e => { handleLoadModelFolder(e.target.files); e.target.value = '' }} />
              {/* @ts-expect-error webkitdirectory not typed */}
              <input ref={bgFolderRef} type="file" accept="image/*" multiple hidden webkitdirectory=""
                onChange={e => { handleLoadBgFolder(e.target.files); e.target.value = '' }} />

              {/* Prompt textarea */}
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-[10px] text-slate-500">
                  {ctxMode === 'model' ? 'Mô tả nhân vật (nếu không có ảnh AI sẽ tự tạo):' : 'Mô tả phông nền:'}
                </label>
                <textarea
                  value={ctxMode === 'model' ? ctx.modelPrompt : ctx.bgPrompt}
                  onChange={e => ctxMode === 'model'
                    ? setCtx(p => ({ ...p, modelPrompt: e.target.value }))
                    : setCtx(p => ({ ...p, bgPrompt: e.target.value }))
                  }
                  disabled={running}
                  rows={5}
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 resize-none bg-slate-50 leading-relaxed"
                />
                <p className="text-[9px] text-amber-600">
                  {ctxMode === 'model'
                    ? '⚠ Upload ảnh mẫu HOẶC nhập text để AI tạo. Ảnh upload được ưu tiên.'
                    : '⚠ Upload ảnh phông nền HOẶC nhập mô tả để AI tạo.'}
                </p>
              </div>
            </div>

            {/* Status indicator */}
            {ctxMode === 'model' && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                {ctx.modelImagePath ? (
                  <p className="text-[10px] text-green-600 font-mono truncate">✅ {ctx.modelImagePath.split('/').pop()}</p>
                ) : (
                  <p className="text-[10px] text-slate-400">→ Chưa có ảnh mẫu, sẽ tạo từ text khi chạy</p>
                )}
              </div>
            )}
          </div>

          {/* Angle Config */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <AngleConfigPanel angles={angles} onChange={setAngles} disabled={running} />
          </div>

          {/* Log panel */}
          <div className="bg-slate-900 rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">Pipeline Log</span>
              <button onClick={() => setLogs([])} className="text-[10px] text-slate-600 hover:text-slate-400">clear</button>
            </div>
            <div className="p-3 h-56 overflow-y-auto font-mono text-[10px] space-y-0.5">
              {logs.length === 0 ? (
                <p className="text-slate-600">Nhấn "Chạy Pipeline" để bắt đầu...</p>
              ) : logs.map((l, i) => (
                <p key={i} className={{
                  error:   'text-red-400',
                  success: 'text-green-400',
                  warning: 'text-yellow-400',
                  info:    'text-blue-400',
                  dim:     'text-slate-600',
                  default: 'text-slate-300',
                }[l.level] || 'text-slate-300'}>{l.msg}</p>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* ─ COL 3: Results Gallery ─────────────────────────────────────── */}
        <div className="space-y-3">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Sản phẩm', value: products.length, color: 'text-slate-700' },
              { label: 'Thành công', value: progress.doneImages, color: 'text-green-600' },
              { label: 'Lỗi',       value: progress.errorImages, color: 'text-red-500' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Image gallery */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-xs font-semibold text-slate-600">Kết Quả</span>
              {allOutputImages.length > 0 && (
                <span className="ml-auto text-[10px] text-green-600 font-medium">{allOutputImages.length} ảnh</span>
              )}
            </div>
            <div className="p-2">
              {allOutputImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5 max-h-[500px] overflow-y-auto">
                  {allOutputImages.map((url, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden bg-slate-100 aspect-[9/16] cursor-zoom-in"
                      onClick={() => setLightboxIdx(i)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Result ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-white">#{i + 1}</span>
                          <a href={url} download onClick={e => e.stopPropagation()}
                            className="text-white hover:text-violet-300 transition-colors">
                            <Download className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                  {running && (
                    <div className="aspect-[9/16] bg-violet-50 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-violet-200 gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                      <span className="text-[9px] text-violet-400">Đang tạo...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className={cn(
                  'aspect-square flex flex-col items-center justify-center gap-2 rounded-lg',
                  running ? 'bg-violet-50' : 'bg-slate-50',
                )}>
                  {running
                    ? <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                    : <Sparkles className="w-8 h-8 text-slate-200" />
                  }
                  <p className="text-[10px] text-slate-400 text-center px-4">
                    {running ? 'Pipeline đang chạy...' : 'Kết quả sẽ hiện ở đây theo thời gian thực'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Download all */}
          {allOutputImages.length > 0 && outputFmt === 'images' && (
            <button
              onClick={() => { allOutputImages.forEach((url, i) => { const a = document.createElement('a'); a.href = url; a.download = `result_${i + 1}.png`; a.click() }) }}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors">
              <Download className="w-4 h-4" /> Tải tất cả ({allOutputImages.length} ảnh)
            </button>
          )}

          {/* Reset */}
          {progress.phase === 'done' && (
            <button
              onClick={() => { setProgress(p => ({ ...p, phase: 'idle', doneImages: 0, errorImages: 0 })); setProducts(prev => prev.map(p => ({ ...p, status: 'pending', bgStatus: 'idle', angles: p.angles.map(a => ({ ...a, status: 'pending', imagePath: undefined, previewUrl: undefined })) }))) }}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-xl border border-slate-200 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Chạy lại
            </button>
          )}
        </div>
      </div>

      {/* ═══ LIGHTBOX ════════════════════════════════════════════════════════ */}
      {lightboxIdx !== null && allOutputImages[lightboxIdx] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}>
          <div className="relative flex items-center justify-center max-h-screen max-w-screen p-6"
            onClick={e => e.stopPropagation()}>

            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={allOutputImages[lightboxIdx]} alt={`Result ${lightboxIdx + 1}`}
              className="max-h-[88vh] max-w-[88vw] object-contain rounded-xl shadow-2xl" />

            {/* Top-right controls */}
            <div className="absolute top-2 right-2 flex gap-1.5">
              <a href={allOutputImages[lightboxIdx]} download={`result_${lightboxIdx + 1}.png`}
                className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-sm"
                title="Tải ảnh">
                <Download className="w-4 h-4" />
              </a>
              <button onClick={() => setLightboxIdx(null)}
                className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-sm"
                title="Đóng (ESC)">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Prev */}
            {lightboxIdx > 0 && (
              <button onClick={() => setLightboxIdx(lightboxIdx - 1)}
                className="absolute left-2 w-9 h-9 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-sm">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Next */}
            {lightboxIdx < allOutputImages.length - 1 && (
              <button onClick={() => setLightboxIdx(lightboxIdx + 1)}
                className="absolute right-2 w-9 h-9 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-sm">
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Counter */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/60 text-xs tabular-nums backdrop-blur-sm">
              {lightboxIdx + 1} / {allOutputImages.length}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
