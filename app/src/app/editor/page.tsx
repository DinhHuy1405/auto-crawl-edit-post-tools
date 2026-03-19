'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Film, Play, Volume2, Save, Loader2, Layers,
  Image as ImageIcon, Type, Move, ChevronDown,
  CheckCircle2, Monitor, Smartphone,
} from 'lucide-react'

// ─── Canvas dimensions ──────────────────────────────────────────────────────
// Real video is 1440×2560. Canvas preview is scaled down.
const REAL_W = 1440
const REAL_H = 2560
const CANVAS_W = 220
const CANVAS_H = Math.round(CANVAS_W * (REAL_H / REAL_W)) // 391

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

type DragTarget = 'logo' | 'template' | 'title' | null

// ─── Canvas ────────────────────────────────────────────────────────────────
function Canvas({
  layout,
  onLayout,
  videoUrl,
  activeElement,
  setActiveElement,
}: {
  layout: Layout
  onLayout: (l: Partial<Layout>) => void
  videoUrl?: string
  activeElement: DragTarget
  setActiveElement: (t: DragTarget) => void
}) {
  const scale = REAL_W / CANVAS_W
  const dragging = useRef<DragTarget>(null)
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  const toCanvas = (v: number) => v / scale
  const toReal = (v: number) => Math.round(v * scale)

  const startDrag = (e: React.MouseEvent, target: DragTarget) => {
    e.preventDefault(); e.stopPropagation()
    dragging.current = target
    setActiveElement(target)
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: target === 'logo' ? layout.logoX : target === 'template' ? layout.templateX : 0,
      oy: target === 'logo' ? layout.logoY
        : target === 'template' ? layout.templateY
        : layout.titleY,
    }
    const onMove = (ev: MouseEvent) => {
      const dx = toReal(ev.clientX - dragStart.current.mx)
      const dy = toReal(ev.clientY - dragStart.current.my)
      if (dragging.current === 'logo') {
        onLayout({
          logoX: clamp(dragStart.current.ox + dx, 0, REAL_W - layout.logoW),
          logoY: clamp(dragStart.current.oy + dy, 0, REAL_H - layout.logoH),
        })
      } else if (dragging.current === 'template') {
        onLayout({
          templateY: clamp(dragStart.current.oy + dy, 0, REAL_H),
        })
      } else if (dragging.current === 'title') {
        onLayout({
          titleY: clamp(dragStart.current.oy + dy, 0, REAL_H),
        })
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

  // Canvas-scale positions
  const tplY  = toCanvas(layout.templateY)
  const logoX = toCanvas(layout.logoX)
  const logoY = toCanvas(layout.logoY)
  const logoW = toCanvas(layout.logoW)
  const logoH = toCanvas(layout.logoH)
  const titleY = toCanvas(layout.titleY)

  return (
    <div
      className="relative select-none mx-auto flex-shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10"
      style={{ width: CANVAS_W, height: CANVAS_H, background: '#0f172a' }}
    >
      {/* Background video / placeholder */}
      <div className="absolute inset-0">
        {videoUrl ? (
          <video src={videoUrl} className="w-full h-full object-cover opacity-50" muted loop autoPlay playsInline />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Film className="w-10 h-10 text-slate-700" />
            <span className="text-slate-600 text-[10px]">No video selected</span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: `${CANVAS_W / 6}px ${CANVAS_H / 9}px`,
        }}
      />

      {/* ── Template overlay zone (area below templateY) ── */}
      <div
        className={cn(
          'absolute left-0 right-0 pointer-events-none transition-colors',
          activeElement === 'template' ? 'bg-amber-400/20' : 'bg-amber-400/10'
        )}
        style={{ top: tplY, bottom: 0 }}
      />

      {/* Template split line */}
      <div
        className={cn(
          'absolute left-0 right-0 h-0.5 cursor-ns-resize group',
          activeElement === 'template' ? 'bg-amber-400' : 'bg-amber-400/60 hover:bg-amber-400'
        )}
        style={{ top: tplY }}
        onMouseDown={e => startDrag(e, 'template')}
      >
        {/* Label */}
        <div className="absolute left-2 -top-4 bg-amber-400 text-amber-900 text-[8px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
          Template · {layout.templateY}px
        </div>
        {/* Drag pill right */}
        <div className="absolute right-2 -top-3 bg-amber-400 text-amber-900 text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 pointer-events-none">
          <Move className="w-2 h-2" /> drag
        </div>
      </div>

      {/* ── Logo box ── */}
      <div
        className={cn(
          'absolute cursor-move rounded border-2 flex items-center justify-center transition-all',
          activeElement === 'logo'
            ? 'border-blue-400 bg-blue-400/20 shadow-lg shadow-blue-500/30'
            : 'border-blue-400/60 bg-blue-400/10 hover:border-blue-400 hover:bg-blue-400/15'
        )}
        style={{ left: logoX, top: logoY, width: Math.max(logoW, 16), height: Math.max(logoH, 10) }}
        onMouseDown={e => startDrag(e, 'logo')}
      >
        <ImageIcon className="w-3 h-3 text-blue-400 pointer-events-none" />
        {/* Corner label */}
        <div className="absolute -top-4 left-0 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap">
          Logo · {layout.logoX},{layout.logoY}
        </div>
        {/* Resize hint */}
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-blue-400 pointer-events-none" />
      </div>

      {/* ── Title bar ── */}
      <div
        className={cn(
          'absolute left-0 right-0 h-5 cursor-ns-resize flex items-center px-2 transition-colors',
          activeElement === 'title'
            ? 'bg-purple-500/40 border-y border-purple-400'
            : 'bg-black/50 hover:bg-purple-500/30 hover:border-y hover:border-purple-400/60'
        )}
        style={{ top: titleY }}
        onMouseDown={e => startDrag(e, 'title')}
      >
        <Type className="w-2.5 h-2.5 text-purple-300 shrink-0 mr-1 pointer-events-none" />
        <span className="text-[8px] text-purple-200 font-mono pointer-events-none">
          Title · {layout.titleY}px · {layout.titleDuration}s
        </span>
        <Move className="w-2 h-2 text-purple-300 ml-auto pointer-events-none" />
      </div>

      {/* Dimension badge */}
      <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white/50 text-[8px] font-mono px-1.5 py-0.5 rounded pointer-events-none">
        {REAL_W}×{REAL_H}
      </div>
    </div>
  )
}

// ─── Number field ────────────────────────────────────────────────────────────
function NumField({
  label, value, onChange, min = 0, max, step = 1, unit = 'px',
}: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number; unit?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-slate-500 mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => onChange(+e.target.value)}
          className="w-full h-7 px-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-400 text-slate-800"
        />
        <span className="text-[10px] text-slate-400 shrink-0 w-5">{unit}</span>
      </div>
    </div>
  )
}

// ─── Volume slider ────────────────────────────────────────────────────────────
function VolumeRow({
  label, value, onChange, color,
}: {
  label: string; value: number; onChange: (v: number) => void; color: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        <span className="text-xs font-mono font-bold text-slate-600 w-10 text-right">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="relative h-2 bg-slate-200 rounded-full">
        <div
          className={`absolute left-0 top-0 h-full ${color} rounded-full transition-all pointer-events-none`}
          style={{ width: `${Math.min((value / 2) * 100, 100)}%` }}
        />
        <input
          type="range" min={0} max={2} step={0.05} value={value}
          onChange={e => onChange(+e.target.value)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className="w-3 h-3 text-slate-400" />
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function EditorPage() {
  const [layout, setLayout] = useState<Layout>({
    templateX: 0,
    templateY: 288,
    templateW: 1440,
    templateH: -1,
    logoX: 123,
    logoY: 477,
    logoW: 130,
    logoH: 130,
    titleY: 1150,
    titleW: 1440,
    titleH: 300,
    titleDuration: 5,
    mainVideoSkip: 180,
  })
  const [audio, setAudio] = useState<AudioConfig>({
    mainVideo: 0,
    backgroundMusic: 0.9,
    voiceNarration: 1.75,
  })
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null)
  const [activeElement, setActiveElement] = useState<DragTarget>(null)
  const [activeTab, setActiveTab] = useState<'layout' | 'audio'>('layout')
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [renderLogs, setRenderLogs] = useState<{ msg: string; level: string }[]>([])

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then((c: Record<string, unknown>) => {
      setConfig(c)
      if (c?.layout) {
        const l = c.layout as Partial<Layout>
        setLayout(prev => ({
          ...prev,
          ...l,
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

  const onLayout = useCallback((l: Partial<Layout>) => {
    setLayout(prev => ({ ...prev, ...l }))
  }, [])

  const saveLayout = async () => {
    setSaving(true)
    try {
      const next = {
        ...config,
        layout: {
          ...(config?.layout as object || {}),
          templateX: layout.templateX,
          templateY: layout.templateY,
          templateW: layout.templateW,
          templateH: layout.templateH,
          logoX: layout.logoX,
          logoY: layout.logoY,
          logoW: layout.logoW,
          logoH: layout.logoH,
          logoScale: `${layout.logoW}:${layout.logoH}`,
          titleY: layout.titleY,
          titleW: layout.titleW,
          titleH: layout.titleH,
          titleDuration: layout.titleDuration,
        },
        audio: {
          ...(config?.audio as object || {}),
          volumes: audio,
        },
      }
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      setConfig(next)
      toast.success('Layout saved to config!')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const runRender = async () => {
    setRendering(true); setRenderLogs([])
    const addLog = (msg: string, level = 'default') =>
      setRenderLogs(p => [...p.slice(-300), { msg, level }])
    addLog('Starting render...', 'info')
    try {
      const res = await fetch('/api/workflow/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'render', runId: `render_${Date.now()}` }),
      })
      if (!res.body) { addLog('No response stream', 'error'); return }
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
              if (ev.success) { toast.success('Render complete!'); addLog('Done ✓', 'success') }
              else { toast.error('Render failed'); addLog('Failed ✗', 'error') }
            }
          } catch {}
        }
      }
    } catch (e) { addLog(String(e), 'error') }
    finally { setRendering(false) }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] animate-fade-in -m-7">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-2.5 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-bold text-slate-800">Video Editor</span>
        </div>

        <div className="flex items-center gap-1.5 ml-4 px-2.5 py-1 bg-slate-100 rounded-lg">
          <Smartphone className="w-3 h-3 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600">9:16 · TikTok / Reels</span>
          <span className="text-[10px] text-slate-400 ml-1">{REAL_W}×{REAL_H}</span>
        </div>

        <div className="flex-1" />

        {/* Active element indicator */}
        {activeElement && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-medium text-blue-700 capitalize">{activeElement} selected</span>
          </div>
        )}

        <button
          onClick={saveLayout} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Layout
        </button>
        <button
          onClick={runRender} disabled={rendering}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {rendering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
          Render
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: video list ───────────────────────────────────────────── */}
        <div className="w-48 shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Source Videos</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 text-center px-2">
                <Film className="w-7 h-7 text-slate-200 mb-1.5" />
                <p className="text-[11px] text-slate-400">No videos yet</p>
                <p className="text-[10px] text-slate-300 mt-0.5">Run workflow first</p>
              </div>
            ) : videos.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVideo(v)}
                className={cn(
                  'w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all',
                  selectedVideo?.id === v.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-slate-50 border border-transparent'
                )}
              >
                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                  <Film className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <span className="text-[10px] font-medium text-slate-700 truncate leading-tight">{v.title}</span>
                {selectedVideo?.id === v.id && <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0 ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        {/* CENTER: canvas ─────────────────────────────────────────────── */}
        <div className="flex-1 bg-[#0f1117] flex flex-col items-center justify-start overflow-auto py-8 px-6 gap-5">

          {/* Coordinate readout bar */}
          <div className="flex items-center gap-5 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[11px] font-mono">
            <span className="text-amber-400">
              Template Y: <strong>{layout.templateY}px</strong>
            </span>
            <span className="text-white/20">|</span>
            <span className="text-blue-400">
              Logo: <strong>({layout.logoX}, {layout.logoY})</strong>
              <span className="text-white/40 ml-1">{layout.logoW}×{layout.logoH}</span>
            </span>
            <span className="text-white/20">|</span>
            <span className="text-purple-400">
              Title Y: <strong>{layout.titleY}px</strong>
            </span>
          </div>

          <Canvas
            layout={layout}
            onLayout={onLayout}
            videoUrl={selectedVideo?.path
              ? `/api/file?path=${encodeURIComponent(selectedVideo.path)}`
              : undefined}
            activeElement={activeElement}
            setActiveElement={setActiveElement}
          />

          {/* Legend */}
          <div className="flex items-center gap-5 text-[10px]">
            <span className="flex items-center gap-1.5 text-amber-400/80">
              <span className="w-4 h-0.5 bg-amber-400 inline-block rounded-full" />
              Template split
            </span>
            <span className="flex items-center gap-1.5 text-blue-400/80">
              <span className="w-3 h-3 border border-blue-400 inline-block rounded-sm" />
              Logo
            </span>
            <span className="flex items-center gap-1.5 text-purple-400/80">
              <span className="w-4 h-1 bg-purple-400/60 inline-block rounded" />
              Title bar
            </span>
          </div>
        </div>

        {/* RIGHT: properties panel ────────────────────────────────────── */}
        <div className="w-72 shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-slate-200 shrink-0">
            {([
              { id: 'layout', label: 'Layout', icon: Layers },
              { id: 'audio',  label: 'Audio',  icon: Volume2 },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />{tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ─ Layout ─────────────────────────────────────────────── */}
            {activeTab === 'layout' && (
              <div className="p-4 space-y-6">

                {/* Template */}
                <div
                  className={cn(
                    'p-3 rounded-xl border transition-colors cursor-pointer',
                    activeElement === 'template'
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-slate-200 bg-slate-50 hover:border-amber-200'
                  )}
                  onClick={() => setActiveElement('template')}
                >
                  <SectionHeader icon={Film} label="Template Overlay" />
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Split Y position</span>
                        <span className="font-mono font-bold text-amber-600">{layout.templateY}px</span>
                      </div>
                      <div className="relative h-2 bg-slate-200 rounded-full">
                        <div
                          className="absolute left-0 top-0 h-full bg-amber-400 rounded-full pointer-events-none"
                          style={{ width: `${(layout.templateY / REAL_H) * 100}%` }}
                        />
                        <input
                          type="range" min={0} max={REAL_H} step={10}
                          value={layout.templateY}
                          onChange={e => onLayout({ templateY: +e.target.value })}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                        <span>0 (top)</span><span>{REAL_H}px (bottom)</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumField label="Scale Width" value={layout.templateW}
                        onChange={v => onLayout({ templateW: v })} min={100} max={REAL_W} />
                      <NumField label="Scale Height" value={layout.templateH}
                        onChange={v => onLayout({ templateH: v })} min={-1} max={REAL_H} />
                    </div>
                    <p className="text-[10px] text-slate-400">Height -1 = auto-scale by width</p>
                    <NumField label="Skip main video (s)" value={layout.mainVideoSkip}
                      onChange={v => onLayout({ mainVideoSkip: v })} min={0} max={600} unit="s" />
                  </div>
                </div>

                {/* Logo */}
                <div
                  className={cn(
                    'p-3 rounded-xl border transition-colors cursor-pointer',
                    activeElement === 'logo'
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-slate-50 hover:border-blue-200'
                  )}
                  onClick={() => setActiveElement('logo')}
                >
                  <SectionHeader icon={ImageIcon} label="Logo" />
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="X" value={layout.logoX} onChange={v => onLayout({ logoX: v })} max={REAL_W} />
                    <NumField label="Y" value={layout.logoY} onChange={v => onLayout({ logoY: v })} max={REAL_H} />
                    <NumField label="Width" value={layout.logoW} onChange={v => onLayout({ logoW: v })} min={10} max={REAL_W} />
                    <NumField label="Height" value={layout.logoH} onChange={v => onLayout({ logoH: v })} min={10} max={REAL_H} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Drag logo on canvas to reposition</p>
                </div>

                {/* Title */}
                <div
                  className={cn(
                    'p-3 rounded-xl border transition-colors cursor-pointer',
                    activeElement === 'title'
                      ? 'border-purple-300 bg-purple-50'
                      : 'border-slate-200 bg-slate-50 hover:border-purple-200'
                  )}
                  onClick={() => setActiveElement('title')}
                >
                  <SectionHeader icon={Type} label="Title Overlay" />
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Y position</span>
                        <span className="font-mono font-bold text-purple-600">{layout.titleY}px</span>
                      </div>
                      <div className="relative h-2 bg-slate-200 rounded-full">
                        <div
                          className="absolute left-0 top-0 h-full bg-purple-400 rounded-full pointer-events-none"
                          style={{ width: `${(layout.titleY / REAL_H) * 100}%` }}
                        />
                        <input
                          type="range" min={0} max={REAL_H} step={10}
                          value={layout.titleY}
                          onChange={e => onLayout({ titleY: +e.target.value })}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumField label="Canvas Width" value={layout.titleW}
                        onChange={v => onLayout({ titleW: v })} min={100} max={REAL_W} />
                      <NumField label="Canvas Height" value={layout.titleH}
                        onChange={v => onLayout({ titleH: v })} min={50} max={600} />
                    </div>
                    <NumField label="Show for (seconds)" value={layout.titleDuration}
                      onChange={v => onLayout({ titleDuration: v })} min={1} max={30} unit="s" />
                    <p className="text-[10px] text-slate-400">Title text is auto-generated from news content</p>
                  </div>
                </div>
              </div>
            )}

            {/* ─ Audio ─────────────────────────────────────────────── */}
            {activeTab === 'audio' && (
              <div className="p-4 space-y-5">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Volume Mix</p>

                <VolumeRow
                  label="Main Video" value={audio.mainVideo}
                  onChange={v => setAudio(p => ({ ...p, mainVideo: v }))}
                  color="bg-blue-500"
                />
                <VolumeRow
                  label="Background Music" value={audio.backgroundMusic}
                  onChange={v => setAudio(p => ({ ...p, backgroundMusic: v }))}
                  color="bg-green-500"
                />
                <VolumeRow
                  label="Voice Narration" value={audio.voiceNarration}
                  onChange={v => setAudio(p => ({ ...p, voiceNarration: v }))}
                  color="bg-purple-500"
                />

                {/* Mix bar visualization */}
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Mix Preview</p>
                  {[
                    { label: 'Video', val: audio.mainVideo, color: 'bg-blue-500' },
                    { label: 'Music', val: audio.backgroundMusic, color: 'bg-green-500' },
                    { label: 'Voice', val: audio.voiceNarration, color: 'bg-purple-500' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] text-slate-500 w-9 shrink-0">{s.label}</span>
                      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${s.color} rounded-full transition-all`}
                          style={{ width: `${Math.min((s.val / 2) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 w-8 text-right shrink-0">
                        {(s.val * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400 mt-2">
                    Note: Main video is typically 0% (muted) with voice narration at 175%
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Render logs */}
          {renderLogs.length > 0 && (
            <div className="border-t border-slate-200 shrink-0">
              <div className="px-3 py-2 bg-slate-50 flex items-center gap-2 border-b border-slate-100">
                <div className={cn('w-1.5 h-1.5 rounded-full', rendering ? 'bg-green-400 animate-pulse' : 'bg-slate-300')} />
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Render Output</span>
                {rendering && <Loader2 className="w-3 h-3 text-blue-500 animate-spin ml-auto" />}
              </div>
              <div className="log-viewer h-36 text-[10px]">
                {renderLogs.map((l, i) => (
                  <span key={i} className={cn('log-line', l.level)}>{l.msg}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
