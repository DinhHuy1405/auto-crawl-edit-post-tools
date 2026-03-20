'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Film, Play, Volume2, Save, Loader2, Layers,
  Image as ImageIcon, Type, Move, Eye, EyeOff,
  ZoomIn, ZoomOut, RotateCcw, ChevronRight, ChevronDown,
  Music, Mic, Maximize2,
} from 'lucide-react'

// ─── Real video dimensions ───────────────────────────────────────────────────
const REAL_W = 1440
const REAL_H = 2560

interface BlurZone {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  sigma: number
  color: string
  editable: boolean
}

interface Layout {
  templateX: number
  templateY: number
  templateW: number
  templateH: number
  logoX: number
  logoY: number
  logoW: number
  logoH: number
  titleY: number
  titleW: number
  titleH: number
  titleDuration: number
  mainVideoSkip: number
}

interface AudioConfig {
  mainVideo: number
  backgroundMusic: number
  voiceNarration: number
}

interface VideoItem {
  id: string; title: string; path: string
}

// ─── Default blur zones từ FFmpeg pipeline ──────────────────────────────────
const DEFAULT_BLUR_ZONES: BlurZone[] = [
  { id: 'tl', label: 'Top-Left (watermark)', x: 0,   y: -30, w: 210, h: 210, sigma: 30, color: '#f59e0b', editable: true },
  { id: 'tr', label: 'Top-Right (logo)',     x: 1130, y: -30, w: 350, h: 180, sigma: 30, color: '#f59e0b', editable: true },
  { id: 'bt', label: 'Bottom-Center (sub)',  x: 420,  y: -200, w: 600, h: 80,  sigma: 30, color: '#f59e0b', editable: true },
]

// ─── Layer visibility ─────────────────────────────────────────────────────────
interface Layers {
  mainVideo: boolean
  templateVideo: boolean
  blurZones: boolean
  title: boolean
  logo: boolean
}

type DragTarget = 'logo' | 'template' | 'title' | `blur-${string}` | null

// ─── Canvas ────────────────────────────────────────────────────────────────
function Canvas({
  layout, onLayout, blurZones, onBlurZones,
  videoUrl, activeElement, setActiveElement,
  layers, zoom,
}: {
  layout: Layout
  onLayout: (l: Partial<Layout>) => void
  blurZones: BlurZone[]
  onBlurZones: (zones: BlurZone[]) => void
  videoUrl?: string
  activeElement: DragTarget
  setActiveElement: (t: DragTarget) => void
  layers: Layers
  zoom: number
}) {
  const CANVAS_W = Math.round(360 * zoom)
  const CANVAS_H = Math.round(CANVAS_W * (REAL_H / REAL_W))
  const scale = REAL_W / CANVAS_W

  const dragging = useRef<DragTarget>(null)
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })
  const resizing = useRef<{ target: string; edge: string } | null>(null)
  const resizeStart = useRef({ mx: 0, my: 0, ow: 0, oh: 0, ox: 0, oy: 0 })

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const toC = (v: number) => v / scale   // real → canvas
  const toR = (v: number) => Math.round(v * scale) // canvas → real

  // Compute template rendered height (scale templateW:templateH)
  const tplRenderH = layout.templateH === -1
    ? Math.round(layout.templateW * (1080 / 1920)) // default 16:9 ratio
    : layout.templateH

  const startDrag = (e: React.MouseEvent, target: DragTarget) => {
    e.preventDefault(); e.stopPropagation()
    dragging.current = target
    setActiveElement(target)
    let ox = 0, oy = 0
    if (target === 'logo') { ox = layout.logoX; oy = layout.logoY }
    else if (target === 'template') { ox = layout.templateX; oy = layout.templateY }
    else if (target === 'title') { ox = 0; oy = layout.titleY }
    else if (target?.startsWith('blur-')) {
      const z = blurZones.find(b => `blur-${b.id}` === target)
      if (z) { ox = z.x; oy = z.y }
    }
    dragStart.current = { mx: e.clientX, my: e.clientY, ox, oy }

    const onMove = (ev: MouseEvent) => {
      const dx = toR(ev.clientX - dragStart.current.mx)
      const dy = toR(ev.clientY - dragStart.current.my)
      if (dragging.current === 'logo') {
        onLayout({
          logoX: clamp(dragStart.current.ox + dx, 0, REAL_W - layout.logoW),
          logoY: clamp(dragStart.current.oy + dy, 0, REAL_H - layout.logoH),
        })
      } else if (dragging.current === 'template') {
        onLayout({ templateY: clamp(dragStart.current.oy + dy, 0, REAL_H) })
      } else if (dragging.current === 'title') {
        onLayout({ titleY: clamp(dragStart.current.oy + dy, 0, REAL_H - layout.titleH) })
      } else if (dragging.current?.startsWith('blur-')) {
        const id = dragging.current.replace('blur-', '')
        onBlurZones(blurZones.map(z => z.id === id
          ? { ...z, x: dragStart.current.ox + dx, y: dragStart.current.oy + dy }
          : z))
      }
    }
    const onUp = () => {
      dragging.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startResize = (e: React.MouseEvent, target: string, edge: string, w: number, h: number, x: number, y: number) => {
    e.preventDefault(); e.stopPropagation()
    resizing.current = { target, edge }
    resizeStart.current = { mx: e.clientX, my: e.clientY, ow: w, oh: h, ox: x, oy: y }

    const onMove = (ev: MouseEvent) => {
      const dx = toR(ev.clientX - resizeStart.current.mx)
      const dy = toR(ev.clientY - resizeStart.current.my)
      if (!resizing.current) return
      const { target: t } = resizing.current
      if (t === 'logo') {
        onLayout({
          logoW: Math.max(20, resizeStart.current.ow + dx),
          logoH: Math.max(10, resizeStart.current.oh + dy),
        })
      } else if (t === 'title') {
        onLayout({ titleH: Math.max(40, resizeStart.current.oh + dy) })
      } else if (t.startsWith('blur-')) {
        const id = t.replace('blur-', '')
        onBlurZones(blurZones.map(z => z.id === id
          ? { ...z, w: Math.max(20, resizeStart.current.ow + dx), h: Math.max(10, resizeStart.current.oh + dy) }
          : z))
      }
    }
    const onUp = () => {
      resizing.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Template rendered area in canvas coords
  const tplCX = toC(layout.templateX)
  const tplCY = toC(layout.templateY)
  const tplCW = toC(layout.templateW)
  const tplCH = toC(tplRenderH)

  return (
    <div
      className="relative select-none flex-shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10"
      style={{ width: CANVAS_W, height: CANVAS_H, background: '#111827' }}
    >
      {/* ── Layer 0: Main video background ────────────────────────────── */}
      {layers.mainVideo && (
        <div className="absolute inset-0">
          {videoUrl ? (
            <video src={videoUrl} className="w-full h-full object-cover opacity-40" muted loop autoPlay playsInline />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center gap-2">
              <Film className="w-12 h-12 text-slate-700" />
              <span className="text-slate-600 text-[10px]">Main Video (gameplay/background)</span>
              <span className="text-slate-700 text-[9px] font-mono">{REAL_W}×{REAL_H}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Grid overlay ──────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: `${CANVAS_W / 9}px ${CANVAS_H / 16}px`,
        }}
      />
      {/* Rule of thirds */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }}>
        {[1/3, 2/3].map(r => (
          <div key={r} className="absolute left-0 right-0 h-px bg-white" style={{ top: `${r * 100}%` }} />
        ))}
        {[1/3, 2/3].map(r => (
          <div key={r} className="absolute top-0 bottom-0 w-px bg-white" style={{ left: `${r * 100}%` }} />
        ))}
      </div>

      {/* ── Layer 1: Template video zone ──────────────────────────────── */}
      {layers.templateVideo && (
        <div
          className={cn(
            'absolute border-2 transition-colors overflow-hidden',
            activeElement === 'template'
              ? 'border-amber-400 shadow-lg shadow-amber-500/20'
              : 'border-amber-400/50 hover:border-amber-400/80'
          )}
          style={{ left: tplCX, top: tplCY, width: tplCW, height: tplCH }}
        >
          {/* Background to represent the template video */}
          <div className="absolute inset-0 bg-slate-700/60 flex flex-col items-center justify-center gap-1">
            <Film className="text-amber-400/60 pointer-events-none" style={{ width: Math.max(10, tplCW * 0.15), height: Math.max(8, tplCW * 0.15) }} />
            <span className="text-amber-400/60 font-mono pointer-events-none" style={{ fontSize: Math.max(6, tplCW * 0.05) }}>
              Template {layout.templateW}×{tplRenderH}
            </span>
          </div>

          {/* ── Blur zones (relative to template video) ───────────────── */}
          {layers.blurZones && blurZones.map(z => {
            // blur zones are in template-video space
            const bzX = toC(z.x)
            const bzY = toC(z.y)
            const bzW = toC(z.w)
            const bzH = toC(z.h)
            const bzKey = `blur-${z.id}` as DragTarget
            const isActive = activeElement === bzKey
            return (
              <div
                key={z.id}
                className={cn(
                  'absolute cursor-move border border-dashed transition-all',
                  isActive ? 'border-amber-300 bg-amber-300/30' : 'border-amber-300/60 bg-amber-300/15 hover:bg-amber-300/25'
                )}
                style={{ left: bzX, top: bzY, width: Math.max(8, bzW), height: Math.max(4, bzH) }}
                onMouseDown={e => startDrag(e, bzKey)}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
                />
                <span
                  className="absolute top-0 left-0 text-amber-200 font-bold leading-none pointer-events-none"
                  style={{ fontSize: Math.max(5, bzW * 0.14) }}
                >
                  {z.label.split(' ')[0]}
                </span>
                {/* resize handle */}
                {z.editable && isActive && (
                  <div
                    className="absolute bottom-0 right-0 w-2 h-2 bg-amber-400 cursor-se-resize"
                    onMouseDown={e => startResize(e, `blur-${z.id}`, 'se', z.w, z.h, z.x, z.y)}
                  />
                )}
              </div>
            )
          })}

          {/* Drag handle bar */}
          <div
            className="absolute top-0 left-0 right-0 h-4 cursor-move flex items-center px-1.5 gap-1 bg-amber-400/80"
            onMouseDown={e => startDrag(e, 'template')}
          >
            <Move className="w-2.5 h-2.5 text-amber-900 pointer-events-none shrink-0" />
            <span className="text-amber-900 font-bold leading-none pointer-events-none" style={{ fontSize: 8 }}>
              Template · Y:{layout.templateY}
            </span>
          </div>
        </div>
      )}

      {/* ── Layer 2: Title bar ────────────────────────────────────────── */}
      {layers.title && (
        <div
          className={cn(
            'absolute left-0 right-0 cursor-ns-resize flex flex-col justify-center px-2 transition-colors border-y',
            activeElement === 'title'
              ? 'bg-purple-500/50 border-purple-400'
              : 'bg-black/60 border-purple-400/40 hover:bg-purple-500/30 hover:border-purple-400/70'
          )}
          style={{ top: toC(layout.titleY), height: Math.max(6, toC(layout.titleH)) }}
          onMouseDown={e => startDrag(e, 'title')}
        >
          <div className="flex items-center gap-1 pointer-events-none">
            <Type className="text-purple-300 shrink-0" style={{ width: 8, height: 8 }} />
            <span className="text-purple-200 font-mono truncate" style={{ fontSize: 7 }}>
              TITLE · Y:{layout.titleY} · {layout.titleW}×{layout.titleH} · {layout.titleDuration}s
            </span>
          </div>
          {/* Resize handle */}
          {activeElement === 'title' && (
            <div
              className="absolute bottom-0 left-0 right-0 h-1.5 bg-purple-400 cursor-s-resize"
              onMouseDown={e => startResize(e, 'title', 's', layout.titleW, layout.titleH, 0, layout.titleY)}
            />
          )}
        </div>
      )}

      {/* ── Layer 3: Logo ─────────────────────────────────────────────── */}
      {layers.logo && (
        <div
          className={cn(
            'absolute cursor-move rounded border-2 transition-all group',
            activeElement === 'logo'
              ? 'border-blue-400 bg-blue-400/20 shadow-lg shadow-blue-500/40'
              : 'border-blue-400/60 bg-blue-400/10 hover:border-blue-400 hover:bg-blue-400/20'
          )}
          style={{
            left: toC(layout.logoX),
            top: toC(layout.logoY),
            width: Math.max(8, toC(layout.logoW)),
            height: Math.max(5, toC(layout.logoH)),
          }}
          onMouseDown={e => startDrag(e, 'logo')}
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <ImageIcon className="text-blue-300 opacity-70" style={{ width: Math.max(6, toC(layout.logoW) * 0.4), height: Math.max(5, toC(layout.logoH) * 0.4) }} />
          </div>
          {/* Label */}
          <div className="absolute -top-4 left-0 bg-blue-500 text-white font-bold px-1 rounded pointer-events-none whitespace-nowrap" style={{ fontSize: 7 }}>
            Logo · {layout.logoX},{layout.logoY}
          </div>
          {/* Resize handle SE */}
          <div
            className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-blue-400 cursor-se-resize"
            onMouseDown={e => startResize(e, 'logo', 'se', layout.logoW, layout.logoH, layout.logoX, layout.logoY)}
          />
        </div>
      )}

      {/* Dimension badge */}
      <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white/40 font-mono px-1.5 py-0.5 rounded pointer-events-none" style={{ fontSize: 7 }}>
        {REAL_W}×{REAL_H} · {Math.round(zoom * 100)}%
      </div>
    </div>
  )
}

// ─── Number field ────────────────────────────────────────────────────────────
function NumField({
  label, value, onChange, min = 0, max, step = 1, unit = 'px', hint,
}: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number; unit?: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(+e.target.value)}
          className="w-full h-6 px-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-400 text-slate-800 font-mono"
        />
        <span className="text-[10px] text-slate-400 shrink-0">{unit}</span>
      </div>
      {hint && <p className="text-[9px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

// ─── Volume slider ────────────────────────────────────────────────────────────
function VolumeRow({ label, value, onChange, color, icon: Icon }: {
  label: string; value: number; onChange: (v: number) => void; color: string; icon: React.ElementType
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Icon className={`w-3 h-3 ${color.replace('bg-', 'text-')}`} />
          <span className="text-[11px] font-medium text-slate-700">{label}</span>
        </div>
        <span className="text-[11px] font-mono font-bold text-slate-600">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="relative h-1.5 bg-slate-200 rounded-full">
        <div className={`absolute left-0 top-0 h-full ${color} rounded-full pointer-events-none transition-all`}
          style={{ width: `${Math.min((value / 2) * 100, 100)}%` }} />
        <input type="range" min={0} max={2} step={0.05} value={value}
          onChange={e => onChange(+e.target.value)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer" />
      </div>
    </div>
  )
}

// ─── Section collapse ─────────────────────────────────────────────────────────
function Section({ label, color, active, onActive, children, icon: Icon }: {
  label: string; color: string; active: boolean; onActive: () => void
  children: React.ReactNode; icon: React.ElementType
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className={cn('rounded-xl border transition-colors', active ? `border-${color}-300 bg-${color}-50/60` : 'border-slate-200 bg-slate-50')}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => { onActive(); setOpen(o => !o) }}
      >
        <Icon className={`w-3.5 h-3.5 text-${color}-500`} />
        <span className={`text-[11px] font-bold text-${color}-700 flex-1`}>{label}</span>
        {open ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
      </div>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  )
}

// ─── Layer toggle ─────────────────────────────────────────────────────────────
function LayerBtn({ active, label, color, onClick }: {
  active: boolean; label: string; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all',
        active
          ? `bg-${color}-100 border-${color}-300 text-${color}-700`
          : 'bg-white border-slate-200 text-slate-400 opacity-60'
      )}
    >
      {active ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
      {label}
    </button>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function EditorPage() {
  const [layout, setLayout] = useState<Layout>({
    templateX: 0, templateY: 0,
    templateW: 1440, templateH: -1,
    logoX: 109, logoY: 372,
    logoW: 200, logoH: 80,
    titleY: 1687, titleW: 1440, titleH: 300,
    titleDuration: 5, mainVideoSkip: 180,
  })
  const [audio, setAudio] = useState<AudioConfig>({
    mainVideo: 0, backgroundMusic: 1.45, voiceNarration: 1.75,
  })
  const [blurZones, setBlurZones] = useState<BlurZone[]>(DEFAULT_BLUR_ZONES)
  const [layers, setLayers] = useState<Layers>({
    mainVideo: true, templateVideo: true, blurZones: true, title: true, logo: true,
  })
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null)
  const [activeElement, setActiveElement] = useState<DragTarget>(null)
  const [activeTab, setActiveTab] = useState<'layout' | 'audio' | 'blur'>('layout')
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [renderLogs, setRenderLogs] = useState<{ msg: string; level: string }[]>([])
  const [zoom, setZoom] = useState(0.9)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then((c: Record<string, unknown>) => {
      setConfig(c)
      if (c?.layout) {
        const l = c.layout as Partial<Layout>
        setLayout(prev => ({
          ...prev, ...l,
          titleDuration: (l as { titleDuration?: number }).titleDuration ?? prev.titleDuration,
          mainVideoSkip: (c?.video as Record<string, unknown>)?.mainVideoSkipSec as number ?? prev.mainVideoSkip,
        }))
      }
      if (c?.audio) {
        const a = c.audio as { volumes?: Partial<AudioConfig> }
        if (a.volumes) setAudio(prev => ({ ...prev, ...a.volumes }))
      }
    }).catch(() => {})
    fetch('/api/videos').then(r => r.json()).then((v: VideoItem[]) => {
      setVideos(Array.isArray(v) ? v : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [renderLogs])

  const onLayout = useCallback((l: Partial<Layout>) => {
    setLayout(prev => ({ ...prev, ...l }))
  }, [])

  const toggleLayer = (k: keyof Layers) =>
    setLayers(prev => ({ ...prev, [k]: !prev[k] }))

  const activeSection = activeElement === 'logo' ? 'logo'
    : activeElement === 'template' ? 'template'
    : activeElement === 'title' ? 'title'
    : activeElement?.startsWith('blur-') ? 'blur'
    : null

  const saveLayout = async () => {
    setSaving(true)
    try {
      const next = {
        ...config,
        layout: {
          ...(config?.layout as object || {}),
          templateX: layout.templateX, templateY: layout.templateY,
          templateW: layout.templateW, templateH: layout.templateH,
          logoX: layout.logoX, logoY: layout.logoY,
          logoW: layout.logoW, logoH: layout.logoH,
          logoScale: `${layout.logoW}:${layout.logoH}`,
          titleY: layout.titleY, titleW: layout.titleW,
          titleH: layout.titleH, titleDuration: layout.titleDuration,
        },
        audio: { ...(config?.audio as object || {}), volumes: audio },
      }
      await fetch('/api/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      setConfig(next)
      toast.success('Saved!')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const runRender = async () => {
    setRendering(true); setRenderLogs([])
    const addLog = (msg: string, level = 'default') =>
      setRenderLogs(p => [...p.slice(-200), { msg, level }])
    addLog('Starting render...', 'info')
    try {
      const res = await fetch('/api/workflow/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'render', runId: `render_${Date.now()}` }),
      })
      if (!res.body) { addLog('No stream', 'error'); return }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n'); buf = parts.pop() || ''
        for (const part of parts) {
          const line = part.replace(/^data: /, '').trim()
          if (!line) continue
          try {
            const ev = JSON.parse(line)
            if (ev.type === 'log') addLog(ev.message, ev.level || 'default')
            if (ev.type === 'done') {
              if (ev.success) { toast.success('Render done!'); addLog('Done ✓', 'success') }
              else { toast.error('Render failed'); addLog('Failed ✗', 'error') }
            }
          } catch {}
        }
      }
    } catch (e) { addLog(String(e), 'error') }
    finally { setRendering(false) }
  }

  // Computed template rendered H for display
  const tplRenderH = layout.templateH === -1
    ? Math.round(layout.templateW * (1080 / 1920))
    : layout.templateH

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] animate-fade-in -m-7">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#0d1117] border-b border-white/10 shrink-0">
        <Film className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-bold text-white">Template Editor</span>
        <div className="flex items-center gap-1 ml-2 px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/40 font-mono">
          9:16 · {REAL_W}×{REAL_H}
        </div>

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1">
          <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))} className="text-white/50 hover:text-white"><ZoomOut className="w-3.5 h-3.5" /></button>
          <span className="text-[11px] font-mono text-white/60 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(1.6, z + 0.15))} className="text-white/50 hover:text-white"><ZoomIn className="w-3.5 h-3.5" /></button>
          <button onClick={() => setZoom(0.9)} className="text-white/30 hover:text-white/70 ml-0.5"><RotateCcw className="w-3 h-3" /></button>
        </div>

        {/* Active element */}
        {activeElement && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[11px] font-medium text-blue-300 capitalize">
              {activeElement.replace('blur-', 'Blur ')} selected
            </span>
          </div>
        )}

        <button onClick={saveLayout} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
        <button onClick={runRender} disabled={rendering}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 shadow">
          {rendering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
          Render
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden bg-[#0d1117]">

        {/* LEFT: Video list ──────────────────────────────────────────── */}
        <div className="w-44 shrink-0 bg-[#111827] border-r border-white/5 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Source Videos</p>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-center px-2">
                <Film className="w-6 h-6 text-white/10 mb-1" />
                <p className="text-[10px] text-white/20">No videos</p>
                <p className="text-[9px] text-white/10 mt-0.5">Run workflow first</p>
              </div>
            ) : videos.map(v => (
              <button key={v.id} onClick={() => setSelectedVideo(v)}
                className={cn(
                  'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all',
                  selectedVideo?.id === v.id ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-white/5 border border-transparent'
                )}>
                <div className="w-7 h-7 rounded bg-white/5 flex items-center justify-center shrink-0">
                  <Film className="w-3 h-3 text-white/30" />
                </div>
                <span className="text-[10px] text-white/60 truncate leading-tight">{v.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CENTER: Canvas ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-start overflow-auto py-6 px-4 gap-4">

          {/* Layer visibility bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
            <span className="text-[10px] text-white/30 uppercase tracking-widest mr-1">Layers</span>
            <LayerBtn active={layers.mainVideo}    label="Main Video"  color="slate"  onClick={() => toggleLayer('mainVideo')} />
            <LayerBtn active={layers.templateVideo} label="Template"   color="amber"  onClick={() => toggleLayer('templateVideo')} />
            <LayerBtn active={layers.blurZones}    label="Blur Zones"  color="orange" onClick={() => toggleLayer('blurZones')} />
            <LayerBtn active={layers.title}        label="Title"       color="purple" onClick={() => toggleLayer('title')} />
            <LayerBtn active={layers.logo}         label="Logo"        color="blue"   onClick={() => toggleLayer('logo')} />
          </div>

          {/* Coordinates bar */}
          <div className="flex items-center gap-4 px-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-mono">
            <span className="text-amber-400">Template Y:<strong className="ml-1">{layout.templateY}</strong></span>
            <span className="text-white/20">|</span>
            <span className="text-blue-400">Logo <strong>({layout.logoX},{layout.logoY})</strong> <span className="text-white/30">{layout.logoW}×{layout.logoH}</span></span>
            <span className="text-white/20">|</span>
            <span className="text-purple-400">Title Y:<strong className="ml-1">{layout.titleY}</strong> <span className="text-white/30">{layout.titleH}px·{layout.titleDuration}s</span></span>
            <span className="text-white/20">|</span>
            <span className="text-orange-400">Template <strong>{layout.templateW}×{tplRenderH}</strong></span>
          </div>

          <Canvas
            layout={layout} onLayout={onLayout}
            blurZones={blurZones} onBlurZones={setBlurZones}
            videoUrl={selectedVideo?.path ? `/api/file?path=${encodeURIComponent(selectedVideo.path)}` : undefined}
            activeElement={activeElement} setActiveElement={setActiveElement}
            layers={layers} zoom={zoom}
          />

          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px] flex-wrap justify-center">
            {[
              { color: 'amber', label: 'Template video (crawled)' },
              { color: 'orange', label: 'Blur zones (watermark cover)' },
              { color: 'purple', label: 'Title text overlay' },
              { color: 'blue', label: 'Logo' },
            ].map(l => (
              <span key={l.label} className={`flex items-center gap-1.5 text-${l.color}-400/70`}>
                <span className={`w-3 h-0.5 bg-${l.color}-400/70 inline-block rounded`} />
                {l.label}
              </span>
            ))}
          </div>

          {/* Pipeline diagram */}
          <div className="flex items-center gap-1 text-[9px] font-mono text-white/20 bg-white/3 px-3 py-1.5 rounded-lg border border-white/5 flex-wrap justify-center">
            {['Main Video (0)', '→', 'Template (1)', '→', 'Blur Zones', '→', 'Title PNG (4)', '→', 'Logo (5)', '→', 'FFmpeg', '→', 'Output MP4'].map((s, i) => (
              <span key={i} className={s === '→' ? 'text-white/10' : s === 'FFmpeg' ? 'text-blue-400/60' : s.includes('Output') ? 'text-green-400/60' : 'text-white/25'}>{s}</span>
            ))}
          </div>
        </div>

        {/* RIGHT: Properties panel ────────────────────────────────────── */}
        <div className="w-72 shrink-0 bg-[#111827] border-l border-white/5 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-white/5 shrink-0">
            {([
              { id: 'layout', label: 'Layout', icon: Layers },
              { id: 'blur',   label: 'Blur',   icon: Maximize2 },
              { id: 'audio',  label: 'Audio',  icon: Volume2 },
            ] as const).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-semibold border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                    : 'border-transparent text-white/30 hover:text-white/50'
                )}>
                <tab.icon className="w-3 h-3" />{tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* ─ Layout ──────────────────────────────────────────────── */}
            {activeTab === 'layout' && (
              <>
                {/* Template */}
                <Section label="Template Video" color="amber" icon={Film}
                  active={activeSection === 'template'} onActive={() => setActiveElement('template')}>
                  <div className="space-y-2">
                    <p className="text-[9px] text-slate-500">Video crawled từ YouTube. Đặt lên main video tại vị trí Y. Scale width:height.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <NumField label="Y Position" value={layout.templateY} onChange={v => onLayout({ templateY: v })} max={REAL_H} />
                      <NumField label="X Position" value={layout.templateX} onChange={v => onLayout({ templateX: v })} max={REAL_W} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumField label="Scale W" value={layout.templateW} onChange={v => onLayout({ templateW: v })} min={100} max={REAL_W} />
                      <NumField label="Scale H" value={layout.templateH} onChange={v => onLayout({ templateH: v })} min={-1} max={REAL_H} hint="-1 = auto" />
                    </div>
                    <div className="text-[9px] text-amber-600/80 bg-amber-50 rounded px-2 py-1 border border-amber-200/60">
                      Rendered: {layout.templateW} × {tplRenderH}px
                      {layout.templateH === -1 && ' (auto height)'}
                    </div>
                    <NumField label="Skip first (main video)" value={layout.mainVideoSkip}
                      onChange={v => onLayout({ mainVideoSkip: v })} min={0} max={600} unit="s"
                      hint="Bỏ qua n giây đầu của main video (-ss)" />
                  </div>
                </Section>

                {/* Logo */}
                <Section label="Logo" color="blue" icon={ImageIcon}
                  active={activeSection === 'logo'} onActive={() => setActiveElement('logo')}>
                  <p className="text-[9px] text-slate-500">Logo PNG overlay lên toàn bộ video. Kéo trên canvas hoặc nhập tọa độ.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="X" value={layout.logoX} onChange={v => onLayout({ logoX: v })} max={REAL_W} />
                    <NumField label="Y" value={layout.logoY} onChange={v => onLayout({ logoY: v })} max={REAL_H} />
                    <NumField label="Width" value={layout.logoW} onChange={v => onLayout({ logoW: v })} min={10} max={REAL_W} />
                    <NumField label="Height" value={layout.logoH} onChange={v => onLayout({ logoH: v })} min={5} max={REAL_H} />
                  </div>
                </Section>

                {/* Title */}
                <Section label="Title Overlay" color="purple" icon={Type}
                  active={activeSection === 'title'} onActive={() => setActiveElement('title')}>
                  <p className="text-[9px] text-slate-500">Ảnh PNG chứa tiêu đề, sinh từ Canvas API (font Anton). Hiện trong N giây đầu.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="Y Position" value={layout.titleY} onChange={v => onLayout({ titleY: v })} max={REAL_H} />
                    <NumField label="Duration" value={layout.titleDuration} onChange={v => onLayout({ titleDuration: v })} min={1} max={60} unit="s" />
                    <NumField label="Canvas W" value={layout.titleW} onChange={v => onLayout({ titleW: v })} min={100} max={REAL_W} />
                    <NumField label="Canvas H" value={layout.titleH} onChange={v => onLayout({ titleH: v })} min={40} max={800} />
                  </div>
                </Section>
              </>
            )}

            {/* ─ Blur Zones ───────────────────────────────────────────── */}
            {activeTab === 'blur' && (
              <>
                <div className="text-[9px] text-white/30 bg-white/5 rounded-lg p-2 border border-white/5">
                  Blur zones được áp dụng lên <strong className="text-amber-400">template video</strong> (video crawled) để che watermark/logo YouTube. Tọa độ tính trong không gian template video ({layout.templateW}×{tplRenderH}px).
                </div>
                {blurZones.map(z => {
                  const bzKey = `blur-${z.id}` as DragTarget
                  const isActive = activeElement === bzKey
                  return (
                    <div key={z.id}
                      className={cn(
                        'rounded-xl border p-3 space-y-2 cursor-pointer transition-colors',
                        isActive ? 'border-amber-400/60 bg-amber-500/10' : 'border-white/10 bg-white/3 hover:border-white/20'
                      )}
                      onClick={() => setActiveElement(bzKey)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-sm bg-amber-400 opacity-70" />
                        <span className="text-[11px] font-semibold text-amber-300">{z.label}</span>
                        <span className="text-[9px] text-white/20 ml-auto font-mono">σ={z.sigma}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <NumField label="X" value={z.x} onChange={v => setBlurZones(bz => bz.map(b => b.id === z.id ? {...b, x: v} : b))} />
                        <NumField label="Y" value={z.y} onChange={v => setBlurZones(bz => bz.map(b => b.id === z.id ? {...b, y: v} : b))} />
                        <NumField label="Width" value={z.w} onChange={v => setBlurZones(bz => bz.map(b => b.id === z.id ? {...b, w: v} : b))} min={10} />
                        <NumField label="Height" value={z.h} onChange={v => setBlurZones(bz => bz.map(b => b.id === z.id ? {...b, h: v} : b))} min={5} />
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* ─ Audio ────────────────────────────────────────────────── */}
            {activeTab === 'audio' && (
              <div className="space-y-4">
                <p className="text-[9px] text-white/30">3 luồng audio được mix bằng amix. Điều chỉnh volume từng kênh.</p>
                <VolumeRow label="Main Video" value={audio.mainVideo}
                  onChange={v => setAudio(p => ({ ...p, mainVideo: v }))} color="bg-blue-500" icon={Film} />
                <VolumeRow label="Background Music" value={audio.backgroundMusic}
                  onChange={v => setAudio(p => ({ ...p, backgroundMusic: v }))} color="bg-green-500" icon={Music} />
                <VolumeRow label="Voice Narration" value={audio.voiceNarration}
                  onChange={v => setAudio(p => ({ ...p, voiceNarration: v }))} color="bg-purple-500" icon={Mic} />

                <div className="pt-3 border-t border-white/5">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">Mix Preview</p>
                  {[
                    { label: 'Video',  val: audio.mainVideo,        color: 'bg-blue-500' },
                    { label: 'Music',  val: audio.backgroundMusic,  color: 'bg-green-500' },
                    { label: 'Voice',  val: audio.voiceNarration,   color: 'bg-purple-500' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] text-white/30 w-9 shrink-0">{s.label}</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${s.color} rounded-full transition-all`}
                          style={{ width: `${Math.min((s.val / 2) * 100, 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-white/40 w-8 text-right shrink-0">
                        {(s.val * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Render logs */}
          {renderLogs.length > 0 && (
            <div className="border-t border-white/5 shrink-0 max-h-40">
              <div className="px-3 py-1.5 bg-white/3 flex items-center gap-2 border-b border-white/5">
                <div className={cn('w-1.5 h-1.5 rounded-full', rendering ? 'bg-green-400 animate-pulse' : 'bg-white/20')} />
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Render Output</span>
                {rendering && <Loader2 className="w-3 h-3 text-blue-400 animate-spin ml-auto" />}
              </div>
              <div ref={logRef} className="overflow-y-auto h-28 p-2 space-y-0.5">
                {renderLogs.map((l, i) => (
                  <div key={i} className={cn('text-[10px] font-mono leading-tight',
                    l.level === 'error' ? 'text-red-400' : l.level === 'success' ? 'text-green-400' : l.level === 'info' ? 'text-blue-400' : 'text-white/40'
                  )}>{l.msg}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
