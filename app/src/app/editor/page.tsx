'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Film, Play, Volume2, Save, Loader2, Layers,
  Image as ImageIcon, Type, Eye, EyeOff,
  ZoomIn, ZoomOut, RotateCcw, ChevronDown, ChevronRight,
  Music, Mic, Maximize2, Plus, Trash2, Move,
} from 'lucide-react'

const REAL_W = 1440
const REAL_H = 2560

// ─── Types ───────────────────────────────────────────────────────────────────
interface BlurZone {
  id: string; label: string
  x: number; y: number; w: number; h: number; sigma: number
}

interface Layout {
  templateX: number; templateY: number; templateW: number; templateH: number
  logoX: number; logoY: number; logoW: number; logoH: number
  titleY: number; titleW: number; titleH: number
  titleDuration: number; mainVideoSkip: number
}

interface AudioConfig {
  mainVideo: number; backgroundMusic: number; voiceNarration: number
}

interface VideoItem { id: string; title: string; path: string }

interface LayersVis {
  mainVideo: boolean; templateVideo: boolean
  blurZones: boolean; title: boolean; logo: boolean
}

const DEFAULT_BLUR_ZONES: BlurZone[] = [
  { id: 'tl', label: 'Top-Left',     x: 0,    y: -30,  w: 210, h: 210, sigma: 30 },
  { id: 'tr', label: 'Top-Right',    x: 1130, y: -30,  w: 350, h: 180, sigma: 30 },
  { id: 'bt', label: 'Bottom-Ctr',   x: 420,  y: -200, w: 600, h: 80,  sigma: 30 },
]

// ─── 8-handle resize corners/edges ──────────────────────────────────────────
// handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const HANDLES = ['n','s','e','w','ne','nw','se','sw'] as const
type Handle = typeof HANDLES[number]

const HANDLE_CURSOR: Record<Handle, string> = {
  n:'ns-resize', s:'ns-resize', e:'ew-resize', w:'ew-resize',
  ne:'nesw-resize', sw:'nesw-resize', nw:'nwse-resize', se:'nwse-resize',
}

function handleStyle(h: Handle, w: number, hh: number): React.CSSProperties {
  const S = 7 // size px
  const half = S / 2
  const cx = h.includes('e') ? w - 1 : h.includes('w') ? 1 : w / 2
  const cy = h.includes('s') ? hh - 1 : h.includes('n') ? 1 : hh / 2
  return {
    position: 'absolute',
    width: S, height: S,
    left: cx - half, top: cy - half,
    cursor: HANDLE_CURSOR[h],
    background: '#fff',
    border: '1.5px solid #64748b',
    borderRadius: 1,
    zIndex: 10,
  }
}

// ─── ResizeHandles component ─────────────────────────────────────────────────
function ResizeHandles({
  w, h, onHandle,
}: {
  w: number; h: number
  onHandle: (e: React.MouseEvent, handle: Handle) => void
}) {
  return (
    <>
      {HANDLES.map(hd => (
        <div
          key={hd}
          style={handleStyle(hd, w, h)}
          onMouseDown={e => onHandle(e, hd)}
        />
      ))}
    </>
  )
}

// ─── Canvas ──────────────────────────────────────────────────────────────────
type ActiveEl = 'logo' | 'template' | 'title' | `blur-${string}` | null

function Canvas({
  layout, onLayout,
  blurZones, onBlurZones,
  videoUrl, activeElement, setActiveElement,
  layers, zoom,
}: {
  layout: Layout
  onLayout: (l: Partial<Layout>) => void
  blurZones: BlurZone[]
  onBlurZones: (zones: BlurZone[]) => void
  videoUrl?: string
  activeElement: ActiveEl
  setActiveElement: (t: ActiveEl) => void
  layers: LayersVis
  zoom: number
}) {
  const BASE = 340
  const CW = Math.round(BASE * zoom)
  const CH = Math.round(CW * (REAL_H / REAL_W))
  const scale = REAL_W / CW  // real px per canvas px

  const toC = (v: number) => v / scale
  const toR = (v: number) => Math.round(v * scale)
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  const tplRH = layout.templateH === -1
    ? Math.round(layout.templateW * (9 / 16))
    : layout.templateH

  // ── Generic drag (move) ──────────────────────────────────────────────────
  function startMove(
    e: React.MouseEvent,
    target: ActiveEl,
    getXY: () => [number, number],
    setXY: (x: number, y: number) => void,
    bounds?: { minX?: number; maxX?: number; minY?: number; maxY?: number },
  ) {
    e.preventDefault(); e.stopPropagation()
    setActiveElement(target)
    const [ox, oy] = getXY()
    const mx0 = e.clientX, my0 = e.clientY
    const onMove = (ev: MouseEvent) => {
      const x = ox + toR(ev.clientX - mx0)
      const y = oy + toR(ev.clientY - my0)
      setXY(
        bounds?.minX !== undefined ? clamp(x, bounds.minX, bounds.maxX ?? REAL_W) : x,
        bounds?.minY !== undefined ? clamp(y, bounds.minY, bounds.maxY ?? REAL_H) : y,
      )
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Generic resize ───────────────────────────────────────────────────────
  function startResize(
    e: React.MouseEvent,
    handle: Handle,
    box: { x: number; y: number; w: number; h: number },
    setBox: (b: { x: number; y: number; w: number; h: number }) => void,
    minW = 20, minH = 10,
  ) {
    e.preventDefault(); e.stopPropagation()
    const { x: ox, y: oy, w: ow, h: oh } = box
    const mx0 = e.clientX, my0 = e.clientY
    const onMove = (ev: MouseEvent) => {
      const dx = toR(ev.clientX - mx0)
      const dy = toR(ev.clientY - my0)
      let nx = ox, ny = oy, nw = ow, nh = oh
      if (handle.includes('e'))  nw = Math.max(minW, ow + dx)
      if (handle.includes('s'))  nh = Math.max(minH, oh + dy)
      if (handle.includes('w')) { nw = Math.max(minW, ow - dx); nx = ox + ow - nw }
      if (handle.includes('n')) { nh = Math.max(minH, oh - dy); ny = oy + oh - nh }
      setBox({ x: nx, y: ny, w: nw, h: nh })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // canvas-coord dims
  const tplCX = toC(layout.templateX), tplCY = toC(layout.templateY)
  const tplCW = toC(layout.templateW), tplCH = toC(tplRH)
  const logoCX = toC(layout.logoX), logoCY = toC(layout.logoY)
  const logoCW = toC(layout.logoW), logoCH = toC(layout.logoH)
  const titleCY = toC(layout.titleY)
  const titleCW = toC(layout.titleW), titleCH = toC(layout.titleH)
  const titleCX = toC(layout.templateX) // title always left=0 in real coords → X=0

  return (
    <div
      className="relative select-none flex-shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10"
      style={{ width: CW, height: CH, background: '#111827' }}
      onClick={() => setActiveElement(null)}
    >
      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        opacity: 0.04,
        backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
        backgroundSize: `${CW/9}px ${CH/16}px`,
      }} />
      {/* Rule of thirds */}
      {[1/3,2/3].map(r => <div key={`h${r}`} className="absolute left-0 right-0 h-px pointer-events-none" style={{ top:`${r*100}%`, background:'rgba(255,255,255,0.05)' }} />)}
      {[1/3,2/3].map(r => <div key={`v${r}`} className="absolute top-0 bottom-0 w-px pointer-events-none" style={{ left:`${r*100}%`, background:'rgba(255,255,255,0.05)' }} />)}

      {/* ── Layer 0: Main Video ────────────────────────────────────────── */}
      {layers.mainVideo && (
        <div className="absolute inset-0 pointer-events-none">
          {videoUrl ? (
            <video src={videoUrl} className="w-full h-full object-cover opacity-40" muted loop autoPlay playsInline />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center gap-1.5">
              <Film style={{ width: CW*0.1, height: CW*0.1 }} className="text-slate-700" />
              <span className="text-slate-600 font-mono" style={{ fontSize: Math.max(7, CW*0.035) }}>Main Video {REAL_W}×{REAL_H}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Layer 1: Template video ────────────────────────────────────── */}
      {layers.templateVideo && (
        <div
          className={cn('absolute overflow-hidden border-2 transition-colors',
            activeElement === 'template' ? 'border-amber-400' : 'border-amber-400/50 hover:border-amber-400/80')}
          style={{ left: tplCX, top: tplCY, width: tplCW, height: tplCH }}
          onClick={e => { e.stopPropagation(); setActiveElement('template') }}
        >
          {/* fill */}
          <div className="absolute inset-0 bg-amber-900/30 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
            <Film style={{ width: Math.max(8, tplCW*0.12), height: Math.max(8, tplCW*0.12) }} className="text-amber-400/50" />
            <span className="text-amber-400/60 font-mono" style={{ fontSize: Math.max(6, tplCW*0.045) }}>
              Template · {layout.templateW}×{tplRH}
            </span>
          </div>

          {/* Blur zones (inside template coords) */}
          {layers.blurZones && blurZones.map(z => {
            const bzKey: ActiveEl = `blur-${z.id}`
            const isA = activeElement === bzKey
            // blur coords are in template-video space (before scale); we re-scale to canvas
            // template is scaled: realTemplateW → tplCW on canvas
            const bScale = tplCW / layout.templateW
            const bx = z.x * bScale, by = z.y * bScale
            const bw = Math.max(4, z.w * bScale), bh = Math.max(3, z.h * bScale)
            return (
              <div key={z.id}
                className={cn('absolute border border-dashed cursor-move',
                  isA ? 'border-orange-300 bg-orange-400/30 z-20' : 'border-orange-400/50 bg-orange-400/15 hover:bg-orange-400/25 z-10')}
                style={{ left: bx, top: by, width: bw, height: bh }}
                onMouseDown={e => startMove(e, bzKey,
                  () => [z.x, z.y],
                  (nx, ny) => onBlurZones(blurZones.map(b => b.id===z.id ? {...b, x:nx, y:ny} : b)),
                )}
                onClick={e => { e.stopPropagation(); setActiveElement(bzKey) }}
              >
                <div className="absolute inset-0 pointer-events-none" style={{ backdropFilter:'blur(3px)', WebkitBackdropFilter:'blur(3px)' }} />
                <span className="absolute top-0 left-0.5 text-orange-200 font-bold pointer-events-none leading-none" style={{ fontSize: Math.max(5, bw*0.18) }}>
                  {z.label}
                </span>
                {isA && (
                  <ResizeHandles w={bw} h={bh} onHandle={(e, handle) => startResize(e, handle,
                    { x: z.x, y: z.y, w: z.w, h: z.h },
                    b => onBlurZones(blurZones.map(bl => bl.id===z.id ? {...bl, ...b} : bl)),
                    10, 5,
                  )} />
                )}
              </div>
            )
          })}

          {/* Move handle bar */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center px-1.5 gap-1 cursor-move z-30"
            style={{ height: Math.max(10, tplCH*0.07), background: 'rgba(251,191,36,0.8)' }}
            onMouseDown={e => startMove(e, 'template',
              () => [layout.templateX, layout.templateY],
              (nx, ny) => onLayout({ templateX: nx, templateY: clamp(ny, 0, REAL_H) }),
            )}
          >
            <Move style={{ width: Math.max(7, tplCW*0.05), height: Math.max(7, tplCW*0.05) }} className="text-amber-900 pointer-events-none shrink-0" />
            <span className="text-amber-900 font-bold pointer-events-none truncate" style={{ fontSize: Math.max(6, tplCW*0.045) }}>
              {layout.templateX},{layout.templateY}
            </span>
          </div>

          {/* Resize handles on template */}
          {activeElement === 'template' && (
            <ResizeHandles w={tplCW} h={tplCH} onHandle={(e, handle) => {
              startResize(e, handle,
                { x: layout.templateX, y: layout.templateY, w: layout.templateW, h: tplRH },
                b => onLayout({
                  templateX: b.x, templateY: b.y,
                  templateW: b.w,
                  templateH: layout.templateH === -1 ? -1 : b.h,
                }),
                80, 40,
              )
            }} />
          )}
        </div>
      )}

      {/* ── Layer 2: Title ─────────────────────────────────────────────── */}
      {layers.title && (
        <div
          className={cn('absolute border-y cursor-move',
            activeElement === 'title'
              ? 'bg-purple-500/50 border-purple-400 z-20'
              : 'bg-black/50 border-purple-400/40 hover:bg-purple-500/30 hover:border-purple-400/70 z-10')}
          style={{ left: 0, top: titleCY, width: titleCW, height: Math.max(5, titleCH) }}
          onMouseDown={e => startMove(e, 'title',
            () => [layout.titleW > 0 ? 0 : 0, layout.titleY],
            (_, ny) => onLayout({ titleY: clamp(ny, 0, REAL_H - layout.titleH) }),
          )}
          onClick={e => { e.stopPropagation(); setActiveElement('title') }}
        >
          <div className="flex items-center gap-1 px-1.5 h-full pointer-events-none overflow-hidden">
            <Type style={{ width: Math.max(6, titleCW*0.025), height: Math.max(6, titleCW*0.025), flexShrink: 0 }} className="text-purple-300" />
            <span className="text-purple-200 font-mono truncate" style={{ fontSize: Math.max(5, titleCW*0.03) }}>
              TITLE · {layout.titleW}×{layout.titleH} · {layout.titleDuration}s
            </span>
          </div>
          {activeElement === 'title' && (
            <ResizeHandles w={titleCW} h={Math.max(5, titleCH)} onHandle={(e, handle) =>
              startResize(e, handle,
                { x: 0, y: layout.titleY, w: layout.titleW, h: layout.titleH },
                b => onLayout({ titleY: b.y, titleW: b.w, titleH: b.h }),
                100, 20,
              )
            } />
          )}
        </div>
      )}

      {/* ── Layer 3: Logo ─────────────────────────────────────────────── */}
      {layers.logo && (
        <div
          className={cn('absolute cursor-move rounded border-2',
            activeElement === 'logo'
              ? 'border-blue-400 bg-blue-400/20 shadow-lg shadow-blue-500/30 z-20'
              : 'border-blue-400/60 bg-blue-400/10 hover:border-blue-400 hover:bg-blue-400/20 z-10')}
          style={{ left: logoCX, top: logoCY, width: Math.max(6, logoCW), height: Math.max(4, logoCH) }}
          onMouseDown={e => startMove(e, 'logo',
            () => [layout.logoX, layout.logoY],
            (nx, ny) => onLayout({
              logoX: clamp(nx, 0, REAL_W - layout.logoW),
              logoY: clamp(ny, 0, REAL_H - layout.logoH),
            }),
          )}
          onClick={e => { e.stopPropagation(); setActiveElement('logo') }}
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <ImageIcon style={{ width: Math.max(5, logoCW*0.35), height: Math.max(5, logoCH*0.35) }} className="text-blue-300 opacity-70" />
          </div>
          <div className="absolute -top-4 left-0 bg-blue-500 text-white font-bold px-1 rounded pointer-events-none whitespace-nowrap" style={{ fontSize: 7 }}>
            Logo · {layout.logoX},{layout.logoY} · {layout.logoW}×{layout.logoH}
          </div>
          {activeElement === 'logo' && (
            <ResizeHandles w={Math.max(6, logoCW)} h={Math.max(4, logoCH)} onHandle={(e, handle) =>
              startResize(e, handle,
                { x: layout.logoX, y: layout.logoY, w: layout.logoW, h: layout.logoH },
                b => onLayout({ logoX: b.x, logoY: b.y, logoW: b.w, logoH: b.h }),
                10, 5,
              )
            } />
          )}
        </div>
      )}

      {/* Dim badge */}
      <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white/30 font-mono px-1.5 py-0.5 rounded pointer-events-none" style={{ fontSize: 7 }}>
        {REAL_W}×{REAL_H} · {Math.round(zoom * 100)}%
      </div>
    </div>
  )
}

// ─── NumField ────────────────────────────────────────────────────────────────
function NumField({ label, value, onChange, min=0, max, step=1, unit='px', hint }: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number; unit?: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-slate-400 mb-0.5">{label}</label>
      <div className="flex items-center gap-1">
        <input type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(+e.target.value)}
          className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/60 text-slate-200 font-mono" />
        <span className="text-[10px] text-white/20 shrink-0 w-5">{unit}</span>
      </div>
      {hint && <p className="text-[9px] text-white/20 mt-0.5">{hint}</p>}
    </div>
  )
}

// ─── VolumeRow ───────────────────────────────────────────────────────────────
function VolumeRow({ label, value, onChange, color, icon: Icon }: {
  label: string; value: number; onChange: (v: number) => void; color: string; icon: React.ElementType
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3 h-3 ${color.replace('bg-','text-')}`} />
          <span className="text-[11px] font-medium text-slate-300">{label}</span>
        </div>
        <span className="text-[11px] font-mono font-bold text-slate-400">{(value*100).toFixed(0)}%</span>
      </div>
      <div className="relative h-1.5 bg-white/10 rounded-full">
        <div className={`absolute left-0 top-0 h-full ${color} rounded-full pointer-events-none`} style={{ width:`${Math.min((value/2)*100,100)}%` }} />
        <input type="range" min={0} max={2} step={0.05} value={value} onChange={e => onChange(+e.target.value)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer" />
      </div>
    </div>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────
function Section({ label, active, accent, icon: Icon, children, defaultOpen=true }: {
  label: string; active: boolean; accent: string; icon: React.ElementType
  children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cn('rounded-xl border transition-colors', active ? `border-${accent}-500/50 bg-${accent}-500/5` : 'border-white/8 bg-white/2')}>
      <button className="w-full flex items-center gap-2 px-3 py-2.5" onClick={() => setOpen(o => !o)}>
        <Icon className={`w-3.5 h-3.5 text-${accent}-400`} />
        <span className={`text-[11px] font-bold flex-1 text-left text-${accent}-300`}>{label}</span>
        {open ? <ChevronDown className="w-3 h-3 text-white/20" /> : <ChevronRight className="w-3 h-3 text-white/20" />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2.5">{children}</div>}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function EditorPage() {
  const [layout, setLayout] = useState<Layout>({
    templateX: 0, templateY: 0, templateW: 1440, templateH: -1,
    logoX: 109, logoY: 372, logoW: 200, logoH: 80,
    titleY: 1687, titleW: 1440, titleH: 300,
    titleDuration: 5, mainVideoSkip: 180,
  })
  const [audio, setAudio] = useState<AudioConfig>({ mainVideo: 0, backgroundMusic: 1.45, voiceNarration: 1.75 })
  const [blurZones, setBlurZones] = useState<BlurZone[]>(DEFAULT_BLUR_ZONES)
  const [layers, setLayers] = useState<LayersVis>({ mainVideo: true, templateVideo: true, blurZones: true, title: true, logo: true })
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null)
  const [activeElement, setActiveElement] = useState<ActiveEl>(null)
  const [activeTab, setActiveTab] = useState<'layout'|'blur'|'audio'>('layout')
  const [config, setConfig] = useState<Record<string,unknown>|null>(null)
  const [saving, setSaving] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [renderLogs, setRenderLogs] = useState<{msg:string;level:string}[]>([])
  const [zoom, setZoom] = useState(0.9)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then((c: Record<string,unknown>) => {
      setConfig(c)
      if (c?.layout) {
        const l = c.layout as Partial<Layout>
        setLayout(prev => ({ ...prev, ...l,
          titleDuration: (l as {titleDuration?:number}).titleDuration ?? prev.titleDuration,
          mainVideoSkip: (c?.video as Record<string,unknown>)?.mainVideoSkipSec as number ?? prev.mainVideoSkip,
        }))
      }
      if (c?.audio) { const a = c.audio as {volumes?:Partial<AudioConfig>}; if (a.volumes) setAudio(prev => ({...prev,...a.volumes})) }
    }).catch(()=>{})
    fetch('/api/videos').then(r=>r.json()).then((v:VideoItem[])=>{ setVideos(Array.isArray(v)?v:[]) }).catch(()=>{})
  }, [])

  useEffect(() => { if(logRef.current) logRef.current.scrollTop=logRef.current.scrollHeight }, [renderLogs])

  const onLayout = useCallback((l: Partial<Layout>) => setLayout(prev => ({...prev,...l})), [])
  const toggleLayer = (k: keyof LayersVis) => setLayers(prev => ({...prev,[k]:!prev[k]}))

  const tplRH = layout.templateH === -1 ? Math.round(layout.templateW*(9/16)) : layout.templateH

  const addBlurZone = () => {
    const id = `z${Date.now()}`
    setBlurZones(z => [...z, { id, label: `Zone ${z.length+1}`, x: 200, y: 50, w: 200, h: 100, sigma: 30 }])
  }
  const removeBlurZone = (id: string) => setBlurZones(z => z.filter(b => b.id !== id))
  const updateBlurZone = (id: string, patch: Partial<BlurZone>) =>
    setBlurZones(z => z.map(b => b.id===id ? {...b,...patch} : b))

  const saveLayout = async () => {
    setSaving(true)
    try {
      const next = {
        ...config,
        layout: {
          ...(config?.layout as object||{}),
          templateX: layout.templateX, templateY: layout.templateY,
          templateW: layout.templateW, templateH: layout.templateH,
          logoX: layout.logoX, logoY: layout.logoY,
          logoW: layout.logoW, logoH: layout.logoH,
          logoScale: `${layout.logoW}:${layout.logoH}`,
          titleY: layout.titleY, titleW: layout.titleW,
          titleH: layout.titleH, titleDuration: layout.titleDuration,
        },
        audio: { ...(config?.audio as object||{}), volumes: audio },
      }
      await fetch('/api/config', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(next) })
      setConfig(next); toast.success('Saved!')
    } catch { toast.error('Failed') } finally { setSaving(false) }
  }

  const runRender = async () => {
    setRendering(true); setRenderLogs([])
    const addLog = (msg:string, level='default') => setRenderLogs(p => [...p.slice(-200), {msg,level}])
    addLog('Starting render...','info')
    try {
      const res = await fetch('/api/workflow/run', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({step:'render',runId:`render_${Date.now()}`}) })
      if (!res.body) { addLog('No stream','error'); return }
      const reader=res.body.getReader(); const dec=new TextDecoder(); let buf=''
      while (true) {
        const {done,value}=await reader.read(); if(done) break
        buf+=dec.decode(value,{stream:true})
        const parts=buf.split('\n\n'); buf=parts.pop()||''
        for (const part of parts) {
          const line=part.replace(/^data: /,'').trim(); if(!line) continue
          try {
            const ev=JSON.parse(line)
            if(ev.type==='log') addLog(ev.message,ev.level||'default')
            if(ev.type==='done') { if(ev.success){toast.success('Done!');addLog('Done ✓','success')} else{toast.error('Failed');addLog('Failed ✗','error')} }
          } catch {}
        }
      }
    } catch(e){addLog(String(e),'error')} finally{setRendering(false)}
  }

  const activeSection = activeElement==='logo'?'logo':activeElement==='template'?'template':activeElement==='title'?'title':activeElement?.startsWith('blur-')?'blur':null

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] -m-7" style={{ background:'#0a0d14' }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ background:'#0d1117', borderColor:'rgba(255,255,255,0.06)' }}>
        <Film className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-bold text-white">Template Editor</span>
        <span className="text-[10px] font-mono text-white/20 ml-1">9:16 · {REAL_W}×{REAL_H}</span>
        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setZoom(z => Math.max(0.35, z-0.15))} className="text-white/40 hover:text-white"><ZoomOut className="w-3.5 h-3.5" /></button>
          <span className="text-[11px] font-mono text-white/50 w-9 text-center">{Math.round(zoom*100)}%</span>
          <button onClick={() => setZoom(z => Math.min(1.8, z+0.15))} className="text-white/40 hover:text-white"><ZoomIn className="w-3.5 h-3.5" /></button>
          <button onClick={() => setZoom(0.9)} className="text-white/20 hover:text-white/50 ml-0.5"><RotateCcw className="w-3 h-3" /></button>
        </div>

        {activeElement && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[11px] font-medium text-blue-300 capitalize">{activeElement.replace('blur-','Blur ')} selected</span>
          </div>
        )}

        <button onClick={saveLayout} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40"
          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
        <button onClick={runRender} disabled={rendering}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 shadow">
          {rendering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
          Render
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: video list */}
        <div className="w-40 shrink-0 flex flex-col overflow-hidden" style={{ background:'#0d1117', borderRight:'1px solid rgba(255,255,255,0.05)' }}>
          <div className="px-3 py-2 border-b" style={{ borderColor:'rgba(255,255,255,0.05)' }}>
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Source Videos</p>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {videos.length===0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-center">
                <Film className="w-6 h-6 text-white/8 mb-1" />
                <p className="text-[10px] text-white/20">No videos</p>
              </div>
            ) : videos.map(v => (
              <button key={v.id} onClick={()=>setSelectedVideo(v)}
                className={cn('w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all',
                  selectedVideo?.id===v.id ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-white/5 border border-transparent')}>
                <Film className="w-3 h-3 text-white/25 shrink-0" />
                <span className="text-[10px] text-white/50 truncate leading-tight">{v.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CENTER: canvas */}
        <div className="flex-1 flex flex-col items-center justify-start overflow-auto py-5 px-4 gap-3">

          {/* Layer toggles */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-[9px] text-white/20 uppercase tracking-widest mr-1">Layers</span>
            {([
              { k:'mainVideo'    as const, label:'Main',     color:'slate'  },
              { k:'templateVideo'as const, label:'Template', color:'amber'  },
              { k:'blurZones'   as const, label:'Blur',     color:'orange' },
              { k:'title'       as const, label:'Title',    color:'purple' },
              { k:'logo'        as const, label:'Logo',     color:'blue'   },
            ]).map(({k,label}) => (
              <button key={k} onClick={()=>toggleLayer(k)}
                className={cn('flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all',
                  layers[k] ? 'bg-white/10 border-white/15 text-white/70' : 'bg-transparent border-white/5 text-white/20')}>
                {layers[k] ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                {label}
              </button>
            ))}
          </div>

          {/* Coords bar */}
          <div className="flex items-center gap-4 px-3 py-1 rounded-lg text-[10px] font-mono" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-amber-400/70">Tpl <strong className="text-amber-300">{layout.templateX},{layout.templateY}</strong> {layout.templateW}×{tplRH}</span>
            <span className="text-white/10">|</span>
            <span className="text-blue-400/70">Logo <strong className="text-blue-300">{layout.logoX},{layout.logoY}</strong> {layout.logoW}×{layout.logoH}</span>
            <span className="text-white/10">|</span>
            <span className="text-purple-400/70">Title Y:<strong className="text-purple-300">{layout.titleY}</strong> {layout.titleW}×{layout.titleH} {layout.titleDuration}s</span>
          </div>

          <Canvas
            layout={layout} onLayout={onLayout}
            blurZones={blurZones} onBlurZones={setBlurZones}
            videoUrl={selectedVideo?.path ? `/api/file?path=${encodeURIComponent(selectedVideo.path)}` : undefined}
            activeElement={activeElement} setActiveElement={setActiveElement}
            layers={layers} zoom={zoom}
          />

          {/* Legend */}
          <div className="flex items-center gap-4 text-[9px] flex-wrap justify-center">
            {[
              {color:'amber',  label:'Template (drag top-bar, resize corners)'},
              {color:'orange', label:'Blur zones (drag, resize)'},
              {color:'purple', label:'Title (drag, resize)'},
              {color:'blue',   label:'Logo (drag, resize)'},
            ].map(l => (
              <span key={l.label} className={`flex items-center gap-1 text-${l.color}-400/50`}>
                <span className={`w-2 h-2 border border-${l.color}-400/50 inline-block rounded-sm`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {/* RIGHT: panel */}
        <div className="w-72 shrink-0 flex flex-col overflow-hidden" style={{ background:'#0d1117', borderLeft:'1px solid rgba(255,255,255,0.05)' }}>
          {/* Tabs */}
          <div className="flex border-b shrink-0" style={{ borderColor:'rgba(255,255,255,0.05)' }}>
            {([
              {id:'layout' as const, label:'Layout',  icon:Layers},
              {id:'blur'   as const, label:'Blur',    icon:Maximize2},
              {id:'audio'  as const, label:'Audio',   icon:Volume2},
            ]).map(tab => (
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                className={cn('flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-semibold border-b-2 transition-colors',
                  activeTab===tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-white/25 hover:text-white/50')}>
                <tab.icon className="w-3 h-3" />{tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* ─ Layout ──────────────────────────────────────────────────── */}
            {activeTab==='layout' && (<>
              {/* Template */}
              <Section label="Template Video" active={activeSection==='template'} accent="amber" icon={Film}>
                <p className="text-[9px] text-white/25">Video crawled từ YouTube. Kéo top-bar để di chuyển, kéo góc/cạnh để resize.</p>
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="X" value={layout.templateX} onChange={v=>onLayout({templateX:v})} />
                  <NumField label="Y" value={layout.templateY} onChange={v=>onLayout({templateY:v})} max={REAL_H} />
                  <NumField label="Width" value={layout.templateW} onChange={v=>onLayout({templateW:v})} min={80} max={REAL_W} />
                  <NumField label="Height" value={layout.templateH} onChange={v=>onLayout({templateH:v})} min={-1} max={REAL_H} hint="-1=auto" />
                </div>
                <div className="text-[9px] text-amber-400/60 bg-amber-500/8 rounded px-2 py-1" style={{ border:'1px solid rgba(251,191,36,0.15)' }}>
                  Rendered: {layout.templateW}×{tplRH}px {layout.templateH===-1 && '(auto height)'}
                </div>
                <NumField label="Skip first N seconds (main video)" value={layout.mainVideoSkip}
                  onChange={v=>onLayout({mainVideoSkip:v})} min={0} max={600} unit="s" hint="FFmpeg -ss offset" />
              </Section>

              {/* Logo */}
              <Section label="Logo" active={activeSection==='logo'} accent="blue" icon={ImageIcon}>
                <p className="text-[9px] text-white/25">Logo PNG overlay. Kéo để di chuyển, kéo 8 handles để resize.</p>
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="X" value={layout.logoX} onChange={v=>onLayout({logoX:v})} max={REAL_W} />
                  <NumField label="Y" value={layout.logoY} onChange={v=>onLayout({logoY:v})} max={REAL_H} />
                  <NumField label="Width" value={layout.logoW} onChange={v=>onLayout({logoW:v})} min={10} max={REAL_W} />
                  <NumField label="Height" value={layout.logoH} onChange={v=>onLayout({logoH:v})} min={5} max={REAL_H} />
                </div>
              </Section>

              {/* Title */}
              <Section label="Title Overlay" active={activeSection==='title'} accent="purple" icon={Type}>
                <p className="text-[9px] text-white/25">Ảnh PNG tiêu đề (Canvas/Anton font). Kéo di chuyển, resize 8 handles.</p>
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="Y Position" value={layout.titleY} onChange={v=>onLayout({titleY:v})} max={REAL_H} />
                  <NumField label="Duration" value={layout.titleDuration} onChange={v=>onLayout({titleDuration:v})} min={1} max={60} unit="s" />
                  <NumField label="Width" value={layout.titleW} onChange={v=>onLayout({titleW:v})} min={100} max={REAL_W} />
                  <NumField label="Height" value={layout.titleH} onChange={v=>onLayout({titleH:v})} min={20} max={800} />
                </div>
              </Section>
            </>)}

            {/* ─ Blur ────────────────────────────────────────────────────── */}
            {activeTab==='blur' && (<>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-white/30">Blur zones trên template video để che watermark.</p>
                <button onClick={addBlurZone}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-blue-300 transition-colors hover:bg-blue-500/15"
                  style={{ border:'1px solid rgba(59,130,246,0.25)' }}>
                  <Plus className="w-3 h-3" /> Add Zone
                </button>
              </div>

              {blurZones.map((z, i) => {
                const bzKey: ActiveEl = `blur-${z.id}`
                const isA = activeElement === bzKey
                return (
                  <div key={z.id}
                    className={cn('rounded-xl border p-3 space-y-2 cursor-pointer transition-colors',
                      isA ? 'border-orange-500/50 bg-orange-500/8' : 'border-white/8 bg-white/2 hover:border-white/15')}
                    onClick={() => setActiveElement(bzKey)}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm bg-orange-400/70 shrink-0" />
                      <input
                        value={z.label} onChange={e => updateBlurZone(z.id, {label:e.target.value})}
                        className="flex-1 bg-transparent text-[11px] font-semibold text-orange-300 focus:outline-none"
                        onClick={e => e.stopPropagation()}
                      />
                      <span className="text-[9px] text-white/20 font-mono">σ={z.sigma}</span>
                      {blurZones.length>1 && (
                        <button onClick={e=>{e.stopPropagation();removeBlurZone(z.id)}}
                          className="text-white/20 hover:text-red-400 transition-colors p-0.5">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumField label="X (in template)" value={z.x} onChange={v=>updateBlurZone(z.id,{x:v})} />
                      <NumField label="Y (in template)" value={z.y} onChange={v=>updateBlurZone(z.id,{y:v})} />
                      <NumField label="Width" value={z.w} onChange={v=>updateBlurZone(z.id,{w:v})} min={10} />
                      <NumField label="Height" value={z.h} onChange={v=>updateBlurZone(z.id,{h:v})} min={5} />
                    </div>
                    <NumField label="Blur strength (sigma)" value={z.sigma} onChange={v=>updateBlurZone(z.id,{sigma:v})} min={1} max={100} unit="" />
                  </div>
                )
              })}
            </>)}

            {/* ─ Audio ───────────────────────────────────────────────────── */}
            {activeTab==='audio' && (
              <div className="space-y-4">
                <p className="text-[9px] text-white/25">3 luồng audio mix bằng FFmpeg amix.</p>
                <VolumeRow label="Main Video" value={audio.mainVideo} onChange={v=>setAudio(p=>({...p,mainVideo:v}))} color="bg-blue-500" icon={Film} />
                <VolumeRow label="Background Music" value={audio.backgroundMusic} onChange={v=>setAudio(p=>({...p,backgroundMusic:v}))} color="bg-green-500" icon={Music} />
                <VolumeRow label="Voice Narration" value={audio.voiceNarration} onChange={v=>setAudio(p=>({...p,voiceNarration:v}))} color="bg-purple-500" icon={Mic} />
                <div className="pt-3 border-t" style={{ borderColor:'rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest mb-2.5">Mix Preview</p>
                  {[
                    {label:'Video', val:audio.mainVideo,       color:'bg-blue-500'},
                    {label:'Music', val:audio.backgroundMusic, color:'bg-green-500'},
                    {label:'Voice', val:audio.voiceNarration,  color:'bg-purple-500'},
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] text-white/25 w-9 shrink-0">{s.label}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                        <div className={`h-full ${s.color} rounded-full`} style={{ width:`${Math.min((s.val/2)*100,100)}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-white/30 w-8 text-right shrink-0">{(s.val*100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Render logs */}
          {renderLogs.length>0 && (
            <div className="border-t shrink-0" style={{ borderColor:'rgba(255,255,255,0.05)', maxHeight:160 }}>
              <div className="px-3 py-1.5 flex items-center gap-2 border-b" style={{ background:'rgba(255,255,255,0.02)', borderColor:'rgba(255,255,255,0.05)' }}>
                <div className={cn('w-1.5 h-1.5 rounded-full', rendering?'bg-green-400 animate-pulse':'bg-white/15')} />
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Render Output</span>
                {rendering && <Loader2 className="w-3 h-3 text-blue-400 animate-spin ml-auto" />}
              </div>
              <div ref={logRef} className="overflow-y-auto p-2 space-y-0.5" style={{ maxHeight:110 }}>
                {renderLogs.map((l,i) => (
                  <div key={i} className={cn('text-[10px] font-mono leading-tight',
                    l.level==='error'?'text-red-400':l.level==='success'?'text-green-400':l.level==='info'?'text-blue-400':'text-white/30')}>
                    {l.msg}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
