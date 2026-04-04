'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Film, Play, Volume2, Save, Loader2, Layers,
  Image as ImageIcon, Type, Eye, EyeOff,
  ZoomIn, ZoomOut, RotateCcw, ChevronDown, ChevronRight,
  Music, Mic, Maximize2, Plus, Trash2, Move, BookMarked,
  Copy, Check, Pencil, Star, Shuffle, ListVideo, Scissors,
  AlignLeft, ChevronLeft, ChevronRight as ChevronRightIcon,
  Clapperboard, Wand2, SkipForward, Hash, X, Lock, Unlock,
  Settings2, Download, Undo2, Redo2, GripVertical,
  Cloud, Timer, Search, Crop, Ratio,
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
  titleX: number; titleY: number; titleW: number; titleH: number
  titleDuration: number; mainVideoSkip: number
}
interface AudioConfig { mainVideo: number; backgroundMusic: number; voiceNarration: number }
interface FxConfig {
  brightness: number   // eq brightness: -1.0 to 1.0, default 0
  contrast: number     // eq contrast: 0.0 to 2.0, default 1
  saturation: number   // eq saturation: 0.0 to 3.0, default 1
  speed: number        // setpts/atempo multiplier: 0.5 to 2.0, default 1
  fadeInDur: number    // fade in duration secs, 0 = disabled
  fadeOutDur: number   // fade out duration secs, 0 = disabled
  vignette: boolean    // vignette overlay
}
const DEFAULT_FX: FxConfig = { brightness: 0, contrast: 1, saturation: 1, speed: 1, fadeInDur: 0, fadeOutDur: 0, vignette: false }
interface VideoItem { id: string; title: string; path: string }
interface LayersVis { mainVideo: boolean; templateVideo: boolean; blurZones: boolean; title: boolean; logo: boolean }

type SourceModeType = 'sequential' | 'random_clips' | 'first_n' | 'custom_range' | 'multi_clip'
interface MultiClipItem { startSec: number; durationSec: number; label?: string }
interface SourceModeConfig {
  mode: SourceModeType
  sequential: { skipSec: number }
  randomClips: { minClipSec: number; maxClipSec: number; avoidFirstSec: number; avoidLastSec: number }
  firstN: { durationSec: number }
  customRange: { startSec: number; endSec: number }
  multiClip: { clips: MultiClipItem[] }
}
const DEFAULT_SOURCE_MODE: SourceModeConfig = {
  mode: 'sequential',
  sequential: { skipSec: 180 },
  randomClips: { minClipSec: 8, maxClipSec: 20, avoidFirstSec: 60, avoidLastSec: 30 },
  firstN: { durationSec: 120 },
  customRange: { startSec: 0, endSec: 120 },
  multiClip: { clips: [] },
}

interface Preset {
  id: string; name: string; description: string
  layout: Layout; blurZones: BlurZone[]; audio: AudioConfig; builtin?: boolean
}
const BUILTIN_PRESETS: Preset[] = [
  { id:'standard', name:'Standard', builtin:true, description:'Template giữa, title dưới, logo góc trái',
    layout:{templateX:0,templateY:476,templateW:1440,templateH:-1,logoX:56,logoY:198,logoW:200,logoH:146,titleX:5,titleY:1469,titleW:1435,titleH:300,titleDuration:30,mainVideoSkip:180},
    blurZones:[{id:'tl',label:'Top-Left',x:0,y:-30,w:210,h:210,sigma:30},{id:'tr',label:'Top-Right',x:1130,y:-30,w:350,h:180,sigma:30},{id:'bt',label:'Bottom-Ctr',x:420,y:-200,w:600,h:80,sigma:30}],
    audio:{mainVideo:0,backgroundMusic:1.45,voiceNarration:1.75} },
  { id:'top-template', name:'Top Template', builtin:true, description:'Template ở trên, title ở giữa',
    layout:{templateX:0,templateY:100,templateW:1440,templateH:-1,logoX:56,logoY:30,logoW:200,logoH:146,titleX:5,titleY:960,titleW:1435,titleH:300,titleDuration:30,mainVideoSkip:180},
    blurZones:[{id:'tl',label:'Top-Left',x:0,y:-30,w:210,h:210,sigma:30},{id:'tr',label:'Top-Right',x:1130,y:-30,w:350,h:180,sigma:30}],
    audio:{mainVideo:0,backgroundMusic:1.45,voiceNarration:1.75} },
  { id:'large-template', name:'Large Template', builtin:true, description:'Template full width, title nhỏ',
    layout:{templateX:0,templateY:300,templateW:1440,templateH:810,logoX:56,logoY:100,logoW:240,logoH:175,titleX:5,titleY:1200,titleW:1435,titleH:250,titleDuration:30,mainVideoSkip:180},
    blurZones:[{id:'tl',label:'Top-Left',x:0,y:-30,w:210,h:210,sigma:30},{id:'tr',label:'Top-Right',x:1130,y:-30,w:350,h:180,sigma:30},{id:'bt',label:'Bottom-Ctr',x:420,y:-200,w:600,h:80,sigma:30}],
    audio:{mainVideo:0,backgroundMusic:1.45,voiceNarration:1.75} },
  { id:'no-blur', name:'No Blur', builtin:true, description:'Không có blur — video sạch',
    layout:{templateX:0,templateY:476,templateW:1440,templateH:-1,logoX:56,logoY:198,logoW:200,logoH:146,titleX:5,titleY:1469,titleW:1435,titleH:300,titleDuration:30,mainVideoSkip:180},
    blurZones:[], audio:{mainVideo:0,backgroundMusic:1.45,voiceNarration:1.75} },
  { id:'voice-focused', name:'Voice Focused', builtin:true, description:'Giọng nổi, nhạc nhẹ',
    layout:{templateX:0,templateY:476,templateW:1440,templateH:-1,logoX:56,logoY:198,logoW:200,logoH:146,titleX:5,titleY:1469,titleW:1435,titleH:300,titleDuration:30,mainVideoSkip:180},
    blurZones:[{id:'tl',label:'Top-Left',x:0,y:-30,w:210,h:210,sigma:30},{id:'tr',label:'Top-Right',x:1130,y:-30,w:350,h:180,sigma:30},{id:'bt',label:'Bottom-Ctr',x:420,y:-200,w:600,h:80,sigma:30}],
    audio:{mainVideo:0,backgroundMusic:0.6,voiceNarration:2.0} },
]

// ─── Resize handles ───────────────────────────────────────────────────────────
const HANDLES = ['n','s','e','w','ne','nw','se','sw'] as const
type Handle = typeof HANDLES[number]
const HANDLE_CURSOR: Record<Handle,string> = { n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize',ne:'nesw-resize',sw:'nesw-resize',nw:'nwse-resize',se:'nwse-resize' }
function handleStyle(h: Handle, w: number, hh: number): React.CSSProperties {
  const S=8, half=S/2
  const cx = h.includes('e')?w-1:h.includes('w')?1:w/2
  const cy = h.includes('s')?hh-1:h.includes('n')?1:hh/2
  return { position:'absolute', width:S, height:S, left:cx-half, top:cy-half, cursor:HANDLE_CURSOR[h], background:'#fff', border:'1.5px solid #2563eb', borderRadius:2, zIndex:20, boxShadow:'0 0 0 1px rgba(37,99,235,0.3)' }
}
function ResizeHandles({ w, h, onHandle }: { w:number; h:number; onHandle:(e:React.MouseEvent,h:Handle)=>void }) {
  return <>{HANDLES.map(hd=><div key={hd} style={handleStyle(hd,w,h)} onMouseDown={e=>onHandle(e,hd)}/>)}</>
}

// ─── Canvas ──────────────────────────────────────────────────────────────────
type ActiveEl = 'logo'|'template'|'title'|`blur-${string}`|null

function Canvas({ layout, onLayout, blurZones, onBlurZones, videoUrl, activeElement, setActiveElement, layers, zoom }: {
  layout: Layout; onLayout: (l:Partial<Layout>)=>void
  blurZones: BlurZone[]; onBlurZones: (z:BlurZone[])=>void
  videoUrl?: string; activeElement: ActiveEl; setActiveElement: (t:ActiveEl)=>void
  layers: LayersVis; zoom: number
}) {
  const BASE = 260
  const CW = Math.round(BASE * zoom)
  const CH = Math.round(CW * (REAL_H / REAL_W))
  const scale = REAL_W / CW
  const toC = (v:number) => v/scale
  const toR = (v:number) => Math.round(v*scale)
  const clamp = (v:number,lo:number,hi:number) => Math.max(lo,Math.min(hi,v))
  const tplRH = layout.templateH===-1 ? Math.round(layout.templateW*(9/16)) : layout.templateH

  function startMove(e:React.MouseEvent, target:ActiveEl, getXY:()=>[number,number], setXY:(x:number,y:number)=>void, bounds?:{minX?:number;maxX?:number;minY?:number;maxY?:number}) {
    e.preventDefault(); e.stopPropagation(); setActiveElement(target)
    const [ox,oy]=getXY(); const mx0=e.clientX,my0=e.clientY
    const onMove=(ev:MouseEvent)=>{
      const x=ox+toR(ev.clientX-mx0), y=oy+toR(ev.clientY-my0)
      setXY(bounds?.minX!==undefined?clamp(x,bounds.minX,bounds.maxX??REAL_W):x, bounds?.minY!==undefined?clamp(y,bounds.minY,bounds.maxY??REAL_H):y)
    }
    const onUp=()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp)}
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp)
  }
  function startResize(e:React.MouseEvent, handle:Handle, box:{x:number;y:number;w:number;h:number}, setBox:(b:{x:number;y:number;w:number;h:number})=>void, minW=20, minH=10) {
    e.preventDefault(); e.stopPropagation()
    const {x:ox,y:oy,w:ow,h:oh}=box; const mx0=e.clientX,my0=e.clientY
    const onMove=(ev:MouseEvent)=>{
      const dx=toR(ev.clientX-mx0),dy=toR(ev.clientY-my0)
      let nx=ox,ny=oy,nw=ow,nh=oh
      if(handle.includes('e')) nw=Math.max(minW,ow+dx)
      if(handle.includes('s')) nh=Math.max(minH,oh+dy)
      if(handle.includes('w')){nw=Math.max(minW,ow-dx);nx=ox+ow-nw}
      if(handle.includes('n')){nh=Math.max(minH,oh-dy);ny=oy+oh-nh}
      setBox({x:nx,y:ny,w:nw,h:nh})
    }
    const onUp=()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp)}
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp)
  }

  const tplCX=toC(layout.templateX),tplCY=toC(layout.templateY),tplCW=toC(layout.templateW),tplCH=toC(tplRH)
  const logoCX=toC(layout.logoX),logoCY=toC(layout.logoY),logoCW=toC(layout.logoW),logoCH=toC(layout.logoH)
  const titleCX=toC(layout.titleX),titleCY=toC(layout.titleY),titleCW=toC(layout.titleW),titleCH=toC(layout.titleH)

  return (
    <div className="relative select-none flex-shrink-0 overflow-hidden shadow-2xl"
      style={{width:CW,height:CH,background:'#1a1a2e',borderRadius:4}}
      onClick={()=>setActiveElement(null)}>
      {/* Subtle dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.12) 1px,transparent 1px)',backgroundSize:`${Math.max(8,CW/18)}px ${Math.max(8,CW/18)}px`,opacity:0.6}}/>
      {/* Rule of thirds */}
      {[1/3,2/3].map(r=><div key={`h${r}`} className="absolute left-0 right-0 pointer-events-none" style={{top:`${r*100}%`,height:1,background:'rgba(255,255,255,0.04)'}}/>)}
      {[1/3,2/3].map(r=><div key={`v${r}`} className="absolute top-0 bottom-0 pointer-events-none" style={{left:`${r*100}%`,width:1,background:'rgba(255,255,255,0.04)'}}/>)}

      {/* Main Video */}
      {layers.mainVideo && (
        <div className="absolute inset-0 pointer-events-none">
          {videoUrl
            ? <video src={videoUrl} className="w-full h-full object-cover opacity-50" muted loop autoPlay playsInline/>
            : <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gradient-to-b from-slate-900 to-slate-800">
                <Film style={{width:CW*0.08,height:CW*0.08}} className="text-slate-700"/>
                <span className="text-slate-600 font-mono" style={{fontSize:Math.max(6,CW*0.028)}}>MAIN VIDEO · {REAL_W}×{REAL_H}</span>
              </div>}
        </div>
      )}

      {/* Template */}
      {layers.templateVideo && (
        <div className={cn('absolute overflow-hidden border-2 transition-colors',activeElement==='template'?'border-blue-400':'border-blue-400/40 hover:border-blue-400/70')}
          style={{left:tplCX,top:tplCY,width:tplCW,height:tplCH}}
          onClick={e=>{e.stopPropagation();setActiveElement('template')}}>
          <div className="absolute inset-0 bg-blue-900/25 flex flex-col items-center justify-center pointer-events-none">
            <Film style={{width:Math.max(8,tplCW*0.1),height:Math.max(8,tplCW*0.1)}} className="text-blue-400/40"/>
            <span className="text-blue-300/50 font-mono" style={{fontSize:Math.max(5,tplCW*0.035)}}>Template</span>
          </div>
          {/* Drag handle */}
          <div className="absolute top-0 left-0 right-0 flex items-center px-1 gap-1 cursor-move z-30"
            style={{height:Math.max(10,tplCH*0.065),background:'rgba(37,99,235,0.75)'}}
            onMouseDown={e=>startMove(e,'template',()=>[layout.templateX,layout.templateY],(nx,ny)=>onLayout({templateX:nx,templateY:clamp(ny,0,REAL_H)}))}>
            <Move style={{width:Math.max(6,tplCW*0.04),height:Math.max(6,tplCW*0.04)}} className="text-white/80 pointer-events-none shrink-0"/>
            <span className="text-white/80 font-mono pointer-events-none truncate" style={{fontSize:Math.max(5,tplCW*0.035)}}>{layout.templateX},{layout.templateY}</span>
          </div>
          {activeElement==='template' && <ResizeHandles w={tplCW} h={tplCH} onHandle={(e,h)=>startResize(e,h,{x:layout.templateX,y:layout.templateY,w:layout.templateW,h:tplRH},b=>onLayout({templateX:b.x,templateY:b.y,templateW:b.w,templateH:layout.templateH===-1?-1:b.h}),80,40)}/>}
        </div>
      )}

      {/* Blur zones — rendered independently so they show even when template layer is hidden */}
      {layers.blurZones && blurZones.map(z=>{
        const bzKey:ActiveEl=`blur-${z.id}`,isA=activeElement===bzKey
        const bScale=tplCW/layout.templateW
        const bx=tplCX+z.x*bScale,by=tplCY+z.y*bScale,bw=Math.max(4,z.w*bScale),bh=Math.max(3,z.h*bScale)
        return <div key={z.id}
          className={cn('absolute border border-dashed cursor-move',isA?'border-orange-400 bg-orange-400/25 z-20':'border-orange-400/50 bg-orange-400/10 hover:bg-orange-400/20 z-10')}
          style={{left:bx,top:by,width:bw,height:bh}}
          onMouseDown={e=>startMove(e,bzKey,()=>[z.x,z.y],(nx,ny)=>onBlurZones(blurZones.map(b=>b.id===z.id?{...b,x:nx,y:ny}:b)))}
          onClick={e=>{e.stopPropagation();setActiveElement(bzKey)}}>
          <div className="absolute inset-0 pointer-events-none" style={{backdropFilter:'blur(3px)',WebkitBackdropFilter:'blur(3px)'}}/>
          <span className="absolute top-0 left-0.5 text-orange-300 font-bold pointer-events-none leading-none" style={{fontSize:8}}>{z.label}</span>
          {isA && <ResizeHandles w={bw} h={bh} onHandle={(e,h)=>startResize(e,h,{x:z.x,y:z.y,w:z.w,h:z.h},b=>onBlurZones(blurZones.map(bl=>bl.id===z.id?{...bl,...b}:bl)),10,5)}/>}
        </div>
      })}

      {/* Title */}
      {layers.title && (
        <div className={cn('absolute border-y-2 cursor-move',activeElement==='title'?'bg-purple-500/40 border-purple-400 z-20':'bg-black/40 border-purple-400/40 hover:bg-purple-500/25 hover:border-purple-400/70 z-10')}
          style={{left:titleCX,top:titleCY,width:titleCW,height:Math.max(5,titleCH)}}
          onMouseDown={e=>startMove(e,'title',()=>[layout.titleX,layout.titleY],(nx,ny)=>onLayout({titleX:nx,titleY:clamp(ny,0,REAL_H-layout.titleH)}))}
          onClick={e=>{e.stopPropagation();setActiveElement('title')}}>
          <div className="flex items-center gap-1 px-1.5 h-full pointer-events-none overflow-hidden">
            <Type style={{width:Math.max(5,titleCW*0.022),height:Math.max(5,titleCW*0.022),flexShrink:0}} className="text-purple-300"/>
            <span className="text-purple-200 font-mono truncate" style={{fontSize:Math.max(5,titleCW*0.025)}}>TITLE · {layout.titleDuration}s</span>
          </div>
          {activeElement==='title' && <ResizeHandles w={titleCW} h={Math.max(5,titleCH)} onHandle={(e,h)=>startResize(e,h,{x:layout.titleX,y:layout.titleY,w:layout.titleW,h:layout.titleH},b=>onLayout({titleX:b.x,titleY:b.y,titleW:b.w,titleH:b.h}),100,20)}/>}
        </div>
      )}

      {/* Logo */}
      {layers.logo && (
        <div className={cn('absolute cursor-move rounded border-2',activeElement==='logo'?'border-blue-400 bg-blue-400/20 z-20':'border-sky-400/50 bg-sky-400/10 hover:border-sky-400 hover:bg-sky-400/20 z-10')}
          style={{left:logoCX,top:logoCY,width:Math.max(6,logoCW),height:Math.max(4,logoCH)}}
          onMouseDown={e=>startMove(e,'logo',()=>[layout.logoX,layout.logoY],(nx,ny)=>onLayout({logoX:clamp(nx,0,REAL_W-layout.logoW),logoY:clamp(ny,0,REAL_H-layout.logoH)}))}
          onClick={e=>{e.stopPropagation();setActiveElement('logo')}}>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <ImageIcon style={{width:Math.max(4,logoCW*0.35),height:Math.max(4,logoCH*0.35)}} className="text-sky-300/70"/>
          </div>
          {activeElement==='logo' && <ResizeHandles w={Math.max(6,logoCW)} h={Math.max(4,logoCH)} onHandle={(e,h)=>startResize(e,h,{x:layout.logoX,y:layout.logoY,w:layout.logoW,h:layout.logoH},b=>onLayout({logoX:b.x,logoY:b.y,logoW:b.w,logoH:b.h}),10,5)}/>}
        </div>
      )}

      {/* Zoom badge */}
      <div className="absolute bottom-1 right-1 bg-black/60 text-white/40 font-mono px-1 py-0.5 rounded pointer-events-none" style={{fontSize:6}}>{Math.round(zoom*100)}%</div>
    </div>
  )
}

// ─── DraggableClip ─────────────────────────────────────────────────────────────
// Renders a clip bar that can be dragged (move) and resized (right-edge drag).
// All positions are in % of the track width. Caller converts sec↔pct.
function DraggableClip({
  startPct, widthPct, label, color, bgColor, minWidthPct = 0.5,
  onMove,   // (newStartPct) => void
  onResize, // (newWidthPct) => void
  active, onSelect, tooltip,
}: {
  startPct: number; widthPct: number; label: string; color: string; bgColor?: string
  minWidthPct?: number
  onMove?: (newStart: number) => void
  onResize?: (newWidth: number) => void
  active?: boolean; onSelect?: () => void; tooltip?: string
}) {
  const clipRef = useRef<HTMLDivElement>(null)

  // ── drag-to-move ──────────────────────────────────────────────────────────
  const handleMouseDownMove = (e: React.MouseEvent) => {
    if (!onMove) return
    e.preventDefault(); e.stopPropagation()
    onSelect?.()
    const trackEl = (e.currentTarget as HTMLElement).closest('[data-track]') as HTMLElement
    if (!trackEl) return
    const trackW = trackEl.getBoundingClientRect().width
    const startX = e.clientX
    const origStart = startPct

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ((ev.clientX - startX) / trackW) * 100
      const newStart = Math.max(0, Math.min(100 - widthPct, origStart + dx))
      onMove(newStart)
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // ── right-edge resize ─────────────────────────────────────────────────────
  const handleMouseDownResize = (e: React.MouseEvent) => {
    if (!onResize) return
    e.preventDefault(); e.stopPropagation()
    const trackEl = (e.currentTarget as HTMLElement).closest('[data-track]') as HTMLElement
    if (!trackEl) return
    const trackW = trackEl.getBoundingClientRect().width
    const startX = e.clientX
    const origWidth = widthPct

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ((ev.clientX - startX) / trackW) * 100
      const newWidth = Math.max(minWidthPct, Math.min(100 - startPct, origWidth + dx))
      onResize(newWidth)
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      ref={clipRef}
      title={tooltip}
      className={cn(
        'absolute top-1 bottom-1 rounded select-none group transition-shadow',
        active ? 'ring-2 ring-white/80 shadow-lg z-20' : 'z-10',
        onMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
      )}
      style={{ left: `${Math.max(0, startPct)}%`, width: `${Math.max(minWidthPct, widthPct)}%`, background: bgColor || color }}
      onMouseDown={handleMouseDownMove}
      onClick={e => { e.stopPropagation(); onSelect?.() }}
    >
      {/* Clip label */}
      <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-bold text-white truncate pointer-events-none leading-none"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
        {label}
      </span>

      {/* Right-edge resize handle */}
      {onResize && (
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
          style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '0 4px 4px 0' }}
          onMouseDown={handleMouseDownResize}
        >
          <div className="w-0.5 h-3 bg-white/70 rounded-full pointer-events-none"/>
        </div>
      )}

      {/* Active glow border */}
      {active && <div className="absolute inset-0 rounded ring-1 ring-white/50 pointer-events-none"/>}
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
function Timeline({ sourceMode, onSourceModeChange, layout, onLayout, totalDuration=160, onTotalDurationChange, renderLogs, rendering, showLogs, voiceDurationSec }:{
  sourceMode: SourceModeConfig; onSourceModeChange: (c: SourceModeConfig) => void
  layout: Layout; onLayout: (l: Partial<Layout>) => void
  totalDuration?: number; onTotalDurationChange?: (d: number) => void
  renderLogs:{msg:string;level:string}[]; rendering:boolean; showLogs:boolean
  voiceDurationSec?: number | null
}) {
  const logRef = useRef<HTMLDivElement>(null)
  const [tlZoom, setTlZoom] = useState(1)        // 1 = fit, >1 = zoom in
  const [playheadPct, setPlayheadPct] = useState(0)
  const [activeClip, setActiveClip] = useState<string|null>(null)
  const trackAreaRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{ if(logRef.current) logRef.current.scrollTop=logRef.current.scrollHeight },[renderLogs])

  // ── helpers ──────────────────────────────────────────────────────────────
  const secToPct = (s: number) => Math.max(0, (s / totalDuration) * 100)
  const pctToSec = (p: number) => Math.round((p / 100) * totalDuration)
  const clampPct = (p: number) => Math.max(0, Math.min(100, p))

  const setSm = (patch: Partial<SourceModeConfig>) => onSourceModeChange({ ...sourceMode, ...patch })
  const setSubSm = <K extends keyof SourceModeConfig>(key: K, patch: Partial<SourceModeConfig[K]>) =>
    onSourceModeChange({ ...sourceMode, [key]: { ...(sourceMode[key] as object), ...patch } })

  // ── build main segments ───────────────────────────────────────────────────
  const { mode } = sourceMode
  type Seg = { id:string; startPct:number; widthPct:number; label:string; color:string; bgColor?:string; draggable:boolean; resizable:boolean }
  let mainSegments: Seg[] = []

  if (mode === 'sequential') {
    const skip = sourceMode.sequential.skipSec
    const skipPct = clampPct((skip / totalDuration) * 100)
    const usedPct = clampPct(100 - skipPct)
    mainSegments = [
      { id:'skip', startPct:0, widthPct:skipPct, label:`skip (${skip}s)`, color:'#94a3b8', bgColor:'rgba(148,163,184,0.4)', draggable:false, resizable:true },
      { id:'used', startPct:skipPct, widthPct:usedPct, label:'main video', color:'#2563eb', draggable:false, resizable:false },
    ]
  } else if (mode === 'random_clips') {
    let pos=3
    for(let i=0;i<8&&pos<95;i++){
      const w=Math.max(4,6+Math.sin(i*1.9)*4+3)
      if(pos+w>96) break
      mainSegments.push({id:`rc${i}`,startPct:pos,widthPct:w,label:`clip ${i+1}`,color:'#7c3aed',draggable:false,resizable:false})
      pos+=w+2+Math.abs(Math.sin(i*2.5)*3)
    }
  } else if (mode === 'first_n') {
    const pct = clampPct((sourceMode.firstN.durationSec / totalDuration) * 100)
    mainSegments = [{ id:'fn', startPct:0, widthPct:pct, label:`first ${sourceMode.firstN.durationSec}s`, color:'#059669', draggable:false, resizable:true }]
  } else if (mode === 'custom_range') {
    const sPct = clampPct(secToPct(sourceMode.customRange.startSec))
    const ePct = clampPct(secToPct(sourceMode.customRange.endSec))
    mainSegments = [{ id:'cr', startPct:sPct, widthPct:Math.max(1,ePct-sPct), label:`${sourceMode.customRange.startSec}s → ${sourceMode.customRange.endSec}s`, color:'#d97706', draggable:true, resizable:true }]
  } else if (mode === 'multi_clip') {
    mainSegments = sourceMode.multiClip.clips.map((c,i) => ({
      id: `mc${i}`, startPct: clampPct(secToPct(c.startSec)),
      widthPct: Math.max(0.5, (c.durationSec/totalDuration)*100),
      label: c.label||`clip ${i+1}`, color:'#dc2626', draggable:true, resizable:true,
    }))
  }

  // ── overlay / title clip ──────────────────────────────────────────────────
  const titleStartPct = 0
  const titleWidthPct = clampPct(secToPct(layout.titleDuration))

  // ── playhead click on ruler ───────────────────────────────────────────────
  const handleRulerClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pct = ((e.clientX - rect.left) / rect.width) * 100
    setPlayheadPct(clampPct(pct))
  }

  // Track heights per spec
  const TRACKS = [
    { id:'overlays', label:'OVERLAYS', height:28, rowBg:'#fafafa', borderColor:'#6366f1' },
    { id:'video1',   label:'VIDEO 1',  height:36, rowBg:'#f0f7ff', borderColor:'#2563eb' },
    { id:'audio1',   label:'AUDIO 1',  height:24, rowBg:'#fdfaff', borderColor:'#7c3aed' },
    { id:'voice',    label:'VOICEOVER',height:24, rowBg:'#fff5fa', borderColor:'#db2777' },
  ]
  const ticks = Array.from({length:13},(_,i)=>({ label:formatTime(totalDuration*i/12), pct:i/12*100 }))
  // Timecode from playhead
  const playheadSec = Math.round((playheadPct/100)*totalDuration)
  const tcH = String(Math.floor(playheadSec/3600)).padStart(2,'0')
  const tcM = String(Math.floor((playheadSec%3600)/60)).padStart(2,'0')
  const tcS = String(playheadSec%60).padStart(2,'0')
  const timecodeFull = `${tcH}:${tcM}:${tcS}:00`

  return (
    <div className="flex flex-col" style={{background:'#f8fafc',borderTop:'1px solid #e2e8f0'}}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-8 border-b border-slate-200 shrink-0" style={{background:'#f1f5f9'}}>
        <div className="flex items-center gap-1.5">
          <Scissors className="w-3.5 h-3.5 text-slate-400"/>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Timeline</span>
          <span className="text-[10px] text-violet-500 font-medium ml-1 capitalize">· {mode.replace(/_/g,' ')}</span>
        </div>
        {rendering && <div className="flex items-center gap-1.5 ml-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/><span className="text-[10px] text-green-600 font-medium">Rendering...</span></div>}

        {/* Cut/Split/Delete tool buttons (visual only) */}
        <div className="flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded bg-slate-200/60 border border-slate-200">
          <button className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Cut"><Scissors className="w-3 h-3"/></button>
          <div className="w-px h-3 bg-slate-300 mx-0.5"/>
          <button className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Split"><AlignLeft className="w-3 h-3"/></button>
          <button className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3 h-3"/></button>
        </div>

        {/* Total duration control */}
        {onTotalDurationChange && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200/60 border border-slate-200">
            <Timer className="w-3 h-3 text-slate-400"/>
            <span className="text-[9px] text-slate-400 font-mono">Duration:</span>
            <input
              type="number" min={10} max={7200} value={totalDuration}
              onChange={e => onTotalDurationChange(Math.max(10, +e.target.value))}
              className="w-12 h-4 px-1 text-[10px] font-mono font-bold text-slate-700 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-[9px] text-slate-400">s</span>
          </div>
        )}

        {/* Fit to Voice button */}
        {voiceDurationSec != null && onTotalDurationChange && (
          <button
            onClick={() => onTotalDurationChange(Math.ceil(voiceDurationSec!))}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-pink-50 border border-pink-200 hover:bg-pink-100 transition-colors"
            title={`Set duration to voice length (${voiceDurationSec}s)`}
          >
            <Mic className="w-3 h-3 text-pink-500"/>
            <span className="text-[9px] font-bold text-pink-600">Fit to Voice ({Math.ceil(voiceDurationSec)}s)</span>
          </button>
        )}

        <div className="flex-1"/>

        {/* Timecode display on right */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
          <Timer className="w-2.5 h-2.5 text-slate-400"/>
          <span className="text-[10px] font-mono font-bold text-green-400 tracking-widest">{timecodeFull}</span>
        </div>

        {/* Timeline zoom */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-200/60">
          <button onClick={()=>setTlZoom(z=>Math.max(0.5,+(z-0.25).toFixed(2)))} className="text-slate-500 hover:text-slate-800"><ZoomOut className="w-3.5 h-3.5"/></button>
          <div className="relative w-16 h-1.5 bg-slate-300 rounded-full cursor-pointer" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setTlZoom(+(0.5+(e.clientX-r.left)/r.width*4).toFixed(2))}}>
            <div className="absolute left-0 top-0 h-full bg-blue-500 rounded-full" style={{width:`${((tlZoom-0.5)/4)*100}%`}}/>
          </div>
          <button onClick={()=>setTlZoom(z=>Math.min(4.5,+(z+0.25).toFixed(2)))} className="text-slate-500 hover:text-slate-800"><ZoomIn className="w-3.5 h-3.5"/></button>
        </div>
        {activeClip && (
          <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
            {activeClip} selected
          </span>
        )}
      </div>

      {showLogs && renderLogs.length > 0 ? (
        <div ref={logRef} className="h-32 overflow-y-auto p-2 space-y-0.5" style={{background:'#0f172a',fontFamily:'monospace'}}>
          {renderLogs.map((l,i)=>(
            <div key={i} className={cn('text-[10px] leading-tight',l.level==='error'?'text-red-400':l.level==='success'?'text-green-400':l.level==='info'?'text-blue-400':'text-slate-500')}>{l.msg}</div>
          ))}
        </div>
      ) : (
        <div className="flex overflow-x-auto" style={{minHeight:120}}>
          {/* Track labels — 96px wide with colored left border */}
          <div className="shrink-0 flex flex-col border-r border-slate-200 z-10" style={{width:96,background:'#f1f5f9',position:'sticky',left:0}}>
            <div className="border-b border-slate-200" style={{height:20}}/>
            {TRACKS.map(t=>(
              <div key={t.id} className="flex items-center px-2 gap-1.5 border-b border-slate-100 relative overflow-hidden" style={{height:t.height,background:'#f1f5f9'}}>
                {/* Colored left border */}
                <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{background:t.borderColor}}/>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide leading-none pl-2">{t.label}</span>
              </div>
            ))}
          </div>

          {/* Scrollable track area */}
          <div ref={trackAreaRef} className="flex-1 flex flex-col relative" style={{minWidth:0, width:`${100*tlZoom}%`}}>
            {/* Time ruler (clickable to set playhead) */}
            <div className="h-5 shrink-0 relative border-b border-slate-200 cursor-crosshair select-none"
              style={{background:'#f8fafc'}}
              onClick={handleRulerClick}>
              {ticks.map((t,i)=>(
                <div key={i} className="absolute top-0 h-full flex flex-col items-start pointer-events-none" style={{left:`${t.pct}%`}}>
                  <div className="h-2.5 w-px bg-slate-300"/>
                  {i % 2 === 0 && <span className="text-[8px] text-slate-400 font-mono ml-0.5 leading-none">{t.label}</span>}
                </div>
              ))}
              {/* Playhead on ruler */}
              <div className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none z-20" style={{left:`${playheadPct}%`,transform:'translateX(-50%)'}}>
                <div className="w-0 h-0" style={{borderLeft:'4px solid transparent',borderRight:'4px solid transparent',borderTop:'6px solid #ef4444'}}/>
              </div>
            </div>

            {/* Playhead line across all tracks */}
            <div className="absolute top-5 bottom-0 w-px bg-red-400/70 pointer-events-none z-30" style={{left:`${playheadPct}%`}}/>

            {/* Tracks */}
            {TRACKS.map(t => (
              <div key={t.id} data-track className="relative border-b border-slate-100 select-none" style={{height:t.height,background:t.rowBg}}>
                {/* Grid lines */}
                {ticks.map((tk,i)=>(
                  <div key={i} className="absolute top-0 bottom-0 w-px pointer-events-none" style={{left:`${tk.pct}%`,background:i%4===0?'rgba(0,0,0,0.08)':'rgba(0,0,0,0.03)'}}/>
                ))}

                {/* OVERLAYS track: title clip (draggable duration) */}
                {t.id==='overlays' && (
                  <DraggableClip
                    startPct={titleStartPct} widthPct={titleWidthPct}
                    label={`TITLE: CINEMATIC (${layout.titleDuration}s)`}
                    color="#6366f1" bgColor="rgba(99,102,241,0.75)"
                    active={activeClip==='title-overlay'} onSelect={()=>setActiveClip('title-overlay')}
                    tooltip={`Title overlay · duration: ${layout.titleDuration}s`}
                    onResize={newW => { const newDur = Math.max(1, pctToSec(newW)); onLayout({ titleDuration: newDur }) }}
                  />
                )}

                {/* VIDEO 1 track: main segments */}
                {t.id==='video1' && mainSegments.map((seg,si) => (
                  <DraggableClip
                    key={seg.id}
                    startPct={seg.startPct} widthPct={seg.widthPct}
                    label={seg.label} color={seg.color} bgColor={seg.bgColor}
                    active={activeClip===seg.id} onSelect={()=>setActiveClip(seg.id)}
                    tooltip={`${seg.label} · ${pctToSec(seg.startPct)}s → ${pctToSec(seg.startPct+seg.widthPct)}s`}
                    onMove={seg.draggable ? (newStart) => {
                      if (mode==='custom_range') {
                        const startSec = pctToSec(newStart)
                        const dur = sourceMode.customRange.endSec - sourceMode.customRange.startSec
                        setSubSm('customRange', { startSec, endSec: startSec + dur })
                      } else if (mode==='multi_clip') {
                        const clips = [...sourceMode.multiClip.clips]
                        clips[si] = { ...clips[si], startSec: pctToSec(newStart) }
                        setSubSm('multiClip', { clips })
                      }
                    } : undefined}
                    onResize={seg.resizable ? (newW) => {
                      if (mode==='sequential') {
                        if (seg.id==='skip') setSubSm('sequential', { skipSec: pctToSec(newW) })
                      } else if (mode==='first_n') {
                        setSubSm('firstN', { durationSec: Math.max(1, pctToSec(newW)) })
                      } else if (mode==='custom_range') {
                        const newEnd = Math.min(totalDuration, pctToSec(seg.startPct + newW))
                        setSubSm('customRange', { endSec: newEnd })
                      } else if (mode==='multi_clip') {
                        const clips = [...sourceMode.multiClip.clips]
                        clips[si] = { ...clips[si], durationSec: Math.max(1, pctToSec(newW)) }
                        setSubSm('multiClip', { clips })
                      }
                    } : undefined}
                  />
                ))}

                {/* AUDIO 1 track: background music waveform (static, full duration) */}
                {t.id==='audio1' && (
                  <div className="absolute top-1 bottom-1 left-0 right-0 rounded overflow-hidden" style={{background:'rgba(167,139,250,0.15)',border:'1px solid rgba(139,92,246,0.2)'}}>
                    <div className="absolute inset-0 flex items-center px-1 gap-px pointer-events-none">
                      {Array.from({length:120}).map((_,i)=>(
                        <div key={i} className="shrink-0 rounded-full" style={{width:1,height:`${20+Math.abs(Math.sin(i*0.4+1)*65)}%`,background:'#7c3aed',opacity:0.5}}/>
                      ))}
                    </div>
                    <span className="absolute top-0.5 left-1.5 text-[7px] font-bold text-violet-600 pointer-events-none">MUSIC</span>
                  </div>
                )}

                {/* VOICEOVER track: voice waveform */}
                {t.id==='voice' && (
                  <DraggableClip
                    startPct={5} widthPct={80}
                    label="V_Narr_Draft_01.mp3"
                    color="#db2777" bgColor="rgba(236,72,153,0.15)"
                    active={activeClip==='voice'} onSelect={()=>setActiveClip('voice')}
                    tooltip="Voice narration · drag to adjust offset"
                    onMove={()=>setActiveClip('voice')}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trim controls for selected clip */}
      {activeClip && !showLogs && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-slate-100 bg-white text-[9px] font-mono">
          <span className="font-bold text-blue-600 shrink-0">{activeClip}</span>

          {/* custom_range: start + end inputs */}
          {activeClip==='cr' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">start</span>
              <input type="number" min={0} max={totalDuration} value={sourceMode.customRange.startSec}
                onChange={e=>setSubSm('customRange',{startSec:Math.max(0,+e.target.value)})}
                className="w-14 h-5 px-1 text-[10px] bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-slate-700"/>
              <span className="text-slate-400">s · end</span>
              <input type="number" min={0} max={totalDuration} value={sourceMode.customRange.endSec}
                onChange={e=>setSubSm('customRange',{endSec:Math.min(totalDuration,+e.target.value)})}
                className="w-14 h-5 px-1 text-[10px] bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-slate-700"/>
              <span className="text-slate-400">s · dur: <strong className="text-slate-700">{sourceMode.customRange.endSec-sourceMode.customRange.startSec}s</strong></span>
            </div>
          )}

          {/* multi_clip: start + duration inputs */}
          {activeClip.startsWith('mc') && (() => {
            const i=+activeClip.slice(2); const c=sourceMode.multiClip.clips[i]
            if(!c) return null
            return (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">start</span>
                <input type="number" min={0} max={totalDuration} value={c.startSec}
                  onChange={e=>{const clips=[...sourceMode.multiClip.clips];clips[i]={...clips[i],startSec:+e.target.value};setSubSm('multiClip',{clips})}}
                  className="w-14 h-5 px-1 text-[10px] bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-slate-700"/>
                <span className="text-slate-400">s · dur</span>
                <input type="number" min={1} max={totalDuration} value={c.durationSec}
                  onChange={e=>{const clips=[...sourceMode.multiClip.clips];clips[i]={...clips[i],durationSec:Math.max(1,+e.target.value)};setSubSm('multiClip',{clips})}}
                  className="w-14 h-5 px-1 text-[10px] bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-slate-700"/>
                <span className="text-slate-400">s</span>
              </div>
            )
          })()}

          {/* sequential skip */}
          {activeClip==='skip' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">skip</span>
              <input type="number" min={0} max={totalDuration} value={sourceMode.sequential.skipSec}
                onChange={e=>setSubSm('sequential',{skipSec:Math.max(0,+e.target.value)})}
                className="w-16 h-5 px-1 text-[10px] bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-slate-700"/>
              <span className="text-slate-400">s</span>
            </div>
          )}

          {/* first N */}
          {activeClip==='fn' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">duration</span>
              <input type="number" min={1} max={totalDuration} value={sourceMode.firstN.durationSec}
                onChange={e=>setSubSm('firstN',{durationSec:Math.max(1,+e.target.value)})}
                className="w-16 h-5 px-1 text-[10px] bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-slate-700"/>
              <span className="text-slate-400">s</span>
            </div>
          )}

          {/* title overlay duration */}
          {activeClip==='title-overlay' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">title duration</span>
              <input type="number" min={1} max={totalDuration} value={layout.titleDuration}
                onChange={e=>onLayout({titleDuration:Math.max(1,+e.target.value)})}
                className="w-14 h-5 px-1 text-[10px] bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono text-slate-700"/>
              <span className="text-slate-400">s</span>
            </div>
          )}

          {activeClip.startsWith('rc') && <span className="text-slate-400">random clip · auto-generated at render</span>}

          <div className="flex-1"/>
          <button className="text-slate-400 hover:text-slate-700 text-[9px]" onClick={()=>setActiveClip(null)}>× deselect</button>
        </div>
      )}
    </div>
  )
}

function formatTime(sec: number) {
  const m=Math.floor(sec/60), s=Math.round(sec%60)
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// ─── NumField ────────────────────────────────────────────────────────────────
function NumField({ label, value, onChange, min=0, max, step=1, unit='px', hint }:{
  label:string; value:number; onChange:(v:number)=>void
  min?:number; max?:number; step?:number; unit?:string; hint?:string
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5 uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-1">
        <input type="number" value={value} min={min} max={max} step={step}
          onChange={e=>onChange(+e.target.value)}
          className="w-full h-7 px-2 text-[12px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-800 font-mono shadow-sm"/>
        {unit && <span className="text-[10px] text-slate-400 shrink-0 w-6">{unit}</span>}
      </div>
      {hint && <p className="text-[9px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

// ─── VolumeBar (master mixer fader with gradient) ─────────────────────────────
function VolumeBar({ label, value, onChange, gradientFrom, gradientTo }:{
  label:string; value:number; onChange:(v:number)=>void; gradientFrom:string; gradientTo:string
}) {
  const pct = Math.min((value/2)*100,100)
  const dbLabel = value === 0 ? '-∞' : value < 0.5 ? '-6' : value < 1.5 ? '0' : '+6'
  return (
    <div className="flex flex-col items-center gap-1">
      {/* dB labels on side */}
      <div className="flex items-start gap-1.5">
        <div className="flex flex-col justify-between h-24 text-right" style={{paddingBottom:2}}>
          {['+6','0','-6','-∞'].map(l=>(
            <span key={l} className="text-[7px] font-mono text-slate-400 leading-none">{l}</span>
          ))}
        </div>
        <div className="relative w-7 h-24 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
          <div className="absolute bottom-0 left-0 right-0 rounded-full transition-all" style={{height:`${pct}%`,background:`linear-gradient(to top,${gradientFrom},${gradientTo})`}}/>
          <input type="range" min={0} max={2} step={0.05} value={value} onChange={e=>onChange(+e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" style={{writingMode:'vertical-lr',direction:'rtl',transform:'rotate(180deg)'}}/>
        </div>
      </div>
      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide text-center leading-tight">{label}</span>
      <span className="text-[9px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{(value*100).toFixed(0)}%</span>
    </div>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────
function Section({ label, active, color, icon:Icon, children, defaultOpen=true }:{
  label:string; active:boolean; color:string; icon:React.ElementType; children:React.ReactNode; defaultOpen?:boolean
}) {
  const [open,setOpen]=useState(defaultOpen)
  return (
    <div className={cn('rounded-xl border transition-all',active?`border-blue-300 bg-blue-50/50 shadow-sm`:'border-slate-200 bg-white')}>
      <button className="w-full flex items-center gap-2 px-3 py-2.5" onClick={()=>setOpen(o=>!o)}>
        <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{background:color+'20'}}>
          <Icon className="w-3 h-3" style={{color}}/>
        </div>
        <span className="text-[11px] font-bold flex-1 text-left text-slate-700">{label}</span>
        {active && <span className="text-[9px] font-bold text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">ACTIVE</span>}
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-300"/> : <ChevronRight className="w-3.5 h-3.5 text-slate-300"/>}
      </button>
      {open && <div className="px-3 pb-3 space-y-2.5">{children}</div>}
    </div>
  )
}

// ─── Source Mode Panel ────────────────────────────────────────────────────────
const SOURCE_MODES: {id:SourceModeType;label:string;icon:React.ElementType;desc:string;color:string}[] = [
  {id:'sequential',   label:'Sequential',   icon:SkipForward, desc:'Skip N giây rồi lấy liên tục',        color:'#2563eb'},
  {id:'random_clips', label:'Random Clips', icon:Shuffle,     desc:'Cắt random nhiều đoạn, ghép lại',     color:'#7c3aed'},
  {id:'first_n',      label:'First N Sec',  icon:AlignLeft,   desc:'Lấy N giây đầu tiên',                 color:'#059669'},
  {id:'custom_range', label:'Custom Range', icon:Scissors,    desc:'Chọn start/end thủ công',             color:'#d97706'},
  {id:'multi_clip',   label:'Multi Clip',   icon:ListVideo,   desc:'Thêm từng đoạn theo thứ tự',          color:'#dc2626'},
]

function SourceModePanel({ config, onChange }:{ config:SourceModeConfig; onChange:(c:SourceModeConfig)=>void }) {
  const set=(patch:Partial<SourceModeConfig>)=>onChange({...config,...patch})
  const setSub=<K extends keyof SourceModeConfig>(key:K,patch:Partial<SourceModeConfig[K]>)=>onChange({...config,[key]:{...(config[key] as object),...patch}})
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-1.5">
        {SOURCE_MODES.map(m=>{
          const isA=config.mode===m.id
          return (
            <button key={m.id} onClick={()=>set({mode:m.id})}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',isA?'border-blue-200 bg-blue-50 shadow-sm':'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50')}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{background:isA?m.color+'20':'#f1f5f9'}}>
                <m.icon className="w-3.5 h-3.5" style={{color:isA?m.color:'#94a3b8'}}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold" style={{color:isA?m.color:'#64748b'}}>{m.label}</p>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{m.desc}</p>
              </div>
              {isA && <div className="w-2 h-2 rounded-full shrink-0" style={{background:m.color}}/>}
            </button>
          )
        })}
      </div>
      {/* Mode settings */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Settings</p>
        {config.mode==='sequential' && <NumField label="Skip first N seconds" value={config.sequential.skipSec} onChange={v=>setSub('sequential',{skipSec:v})} min={0} max={600} unit="s" hint="FFmpeg -ss offset"/>}
        {config.mode==='random_clips' && <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Min clip" value={config.randomClips.minClipSec} onChange={v=>setSub('randomClips',{minClipSec:v})} min={2} max={60} unit="s"/>
            <NumField label="Max clip" value={config.randomClips.maxClipSec} onChange={v=>setSub('randomClips',{maxClipSec:v})} min={2} max={120} unit="s"/>
            <NumField label="Avoid start" value={config.randomClips.avoidFirstSec} onChange={v=>setSub('randomClips',{avoidFirstSec:v})} min={0} max={300} unit="s"/>
            <NumField label="Avoid end" value={config.randomClips.avoidLastSec} onChange={v=>setSub('randomClips',{avoidLastSec:v})} min={0} max={120} unit="s"/>
          </div>
          <p className="text-[9px] text-violet-600 bg-violet-50 rounded-lg px-2 py-1.5 border border-violet-100">Clips ngẫu nhiên, không trùng, ghép bằng FFmpeg concat filter.</p>
        </div>}
        {config.mode==='first_n' && <NumField label="Duration" value={config.firstN.durationSec} onChange={v=>setSub('firstN',{durationSec:v})} min={5} max={600} unit="s" hint="Lấy N giây đầu tiên"/>}
        {config.mode==='custom_range' && <div className="grid grid-cols-2 gap-2">
          <NumField label="Start" value={config.customRange.startSec} onChange={v=>setSub('customRange',{startSec:v})} min={0} max={3600} unit="s"/>
          <NumField label="End" value={config.customRange.endSec} onChange={v=>setSub('customRange',{endSec:v})} min={0} max={3600} unit="s" hint={`${config.customRange.endSec-config.customRange.startSec}s`}/>
        </div>}
        {config.mode==='multi_clip' && <div className="space-y-2">
          {config.multiClip.clips.map((clip,i)=>(
            <div key={i} className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[9px] font-bold text-slate-400 w-4 shrink-0">{i+1}</span>
              <div className="flex-1 grid grid-cols-2 gap-1">
                <input type="number" value={clip.startSec} min={0} placeholder="Start s"
                  onChange={e=>{const clips=[...config.multiClip.clips];clips[i]={...clips[i],startSec:+e.target.value};setSub('multiClip',{clips})}}
                  className="h-6 px-1.5 text-[10px] bg-white border border-slate-200 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"/>
                <input type="number" value={clip.durationSec} min={1} placeholder="Dur s"
                  onChange={e=>{const clips=[...config.multiClip.clips];clips[i]={...clips[i],durationSec:+e.target.value};setSub('multiClip',{clips})}}
                  className="h-6 px-1.5 text-[10px] bg-white border border-slate-200 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"/>
              </div>
              <button onClick={()=>setSub('multiClip',{clips:config.multiClip.clips.filter((_,j)=>j!==i)})} className="text-slate-300 hover:text-red-400 transition-colors p-0.5"><X className="w-3 h-3"/></button>
            </div>
          ))}
          <button onClick={()=>setSub('multiClip',{clips:[...config.multiClip.clips,{startSec:60,durationSec:15,label:`clip ${config.multiClip.clips.length+1}`}]})}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
            <Plus className="w-3 h-3"/> Add Clip
          </button>
        </div>}
      </div>
    </div>
  )
}

// ─── Preset Card ─────────────────────────────────────────────────────────────
function PresetCard({ preset, isActive, onApply, onDuplicate, onDelete, onRename }:{
  preset:Preset; isActive:boolean; onApply:()=>void; onDuplicate:()=>void; onDelete?:()=>void; onRename?:(n:string)=>void
}) {
  const [editing,setEditing]=useState(false)
  const [name,setName]=useState(preset.name)
  return (
    <div className={cn('rounded-xl border p-3 space-y-2 transition-all cursor-pointer',isActive?'border-blue-300 bg-blue-50 shadow-sm':'border-slate-200 bg-white hover:border-slate-300')}>
      <div className="flex items-start gap-2">
        <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5',preset.builtin?'bg-amber-100':'bg-blue-100')}>
          {preset.builtin ? <Star className="w-3 h-3 text-amber-500"/> : <BookMarked className="w-3 h-3 text-blue-500"/>}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input autoFocus value={name} onChange={e=>setName(e.target.value)}
              onBlur={()=>{onRename?.(name);setEditing(false)}}
              onKeyDown={e=>{if(e.key==='Enter'){onRename?.(name);setEditing(false)}if(e.key==='Escape')setEditing(false)}}
              className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300"/>
          ) : (
            <p className="text-[11px] font-semibold text-slate-700 truncate">{preset.name}
              {isActive && <span className="ml-1.5 text-[9px] font-bold text-blue-600 bg-blue-100 px-1 py-0.5 rounded">ACTIVE</span>}
            </p>
          )}
          <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{preset.description}</p>
          <p className="text-[9px] text-slate-300 mt-0.5 font-mono">{preset.blurZones.length} blur · {preset.audio.voiceNarration.toFixed(2)}x voice</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onApply} className={cn('flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-semibold transition-colors',isActive?'bg-blue-500 text-white':'bg-slate-100 text-slate-600 hover:bg-blue-500 hover:text-white')}>
          {isActive?<Check className="w-2.5 h-2.5"/>:<Play className="w-2.5 h-2.5"/>}{isActive?'Applied':'Apply'}
        </button>
        <button onClick={onDuplicate} className="p-1 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Copy className="w-3 h-3"/></button>
        {!preset.builtin && onRename && <button onClick={()=>setEditing(true)} className="p-1 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Pencil className="w-3 h-3"/></button>}
        {!preset.builtin && onDelete && <button onClick={onDelete} className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3"/></button>}
      </div>
    </div>
  )
}

// ─── Layers Panel ────────────────────────────────────────────────────────────
const LAYER_DEFS = [
  {k:'title'        as const, label:'Title: OVERLAY', tag:'TXT',  tagBg:'#6366f1', tagText:'#fff', color:'#818cf8', rowColor:'#6366f1'},
  {k:'logo'         as const, label:'Overlay Logo',   tag:'LOGO', tagBg:'#10b981', tagText:'#fff', color:'#34d399', rowColor:'#10b981'},
  {k:'blurZones'    as const, label:'Blur Zone',      tag:'BLUR', tagBg:'#f59e0b', tagText:'#fff', color:'#fbbf24', rowColor:'#f59e0b'},
  {k:'templateVideo'as const, label:'Template Video', tag:'VID',  tagBg:'#3b82f6', tagText:'#fff', color:'#60a5fa', rowColor:'#3b82f6'},
  {k:'mainVideo'    as const, label:'Main Clip',      tag:'VID',  tagBg:'#2563eb', tagText:'#fff', color:'#3b82f6', rowColor:'#2563eb'},
]

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EditorPage() {
  const [layout,setLayout]=useState<Layout>({templateX:0,templateY:476,templateW:1440,templateH:-1,logoX:56,logoY:198,logoW:200,logoH:146,titleX:5,titleY:1469,titleW:1435,titleH:300,titleDuration:30,mainVideoSkip:180})
  const [audio,setAudio]=useState<AudioConfig>({mainVideo:0,backgroundMusic:1.45,voiceNarration:1.75})
  const [blurZones,setBlurZones]=useState<BlurZone[]>([{id:'tl',label:'Top-Left',x:0,y:-30,w:210,h:210,sigma:30},{id:'tr',label:'Top-Right',x:1130,y:-30,w:350,h:180,sigma:30},{id:'bt',label:'Bottom-Ctr',x:420,y:-200,w:600,h:80,sigma:30}])
  const [layers,setLayers]=useState<LayersVis>({mainVideo:true,templateVideo:true,blurZones:true,title:true,logo:true})
  const [lockedLayers,setLockedLayers]=useState<Set<keyof LayersVis>>(new Set())
  const [sourceMode,setSourceMode]=useState<SourceModeConfig>(DEFAULT_SOURCE_MODE)
  const [videos,setVideos]=useState<VideoItem[]>([])
  const [selectedVideo,setSelectedVideo]=useState<VideoItem|null>(null)
  const [activeElement,setActiveElement]=useState<ActiveEl>(null)
  const [leftTab,setLeftTab]=useState<'media'|'source'|'audio'|'text'|'effects'>('media')
  const [rightTab,setRightTab]=useState<'properties'|'layers'>('properties')
  const [propTab,setPropTab]=useState<'source'|'presets'|'layout'|'blur'>('source')
  const [config,setConfig]=useState<Record<string,unknown>|null>(null)
  const [saving,setSaving]=useState(false)
  const [rendering,setRendering]=useState(false)
  const [renderLogs,setRenderLogs]=useState<{msg:string;level:string}[]>([])
  const [showLogs,setShowLogs]=useState(false)
  const [zoom,setZoom]=useState(1.0)
  const [totalDuration,setTotalDuration]=useState(160)
  const [voiceDurationSec,setVoiceDurationSec]=useState<number|null>(null)
  const [fx,setFx]=useState<FxConfig>(DEFAULT_FX)
  const updateFx=(patch:Partial<FxConfig>)=>setFx(prev=>({...prev,...patch}))
  const [userPresets,setUserPresets]=useState<Preset[]>([])
  const [activePresetId,setActivePresetId]=useState<string>('standard')
  const [mediaSearch,setMediaSearch]=useState('')

  // ── Workflow mode ─────────────────────────────────────────────────────────
  const [workflowMode,setWorkflowMode]=useState<'news'|'clip'|'ai'>('news')

  // ── AI Generative Outfit: 2-Phase Flow ────────────────────────────────────
  const [aiOutfitPhase, setAiOutfitPhase]=useState<'idle'|'extracting'|'generating'|'done'>('idle')
  const [aiSourceImagePath, setAiSourceImagePath]=useState<string>('')  // original outfit+bg
  const [aiExtractedOutfitPath, setAiExtractedOutfitPath]=useState<string>('')  // cleaned PNG
  const [aiBackgroundImagePath, setAiBackgroundImagePath]=useState<string>('')
  const [aiAnglePrompts, setAiAnglePrompts]=useState<string[]>([
    'Full body, standing, side view facing right',
    'Close-up upper body, front view',
    'Full body, back view',
    'Frontal face shot, upper torso',
    'Walking pose, 3/4 angle'
  ])
  const [aiAngleInput, setAiAngleInput]=useState('')
  const [aiExtractedPreview, setAiExtractedPreview]=useState<string|null>(null)
  const [aiGeneratedImages, setAiGeneratedImages]=useState<{id:string, path:string, angle:string, timestamp:number}[]>([])
  const [aiCurrentAngleIndex, setAiCurrentAngleIndex]=useState(0)
  const [aiGenerationRunning, setAiGenerationRunning]=useState(false)
  const [aiExtractionRunning, setAiExtractionRunning]=useState(false)
  const [aiAspectRatio, setAiAspectRatio]=useState<'9:16'|'16:9'|'1:1'>('9:16')
  const [aiMaxAttempts, setAiMaxAttempts]=useState(1)
  const [aiEnhancePrompts, setAiEnhancePrompts]=useState(false)
  const [aiStyleHint, setAiStyleHint]=useState('professional product photography')
  const [aiRunId, setAiRunId]=useState(`run_${Date.now()}`)

  // Clip mode state
  const [clipAddFrame,setClipAddFrame]=useState(false)
  const [clipAddLogo,setClipAddLogo]=useState(false)
  const [clipSplitCount,setClipSplitCount]=useState(3)

  useEffect(()=>{
    fetch('/api/config').then(r=>r.json()).then((c:Record<string,unknown>)=>{
      setConfig(c)
      if(c?.layout){const {blurZones:_bz,...restLayout}=c.layout as Partial<Layout>&{blurZones?:unknown};setLayout(prev=>({...prev,...restLayout}))}
      if(c?.audio){const a=c.audio as {volumes?:Partial<AudioConfig>};if(a.volumes)setAudio(prev=>({...prev,...a.volumes}))}
      if(c?.sourceMode) setSourceMode(prev=>({...prev,...(c.sourceMode as Partial<SourceModeConfig>)}))
      if(c?.fx) setFx(prev=>({...prev,...(c.fx as Partial<FxConfig>)}))
      if(Array.isArray(c?.blurZones)) setBlurZones(c.blurZones as BlurZone[])
    }).catch(()=>{})
    fetch('/api/videos').then(r=>r.json()).then((v:VideoItem[])=>setVideos(Array.isArray(v)?v:[])).catch(()=>{})
    // Fetch latest rendered video's voice duration
    fetch('/api/videos?type=rendered').then(r=>r.json()).then((rv:{voiceDurationSec?:number|null}[])=>{
      if(Array.isArray(rv)&&rv.length>0&&rv[0].voiceDurationSec!=null){
        setVoiceDurationSec(rv[0].voiceDurationSec)
      }
    }).catch(()=>{})
  },[])

  const onLayout=useCallback((l:Partial<Layout>)=>setLayout(prev=>({...prev,...l})),[])
  const toggleLayer=(k:keyof LayersVis)=>setLayers(prev=>({...prev,[k]:!prev[k]}))
  const toggleLock=(k:keyof LayersVis)=>setLockedLayers(prev=>{const n=new Set(prev);n.has(k)?n.delete(k):n.add(k);return n})
  const tplRH=layout.templateH===-1?Math.round(layout.templateW*(9/16)):layout.templateH

  const addBlurZone=()=>setBlurZones(z=>[...z,{id:`z${Date.now()}`,label:`Zone ${z.length+1}`,x:200,y:50,w:200,h:100,sigma:30}])
  const removeBlurZone=(id:string)=>setBlurZones(z=>z.filter(b=>b.id!==id))
  const updateBlurZone=(id:string,patch:Partial<BlurZone>)=>setBlurZones(z=>z.map(b=>b.id===id?{...b,...patch}:b))

  const allPresets=[...BUILTIN_PRESETS,...userPresets]
  const applyPreset=(p:Preset)=>{setLayout(p.layout);setBlurZones(p.blurZones);setAudio(p.audio);setActivePresetId(p.id);toast.success(`Applied: ${p.name}`)}
  const saveAsPreset=()=>{
    const name=window.prompt('Tên preset:',`My Preset ${userPresets.length+1}`);if(!name)return
    const id=`user_${Date.now()}`
    setUserPresets(p=>[...p,{id,name,description:`Custom · ${new Date().toLocaleDateString('vi-VN')}`,layout:{...layout},blurZones:[...blurZones],audio:{...audio}}])
    setActivePresetId(id);toast.success(`Saved: "${name}"`)
  }
  const duplicatePreset=(p:Preset)=>{const id=`user_${Date.now()}`,copy={...p,id,name:`${p.name} (copy)`,description:`Copied from ${p.name}`,builtin:false};setUserPresets(prev=>[...prev,copy]);toast.success(`Duplicated`)}
  const deleteUserPreset=(id:string)=>{setUserPresets(p=>p.filter(x=>x.id!==id));if(activePresetId===id)setActivePresetId('standard')}
  const renameUserPreset=(id:string,name:string)=>setUserPresets(p=>p.map(x=>x.id===id?{...x,name}:x))

  const saveLayout=async()=>{
    setSaving(true)
    try{
      const {blurZones:_bz,...configLayout}=((config?.layout||{}) as Record<string,unknown>)
      const next={...config,layout:{...configLayout,...layout,logoScale:`${layout.logoW}:${layout.logoH}`},audio:{...(config?.audio as object||{}),volumes:audio},sourceMode,fx,blurZones}
      await fetch('/api/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)})
      setConfig(next);toast.success('Saved!')
    }catch{toast.error('Failed')}finally{setSaving(false)}
  }

  const runRender=async()=>{
    setRendering(true);setRenderLogs([]);setShowLogs(true)
    const addLog=(msg:string,level='default')=>setRenderLogs(p=>[...p.slice(-300),{msg,level}])
    addLog('Starting render...','info')
    try{
      const res=await fetch('/api/workflow/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({step:'render',runId:`render_${Date.now()}`})})
      if(!res.body){addLog('No stream','error');return}
      const reader=res.body.getReader();const dec=new TextDecoder();let buf=''
      while(true){
        const {done,value}=await reader.read();if(done)break
        buf+=dec.decode(value,{stream:true})
        const parts=buf.split('\n\n');buf=parts.pop()||''
        for(const part of parts){
          const line=part.replace(/^data: /,'').trim();if(!line)continue
          try{const ev=JSON.parse(line);if(ev.type==='log')addLog(ev.message,ev.level||'default');if(ev.type==='done'){if(ev.success){toast.success('Render done!');addLog('Done ✓','success')}else{toast.error('Render failed');addLog('Failed ✗','error')}}}catch{}
        }
      }
    }catch(e){addLog(String(e),'error')}finally{setRendering(false)}
  }

  const activeSection=activeElement==='logo'?'logo':activeElement==='template'?'template':activeElement==='title'?'title':activeElement?.startsWith('blur-')?'blur':null

  // Active element inspector info
  const inspectorLabel = activeElement
    ? activeElement.startsWith('blur-') ? `Blur: ${activeElement.slice(5)}` : activeElement.charAt(0).toUpperCase()+activeElement.slice(1)
    : null
  const inspectorX = activeElement==='logo'?layout.logoX:activeElement==='template'?layout.templateX:activeElement==='title'?layout.titleX:null
  const inspectorY = activeElement==='logo'?layout.logoY:activeElement==='template'?layout.templateY:activeElement==='title'?layout.titleY:null

  // Left tool items
  const LEFT_TOOLS = [
    {id:'media'  as const, icon:Film,        label:'Media'},
    {id:'source' as const, icon:Clapperboard, label:'Source'},
    {id:'audio'  as const, icon:Music,       label:'Audio'},
    {id:'text'   as const, icon:Type,        label:'Text'},
    {id:'effects'as const, icon:Wand2,       label:'FX'},
  ]

  // Timecode for top bar (mock from zoom as stand-in for playTime)
  const playTimeSec = 160
  const tcTopH = String(Math.floor(playTimeSec/3600)).padStart(2,'0')
  const tcTopM = String(Math.floor((playTimeSec%3600)/60)).padStart(2,'0')
  const tcTopS = String(playTimeSec%60).padStart(2,'0')
  const topTimecode = `${tcTopH}:${tcTopM}:${tcTopS}:00`

  const filteredVideos = videos.filter(v=>v.title.toLowerCase().includes(mediaSearch.toLowerCase()))

  return (
    <div className="flex flex-col overflow-hidden" style={{height:'calc(100vh - 64px)',background:'#f1f5f9'}}>

      {/* ── TOP MENU BAR (h-9, dark navy) ─────────────────────────────────────── */}
      <div className="flex items-center shrink-0 px-0 h-9 border-b border-slate-800" style={{background:'#0f172a'}}>
        {/* Left: App logo pill + menu items */}
        <div className="flex items-center gap-0 pl-2 pr-3 border-r border-slate-700/60 h-full">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-600/20 border border-blue-500/30 mr-2">
            <Film className="w-3 h-3 text-blue-400"/>
            <span className="text-[10px] font-black text-blue-300 tracking-wider uppercase">AutoEdit</span>
          </div>
          {['File','Edit','Sequence','View'].map(item=>(
            <button key={item} className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 rounded transition-colors font-medium">
              {item}
            </button>
          ))}
        </div>

        {/* Center: Timecode display */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-800/80 border border-slate-700/60">
            <Timer className="w-3 h-3 text-slate-500"/>
            <span className="text-[13px] font-mono font-bold tracking-[0.15em] text-green-400 tabular-nums">{topTimecode}</span>
          </div>
        </div>

        {/* Right: icons + actions */}
        <div className="flex items-center gap-1 pr-2 pl-3 border-l border-slate-700/60 h-full">
          <button className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors" title="Cloud Save">
            <Cloud className="w-3.5 h-3.5"/>
          </button>
          <button className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors" title="Settings">
            <Settings2 className="w-3.5 h-3.5"/>
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1"/>
          <button onClick={saveLayout} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-300 rounded border border-slate-600 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-40 h-6">
            {saving?<Loader2 className="w-3 h-3 animate-spin"/>:<Save className="w-3 h-3"/>} Save
          </button>
          <button onClick={runRender} disabled={rendering}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white rounded transition-colors disabled:opacity-50 h-6"
            style={{background:'linear-gradient(135deg,#2563eb,#4f46e5)'}}>
            {rendering?<Loader2 className="w-3 h-3 animate-spin"/>:<Download className="w-3 h-3"/>} Export
          </button>
        </div>
      </div>

      {/* ── SECONDARY TOOLBAR (undo/redo/zoom) ───────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 h-8 shrink-0 border-b border-slate-200 bg-white">
        {/* Undo/redo */}
        <div className="flex items-center gap-0.5">
          <button className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Undo2 className="w-3.5 h-3.5"/></button>
          <button className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Redo2 className="w-3.5 h-3.5"/></button>
        </div>
        <div className="w-px h-4 bg-slate-200"/>

        {/* Workflow Mode Selector */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 border border-slate-200">
          {([{id:'news' as const,label:'📰 News'},{id:'clip' as const,label:'✂️ Clip'},{id:'ai' as const,label:'✨ AI'}]).map(m=>(
            <button key={m.id} onClick={()=>setWorkflowMode(m.id)}
              className={cn('px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all',
                workflowMode===m.id?'bg-white text-slate-800 shadow-sm':'text-slate-400 hover:text-slate-600')}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-slate-200"/>

        {/* Floating toolbar pill for canvas controls */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 border border-slate-200 shadow-sm text-[10px]">
          <button onClick={()=>setZoom(z=>Math.max(0.4,z-0.15))} className="text-slate-400 hover:text-slate-700 p-0.5"><ZoomOut className="w-3 h-3"/></button>
          <span className="font-mono font-bold text-slate-600 w-8 text-center">{Math.round(zoom*54)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(2.5,z+0.15))} className="text-slate-400 hover:text-slate-700 p-0.5"><ZoomIn className="w-3 h-3"/></button>
          <div className="w-px h-3 bg-slate-300 mx-0.5"/>
          <button onClick={()=>setZoom(1.0)} className="text-slate-400 hover:text-slate-600 p-0.5" title="Reset zoom"><RotateCcw className="w-3 h-3"/></button>
          <div className="w-px h-3 bg-slate-300 mx-0.5"/>
          <button className="text-slate-400 hover:text-slate-700 p-0.5" title="Crop"><Crop className="w-3 h-3"/></button>
          <span className="text-[9px] font-bold text-slate-500 px-1 py-0.5 rounded bg-slate-200 font-mono">9:16</span>
        </div>

        <div className="flex-1 flex items-center justify-center gap-2">
          {activeElement && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/>
              <span className="text-[10px] font-semibold text-blue-600 capitalize">{activeElement.replace('blur-','Blur: ')} selected</span>
            </div>
          )}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200">
            <Wand2 className="w-3 h-3 text-violet-500"/>
            <span className="text-[10px] font-semibold text-violet-600 capitalize">{sourceMode.mode.replace(/_/g,' ')}</span>
          </div>
        </div>
      </div>

      {/* ── MAIN 3-PANEL LAYOUT ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Icon toolbar + panel ───────────────────────────────────── */}
        <div className="flex shrink-0" style={{background:'#fff',borderRight:'1px solid #e2e8f0'}}>
          {/* Icon column — 60px */}
          <div className="flex flex-col items-center pt-2 pb-2 gap-0.5 border-r border-slate-100" style={{width:60}}>
            {LEFT_TOOLS.map(t=>(
              <button key={t.id} onClick={()=>setLeftTab(t.id)}
                className={cn('flex flex-col items-center gap-1 w-12 py-2.5 rounded-xl transition-all',leftTab===t.id?'bg-blue-50 text-blue-600':'text-slate-400 hover:text-slate-600 hover:bg-slate-50')}>
                <t.icon className="w-5 h-5"/>
                <span className="text-[8px] font-bold uppercase tracking-wide leading-none">{t.label}</span>
              </button>
            ))}
            <div className="flex-1"/>
            <button className="flex flex-col items-center gap-1 w-12 py-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
              <Settings2 className="w-5 h-5"/>
              <span className="text-[8px] font-bold uppercase tracking-wide leading-none">Setup</span>
            </button>
          </div>

          {/* Panel content — w-52 */}
          <div className="flex flex-col overflow-hidden" style={{width:208}}>
            <div className="px-3 pt-2.5 pb-2 border-b border-slate-100 flex items-center gap-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex-1">{LEFT_TOOLS.find(t=>t.id===leftTab)?.label}</p>
            </div>

            {/* Search bar for media tab */}
            {leftTab==='media' && (
              <div className="px-2 pt-2 pb-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400"/>
                  <input
                    value={mediaSearch} onChange={e=>setMediaSearch(e.target.value)}
                    placeholder="Search media..."
                    className="w-full h-7 pl-6 pr-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 text-slate-700"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {leftTab==='media' && (<>
                {workflowMode==='ai' ? (
                  /* AI mode: Generative outfit manager */
                  <div className="space-y-3">
                    <p className="text-[9px] text-slate-400 px-1">Generative Outfit Composition</p>

                    {/* Source Image */}
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-1">Source Outfit</label>
                      <button onClick={()=>document.getElementById('media-source-upload')?.click()}
                        className={cn('w-full px-2 py-1.5 rounded-lg border-2 border-dashed text-center text-[9px] transition-all',
                          aiSourceImagePath?'border-purple-200 bg-purple-50':'border-slate-200 bg-white hover:border-purple-300')}>
                        {aiSourceImagePath ? (
                          <div><p className="font-bold text-purple-700">{aiSourceImagePath.split('/').pop()}</p><p className="text-purple-500 text-[8px]">Click to change</p></div>
                        ) : (
                          'Click to upload'
                        )}
                      </button>
                      <input id="media-source-upload" type="file" className="hidden" accept="image/*"
                        onChange={e=>{const f=e.target.files?.[0];if(f)setAiSourceImagePath(f.name)}}/>
                    </div>

                    {/* Background Image */}
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-1">Background</label>
                      <button onClick={()=>document.getElementById('media-bg-upload')?.click()}
                        className={cn('w-full px-2 py-1.5 rounded-lg border-2 border-dashed text-center text-[9px] transition-all',
                          aiBackgroundImagePath?'border-purple-200 bg-purple-50':'border-slate-200 bg-white hover:border-purple-300')}>
                        {aiBackgroundImagePath ? (
                          <div><p className="font-bold text-purple-700">{aiBackgroundImagePath.split('/').pop()}</p><p className="text-purple-500 text-[8px]">Click to change</p></div>
                        ) : (
                          'Click to upload'
                        )}
                      </button>
                      <input id="media-bg-upload" type="file" className="hidden" accept="image/*"
                        onChange={e=>{const f=e.target.files?.[0];if(f)setAiBackgroundImagePath(f.name)}}/>
                    </div>

                    {/* Settings */}
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-1">Settings</label>
                      <div className="space-y-1.5 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                        <div>
                          <p className="text-[8px] text-slate-500 mb-0.5">Aspect Ratio</p>
                          <select value={aiAspectRatio} onChange={e=>setAiAspectRatio(e.target.value as any)}
                            className="w-full text-[9px] px-1.5 py-1 rounded-md border border-slate-200 bg-white">
                            <option value="9:16">9:16 (TikTok)</option>
                            <option value="16:9">16:9 (YouTube)</option>
                            <option value="1:1">1:1 (Instagram)</option>
                          </select>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-0.5">
                            <p className="text-[8px] text-slate-500">Max Attempts</p>
                            <span className="text-[9px] font-bold text-slate-700">{aiMaxAttempts}</span>
                          </div>
                          <input type="range" min={1} max={3} value={aiMaxAttempts} onChange={e=>setAiMaxAttempts(+e.target.value)}
                            className="w-full h-1 bg-slate-200 rounded-full"/>
                        </div>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={aiEnhancePrompts} onChange={e=>setAiEnhancePrompts(e.target.checked)}
                            className="w-3 h-3 rounded"/>
                          <span className="text-[8px] text-slate-600">Auto-enhance prompts</span>
                        </label>
                        <input value={aiStyleHint} onChange={e=>setAiStyleHint(e.target.value)}
                          placeholder="Style hint..."
                          className="w-full text-[8px] px-1.5 py-1 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"/>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* News/Clip mode: video files */
                  <>
                    {filteredVideos.length===0 ? (
                      <div className="flex flex-col items-center justify-center h-24 text-center rounded-xl border-2 border-dashed border-slate-200 p-4">
                        <Film className="w-6 h-6 text-slate-300 mb-1.5"/>
                        <p className="text-[10px] text-slate-400">{mediaSearch ? 'No results' : 'No source videos'}</p>
                      </div>
                    ) : filteredVideos.map(v=>(
                      <button key={v.id} onClick={()=>setSelectedVideo(v)}
                        className={cn('w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all border',selectedVideo?.id===v.id?'border-blue-200 bg-blue-50 text-blue-700':'border-transparent hover:bg-slate-50 text-slate-600')}>
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',selectedVideo?.id===v.id?'bg-blue-100':'bg-slate-100')}>
                          <Film className="w-3.5 h-3.5"/>
                        </div>
                        <span className="text-[10px] font-medium truncate">{v.title}</span>
                      </button>
                    ))}
                  </>
                )}
              </>)}
              {leftTab==='source' && <SourceModePanel config={sourceMode} onChange={setSourceMode}/>}
              {leftTab==='audio' && (
                <div className="px-1 py-2 space-y-3">
                  <p className="text-[9px] text-slate-400">3 audio streams mixed via FFmpeg amix.</p>
                  {[{label:'Main',val:audio.mainVideo,key:'mainVideo' as const,color:'#3b82f6'},{label:'Music',val:audio.backgroundMusic,key:'backgroundMusic' as const,color:'#22c55e'},{label:'Voice',val:audio.voiceNarration,key:'voiceNarration' as const,color:'#a855f7'}].map(s=>(
                    <div key={s.key} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-semibold text-slate-600">{s.label}</span>
                        <span className="text-[10px] font-mono font-bold text-slate-700">{(s.val*100).toFixed(0)}%</span>
                      </div>
                      <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="absolute left-0 top-0 h-full rounded-full" style={{width:`${Math.min((s.val/2)*100,100)}%`,background:s.color}}/>
                        <input type="range" min={0} max={2} step={0.05} value={s.val}
                          onChange={e=>setAudio(prev=>({...prev,[s.key]:+e.target.value}))}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer"/>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {leftTab==='effects' && (
                <div className="px-1 py-2 space-y-4">
                  {/* Color grading */}
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Color · FFmpeg eq</p>
                    {([
                      {label:'Brightness', key:'brightness' as const, min:-1, max:1, step:0.05, defaultVal:0, color:'#f59e0b', fmt:(v:number)=>(v>=0?'+':'')+v.toFixed(2)},
                      {label:'Contrast',   key:'contrast'   as const, min:0,  max:2, step:0.05, defaultVal:1, color:'#6366f1', fmt:(v:number)=>v.toFixed(2)+'x'},
                      {label:'Saturation', key:'saturation' as const, min:0,  max:3, step:0.05, defaultVal:1, color:'#ec4899', fmt:(v:number)=>v.toFixed(2)+'x'},
                    ] as {label:string;key:keyof FxConfig;min:number;max:number;step:number;defaultVal:number;color:string;fmt:(v:number)=>string}[]).map(s=>(
                      <div key={s.key} className="space-y-1 mb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-semibold text-slate-600">{s.label}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono font-bold text-slate-700">{s.fmt(fx[s.key] as number)}</span>
                            {(fx[s.key] as number) !== s.defaultVal && (
                              <button onClick={()=>updateFx({[s.key]:s.defaultVal})} className="text-[8px] text-slate-400 hover:text-red-400 leading-none">↺</button>
                            )}
                          </div>
                        </div>
                        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="absolute top-0 h-full rounded-full transition-all" style={{
                            left: s.key==='brightness' ? `${((fx[s.key] as number)-s.min)/(s.max-s.min)*100}%` : s.key==='contrast'||s.key==='saturation' ? `${(s.defaultVal-s.min)/(s.max-s.min)*100}%` : '0%',
                            width: s.key==='brightness'
                              ? `${Math.abs((fx[s.key] as number))/s.max*50}%`
                              : `${Math.abs(((fx[s.key] as number)-s.defaultVal)/(s.max-s.min))*100}%`,
                            background: s.color
                          }}/>
                          <input type="range" min={s.min} max={s.max} step={s.step} value={fx[s.key] as number}
                            onChange={e=>updateFx({[s.key]:+e.target.value})}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"/>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Speed */}
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Speed · setpts / atempo</p>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-semibold text-slate-600">Playback Speed</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono font-bold text-slate-700">{fx.speed.toFixed(2)}x</span>
                          {fx.speed!==1 && <button onClick={()=>updateFx({speed:1})} className="text-[8px] text-slate-400 hover:text-red-400">↺</button>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[0.5,0.75,1,1.25,1.5,2].map(v=>(
                          <button key={v} onClick={()=>updateFx({speed:v})}
                            className={cn('flex-1 py-1 text-[9px] font-bold rounded border transition-all',
                              fx.speed===v ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300')}>
                            {v}x
                          </button>
                        ))}
                      </div>
                      <p className="text-[8px] text-slate-400">{'<'}1x slow motion · {'>'}1x fast forward</p>
                    </div>
                  </div>

                  {/* Fade */}
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Fade · FFmpeg fade filter</p>
                    <div className="space-y-2">
                      {([
                        {label:'Fade In',  key:'fadeInDur'  as const, icon:'▶'},
                        {label:'Fade Out', key:'fadeOutDur' as const, icon:'◀'},
                      ]).map(f=>(
                        <div key={f.key} className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-500 w-14">{f.icon} {f.label}</span>
                          <input type="number" min={0} max={10} step={0.5} value={fx[f.key]}
                            onChange={e=>updateFx({[f.key]:Math.max(0,+e.target.value)})}
                            className="w-14 h-6 px-1.5 text-[10px] font-mono text-slate-700 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                          <span className="text-[9px] text-slate-400">s</span>
                          {(fx[f.key] as number)>0 && <span className="text-[8px] text-emerald-500 font-bold">ON</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vignette */}
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Effects</p>
                    <button onClick={()=>updateFx({vignette:!fx.vignette})}
                      className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-semibold transition-all',
                        fx.vignette ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
                      <span className="text-sm">◉</span>
                      Vignette
                      <span className={cn('ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded-full',fx.vignette?'bg-white/20 text-white':'bg-slate-100 text-slate-400')}>
                        {fx.vignette?'ON':'OFF'}
                      </span>
                    </button>
                  </div>

                  {/* Reset all */}
                  {JSON.stringify(fx)!==JSON.stringify(DEFAULT_FX) && (
                    <button onClick={()=>setFx(DEFAULT_FX)}
                      className="w-full py-1.5 text-[10px] font-semibold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
                      Reset all FX
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── CENTER: Canvas (news/clip) or Slideshow (ai) ──────────────────── */}
        {workflowMode==='ai' ? (
          /* ── AI GENERATIVE OUTFIT: 2-Phase (Extract + Compose) ─────────── */
          <div className="flex-1 flex flex-col overflow-hidden" style={{background:'#e2e8f0'}}>
            {/* Phase Indicator Bar */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200">
              <div className="flex items-center gap-2">
                {(['extract','compose','results'] as const).map((p, idx)=>(
                  <div key={p} className="flex items-center gap-2">
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                      (p==='extract' && (aiOutfitPhase==='extracting' || aiOutfitPhase==='generating' || aiOutfitPhase==='done')) ||
                      (p==='compose' && (aiOutfitPhase==='generating' || aiOutfitPhase==='done')) ||
                      (p==='results' && aiOutfitPhase==='done')
                        ? 'bg-purple-500 text-white' : 'bg-slate-200 text-slate-500'
                    )}>
                      {p==='extract' ? '1' : p==='compose' ? '2' : '3'}
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 capitalize">{p}</span>
                    {idx < 2 && <div className="w-6 h-px bg-slate-300 mx-1"/>}
                  </div>
                ))}
              </div>
              <div className="flex-1"/>
              {aiOutfitPhase!=='idle' && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500">Phase: <span className="font-bold capitalize">{aiOutfitPhase}</span></span>
                  {(aiExtractionRunning || aiGenerationRunning) && <Loader2 className="w-3 h-3 animate-spin text-purple-500"/>}
                </div>
              )}
            </div>

            {/* Canvas Area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-6" style={{background:'#f1f5f9'}}>
              {aiOutfitPhase==='idle' || !aiExtractedOutfitPath ? (
                /* PHASE 1: EXTRACTION */
                <div className="max-w-md w-full space-y-4">
                  <div className="text-center mb-4">
                    <h2 className="text-2xl font-black text-slate-900 mb-1">Step 1: Extract Outfit</h2>
                    <p className="text-sm text-slate-500">Upload outfit image with background, we'll extract it cleanly</p>
                  </div>

                  {/* Source Image Upload */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-widest mb-2">Outfit Image</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-white/70 hover:bg-slate-50 transition-colors cursor-pointer group"
                      onClick={()=>document.getElementById('ai-source-upload')?.click()}>
                      {aiSourceImagePath ? (
                        <div className="space-y-2">
                          <ImageIcon className="w-8 h-8 text-purple-500 mx-auto"/>
                          <p className="text-[10px] font-bold text-slate-700">{aiSourceImagePath.split('/').pop()}</p>
                          <p className="text-[9px] text-slate-400">Click to change</p>
                        </div>
                      ) : (
                        <div className="space-y-2 group-hover:opacity-70 transition-opacity">
                          <ImageIcon className="w-10 h-10 text-slate-400 mx-auto"/>
                          <p className="text-[11px] font-bold text-slate-600">Click or drag image</p>
                          <p className="text-[9px] text-slate-400">PNG, JPG supported</p>
                        </div>
                      )}
                    </div>
                    <input id="ai-source-upload" type="file" className="hidden" accept="image/*"
                      onChange={e=>{const f=e.target.files?.[0];if(f)setAiSourceImagePath(f.name)}}/>
                  </div>

                  {/* Extract Button */}
                  <button onClick={async()=>{
                    if(!aiSourceImagePath)return toast.error('Upload outfit image first')
                    setAiExtractionRunning(true)
                    setAiOutfitPhase('extracting')
                    try{
                      const res=await fetch('/api/ai/generative-outfit/extract',{
                        method:'POST',
                        headers:{'Content-Type':'application/json'},
                        body:JSON.stringify({sourceImagePath:aiSourceImagePath, runId:aiRunId})
                      })
                      if(!res.body)throw new Error('No response')
                      const reader=res.body.getReader(),dec=new TextDecoder()
                      let buf=''
                      while(true){
                        const {done,value}=await reader.read();if(done)break
                        buf+=dec.decode(value,{stream:true})
                        const parts=buf.split('\n\n');buf=parts.pop()||''
                        for(const part of parts){
                          const line=part.replace(/^data: /,'').trim();if(!line)continue
                          try{const ev=JSON.parse(line);
                            if(ev.type==='extraction-done'){setAiExtractedOutfitPath(ev.imagePath);setAiExtractedPreview(URL.createObjectURL(new Blob([ev.data])))}
                            if(ev.type==='done' && ev.success){setAiOutfitPhase('generating')}
                          }catch{}
                        }
                      }
                    }catch(err){toast.error('Extraction failed: '+String(err))}finally{setAiExtractionRunning(false)}
                  }}
                    disabled={!aiSourceImagePath || aiExtractionRunning}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold text-sm transition-all disabled:opacity-50">
                    {aiExtractionRunning ? (<><Loader2 className="w-4 h-4 inline animate-spin mr-2"/>Extracting...</>) : 'Extract Outfit'}
                  </button>
                </div>
              ) : (
                /* PHASE 2: COMPOSITION */
                <div className="w-full max-w-3xl space-y-4">
                  <div className="text-center mb-4">
                    <h2 className="text-2xl font-black text-slate-900 mb-1">Step 2: Generate Multi-Angle Composites</h2>
                    <p className="text-sm text-slate-500">Upload background, set angle prompts, generate composites</p>
                  </div>

                  {/* 2-Column Layout */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Left: Background Upload */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Background Image</label>
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-white/70 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={()=>document.getElementById('ai-bg-upload')?.click()}>
                        {aiBackgroundImagePath ? (
                          <div className="space-y-1">
                            <ImageIcon className="w-6 h-6 text-purple-500 mx-auto"/>
                            <p className="text-[9px] font-bold text-slate-700">{aiBackgroundImagePath.split('/').pop()}</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <ImageIcon className="w-8 h-8 text-slate-400 mx-auto"/>
                            <p className="text-[10px] font-bold text-slate-600">Click upload</p>
                          </div>
                        )}
                      </div>
                      <input id="ai-bg-upload" type="file" className="hidden" accept="image/*"
                        onChange={e=>{const f=e.target.files?.[0];if(f)setAiBackgroundImagePath(f.name)}}/>
                    </div>

                    {/* Right: Extracted Outfit Preview */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Extracted Outfit</label>
                      <div className="border-2 border-slate-300 rounded-xl p-4 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center h-24">
                        {aiExtractedPreview ? (
                          <img src={aiExtractedPreview} alt="outfit" className="max-h-20 object-contain"/>
                        ) : (
                          <p className="text-[9px] text-slate-400">Outfit preview</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Angle Prompts Manager */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Angle Prompts ({aiAnglePrompts.length})</label>
                    <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
                      {aiAnglePrompts.map((prompt, idx)=>(
                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 group hover:border-purple-300">
                          <span className="text-[10px] font-bold text-slate-400 w-5 text-center">{idx+1}</span>
                          <span className="flex-1 text-[10px] text-slate-600 truncate">{prompt}</span>
                          <button onClick={()=>setAiAnglePrompts(p=>p.filter((_,i)=>i!==idx))}
                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                            <X className="w-3 h-3"/>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <input value={aiAngleInput} onChange={e=>setAiAngleInput(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter' && aiAngleInput.trim()){setAiAnglePrompts(p=>[...p, aiAngleInput.trim()]);setAiAngleInput('')}}}
                        placeholder="Add new angle prompt..."
                        className="flex-1 h-7 px-2 text-[10px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400"/>
                      <button onClick={()=>{if(aiAngleInput.trim()){setAiAnglePrompts(p=>[...p, aiAngleInput.trim()]);setAiAngleInput('')}}}
                        className="w-7 h-7 rounded-lg bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center transition-colors">
                        <Plus className="w-3 h-3"/>
                      </button>
                    </div>
                  </div>

                  {/* Start Generation */}
                  <button onClick={async()=>{
                    if(!aiBackgroundImagePath || !aiExtractedOutfitPath || aiAnglePrompts.length===0)
                      return toast.error('Complete setup: background + outfit + angle prompts')
                    setAiGenerationRunning(true)
                    setAiGeneratedImages([])
                    try{
                      const res=await fetch('/api/ai/generative-outfit/compose',{
                        method:'POST',
                        headers:{'Content-Type':'application/json'},
                        body:JSON.stringify({
                          backgroundImagePath:aiBackgroundImagePath,
                          extractedOutfitPath:aiExtractedOutfitPath,
                          anglePrompts:aiAnglePrompts,
                          aspectRatio:aiAspectRatio,
                          maxAttemptsPerAngle:aiMaxAttempts,
                          enhancePrompts:aiEnhancePrompts,
                          styleHint:aiStyleHint,
                          runId:aiRunId
                        })
                      })
                      if(!res.body)throw new Error('No response')
                      const reader=res.body.getReader(),dec=new TextDecoder()
                      let buf=''
                      while(true){
                        const {done,value}=await reader.read();if(done)break
                        buf+=dec.decode(value,{stream:true})
                        const parts=buf.split('\n\n');buf=parts.pop()||''
                        for(const part of parts){
                          const line=part.replace(/^data: /,'').trim();if(!line)continue
                          try{const ev=JSON.parse(line);
                            if(ev.type==='progress')setAiCurrentAngleIndex(ev.angleIndex)
                            if(ev.type==='image-ready'){setAiGeneratedImages(p=>[...p,{id:`img_${Date.now()}_${ev.imageIndex}`,path:ev.imagePath,angle:ev.anglePrompt,timestamp:Date.now()}])}
                            if(ev.type==='done'){if(ev.success){setAiOutfitPhase('done');toast.success('Generation complete!')}else{toast.error(ev.error)}}
                          }catch{}
                        }
                      }
                    }catch(err){toast.error('Generation failed: '+String(err))}finally{setAiGenerationRunning(false)}
                  }}
                    disabled={!aiBackgroundImagePath || !aiExtractedOutfitPath || aiAnglePrompts.length===0 || aiGenerationRunning}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold text-sm transition-all disabled:opacity-50">
                    {aiGenerationRunning ? (
                      <><Loader2 className="w-4 h-4 inline animate-spin mr-2"/>Generating {aiCurrentAngleIndex + 1}/{aiAnglePrompts.length}...</>
                    ) : (
                      'Start Generation'
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Generated Images Gallery (bottom section) */}
            {aiGeneratedImages.length > 0 && (
              <div className="shrink-0 max-h-40 bg-white border-t border-slate-200 p-3 overflow-y-auto">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Generated Images ({aiGeneratedImages.length}/{aiAnglePrompts.length})</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {aiGeneratedImages.map((img, idx)=>(
                    <div key={img.id} className="shrink-0 flex flex-col items-center gap-1">
                      <div className="w-16 h-28 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 flex items-center justify-center group relative">
                        {img.path ? (
                          <img src={`/api/file?path=${encodeURIComponent(img.path)}`} alt="" className="w-full h-full object-cover"/>
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400"/>
                        )}
                        <button onClick={()=>setAiGeneratedImages(p=>p.filter(it=>it.id!==img.id))}
                          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center hidden group-hover:flex transition-all">
                          <X className="w-2.5 h-2.5"/>
                        </button>
                      </div>
                      <span className="text-[8px] text-slate-500 text-center truncate w-16">{(idx+1).toString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
        /* ── CANVAS (news / clip) ────────────────────────────────────────── */
        <div className="flex-1 flex flex-col overflow-hidden" style={{background:'#e2e8f0'}}>
          <div className="flex-1 overflow-auto flex items-start justify-center p-5">
            <div className="flex flex-col items-center gap-2">

              {/* Floating toolbar pill above canvas */}
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-md text-[10px] backdrop-blur-sm">
                <select
                  value={Math.round(zoom*54)}
                  onChange={e=>setZoom(+e.target.value/54)}
                  className="text-[10px] font-mono font-bold text-slate-700 bg-transparent border-none outline-none cursor-pointer pr-1">
                  {[27,40,54,67,81,108].map(z=><option key={z} value={z}>{z}%</option>)}
                </select>
                <div className="w-px h-3 bg-slate-300"/>
                <button onClick={()=>setZoom(z=>Math.max(0.4,+(z-0.15).toFixed(2)))} className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors"><Undo2 className="w-3 h-3"/></button>
                <button onClick={()=>setZoom(z=>Math.min(2.5,+(z+0.15).toFixed(2)))} className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors"><Redo2 className="w-3 h-3"/></button>
                <div className="w-px h-3 bg-slate-300"/>
                <button className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors" title="Crop"><Crop className="w-3 h-3"/></button>
                <span className="text-[9px] font-bold text-slate-500 px-1 py-0.5 rounded bg-slate-100 font-mono border border-slate-200">9:16</span>
              </div>

              {/* Coords bar */}
              <div className="flex items-center gap-2.5 px-3 py-1 rounded-lg bg-white/90 border border-slate-200 shadow-sm text-[9px] font-mono">
                <span className="text-blue-600">Tpl <strong>{layout.templateX},{layout.templateY}</strong> {layout.templateW}×{tplRH}</span>
                <span className="text-slate-300">|</span>
                <span className="text-sky-600">Logo <strong>{layout.logoX},{layout.logoY}</strong> {layout.logoW}×{layout.logoH}</span>
                <span className="text-slate-300">|</span>
                <span className="text-purple-600">Title <strong>{layout.titleX},{layout.titleY}</strong> {layout.titleDuration}s</span>
              </div>

              <Canvas layout={layout} onLayout={onLayout} blurZones={blurZones} onBlurZones={setBlurZones}
                videoUrl={selectedVideo?.path?`/api/file?path=${encodeURIComponent(selectedVideo.path)}`:undefined}
                activeElement={activeElement} setActiveElement={setActiveElement} layers={layers} zoom={zoom}/>

              {/* Legend */}
              <div className="flex items-center gap-4 text-[9px] font-medium bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200">
                {[{c:'#2563eb',l:'Template'},{c:'#f59e0b',l:'Blur'},{c:'#7c3aed',l:'Title'},{c:'#0ea5e9',l:'Logo'}].map(x=>(
                  <span key={x.l} className="flex items-center gap-1 text-slate-500">
                    <span className="w-2 h-2 rounded-sm inline-block border-2" style={{borderColor:x.c}}/>
                    {x.l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── TIMELINE ────────────────────────────────────────────────────── */}
          <div className="shrink-0">
            <Timeline
              sourceMode={sourceMode} onSourceModeChange={setSourceMode}
              layout={layout} onLayout={onLayout}
              totalDuration={totalDuration} onTotalDurationChange={setTotalDuration}
              renderLogs={renderLogs} rendering={rendering} showLogs={showLogs}
              voiceDurationSec={voiceDurationSec}
            />
            {/* Log toggle */}
            <div className="flex items-center justify-end gap-2 px-3 py-1 border-t border-slate-200 bg-slate-50">
              <button onClick={()=>setShowLogs(l=>!l)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors',showLogs?'bg-slate-800 text-slate-200':'text-slate-400 hover:text-slate-600 hover:bg-slate-200')}>
                <Hash className="w-3 h-3"/>{showLogs?'Hide Logs':'Show Logs'}
                {rendering && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-0.5"/>}
              </button>
            </div>
          </div>
        </div>
        )} {/* end canvas / ai ternary */}

        {/* ── RIGHT: Properties + Layers ───────────────────────────────────── */}
        <div className="w-64 shrink-0 flex flex-col overflow-hidden bg-white border-l border-slate-200">
          {/* Tab switcher */}
          <div className="flex border-b border-slate-200 shrink-0">
            {workflowMode==='ai' ? (
              [{id:'properties' as const,label:'SLIDESHOW'},{id:'layers' as const,label:'FX'}].map(t=>(
                <button key={t.id} onClick={()=>setRightTab(t.id)}
                  className={cn('flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-colors',rightTab===t.id?'border-purple-500 text-purple-600':'border-transparent text-slate-400 hover:text-slate-600')}>
                  {t.label}
                </button>
              ))
            ) : workflowMode==='clip' ? (
              [{id:'properties' as const,label:'CLIP'},{id:'layers' as const,label:'LAYERS'}].map(t=>(
                <button key={t.id} onClick={()=>setRightTab(t.id)}
                  className={cn('flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-colors',rightTab===t.id?'border-orange-500 text-orange-600':'border-transparent text-slate-400 hover:text-slate-600')}>
                  {t.label}
                </button>
              ))
            ) : (
              [{id:'properties' as const,label:'PROPERTIES'},{id:'layers' as const,label:'LAYERS'}].map(t=>(
                <button key={t.id} onClick={()=>setRightTab(t.id)}
                  className={cn('flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-colors',rightTab===t.id?'border-blue-500 text-blue-600':'border-transparent text-slate-400 hover:text-slate-600')}>
                  {t.label}
                </button>
              ))
            )}
          </div>

          {workflowMode==='ai' ? (
            /* ── AI MODE right panel (Generative Outfit) ───────────────────── */
            rightTab==='properties' ? (
              /* COMPOSITION settings */
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Composition Settings</p>
                  <div className="space-y-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-semibold text-slate-600">Aspect Ratio</span>
                      </div>
                      <select value={aiAspectRatio} onChange={e=>setAiAspectRatio(e.target.value as any)}
                        className="w-full text-[10px] px-2 py-1 rounded-lg border border-slate-200 bg-white">
                        <option value="9:16">9:16 (TikTok)</option>
                        <option value="16:9">16:9 (YouTube)</option>
                        <option value="1:1">1:1 (Instagram)</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-semibold text-slate-600">Max Attempts</span>
                        <span className="text-[10px] font-bold text-slate-700">{aiMaxAttempts}</span>
                      </div>
                      <input type="range" min={1} max={3} value={aiMaxAttempts} onChange={e=>setAiMaxAttempts(+e.target.value)}
                        className="w-full h-2 bg-slate-200 rounded-full"/>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={aiEnhancePrompts} onChange={e=>setAiEnhancePrompts(e.target.checked)}
                        className="w-4 h-4 rounded border border-slate-300"/>
                      <span className="text-[10px] font-medium text-slate-600">Auto-enhance prompts via Gemini Flash</span>
                    </label>
                    <div>
                      <label className="text-[9px] font-semibold text-slate-600 block mb-1">Style Hint (optional)</label>
                      <input value={aiStyleHint} onChange={e=>setAiStyleHint(e.target.value)}
                        placeholder="e.g., professional photography"
                        className="w-full text-[10px] px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"/>
                    </div>
                  </div>
                </div>
                <button onClick={runRender} disabled={aiGenerationRunning || aiGeneratedImages.length===0}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 shadow-md"
                  style={{background:'linear-gradient(135deg,#a855f7,#9333ea)'}}>
                  {aiGenerationRunning?<Loader2 className="w-4 h-4 animate-spin"/>:<Download className="w-4 h-4"/>}
                  EXPORT RESULTS
                </button>
              </div>
            ) : (
              /* RESULTS gallery */
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Generated Images ({aiGeneratedImages.length})</p>
                  {aiGeneratedImages.length===0 ? (
                    <div className="flex flex-col items-center justify-center h-20 text-center rounded-xl border-2 border-dashed border-slate-200 p-3">
                      <ImageIcon className="w-5 h-5 text-slate-300 mb-1"/>
                      <p className="text-[9px] text-slate-400">No images generated yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {aiGeneratedImages.map((img, idx)=>(
                        <div key={img.id} className="group relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center h-32">
                          {img.path ? (
                            <img src={`/api/file?path=${encodeURIComponent(img.path)}`} alt={img.angle} className="w-full h-full object-cover"/>
                          ) : (
                            <Loader2 className="w-5 h-5 animate-spin text-slate-400"/>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex flex-col items-center justify-center opacity-0 group-hover:opacity-100">
                            <button onClick={()=>window.open(`/api/file?path=${encodeURIComponent(img.path)}`, '_blank')}
                              className="text-white text-sm font-bold">↓</button>
                          </div>
                          <button onClick={()=>setAiGeneratedImages(p=>p.filter(it=>it.id!==img.id))}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white items-center justify-center hidden group-hover:flex transition-all">
                            <X className="w-3 h-3"/>
                          </button>
                          <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[8px] font-bold px-1.5 py-0.5 rounded truncate max-w-[120px]">
                            {img.angle}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {aiGeneratedImages.length>0 && (
                  <div className="space-y-2">
                    <button onClick={()=>{/* Download all as ZIP */}}
                      className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-colors">
                      📥 Download All (ZIP)
                    </button>
                    <button onClick={()=>{/* Compile to video */}}
                      className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-colors">
                      🎬 Compile to Video
                    </button>
                    <button onClick={()=>setAiGeneratedImages([])}
                      className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-colors">
                      🗑️ Delete All
                    </button>
                  </div>
                )}
              </div>
            )
          ) : workflowMode==='clip' ? (
            /* ── CLIP MODE right panel ────────────────────────────────────── */
            rightTab==='properties' ? (
              /* CLIP settings */
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Render Options</p>
                  <div className="space-y-2">
                    <button onClick={()=>setClipAddFrame(v=>!v)}
                      className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all',
                        clipAddFrame?'bg-orange-50 border-orange-200':'bg-white border-slate-200 hover:border-slate-300')}>
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',clipAddFrame?'bg-orange-100':'bg-slate-100')}>
                        <Film className={cn('w-4 h-4',clipAddFrame?'text-orange-600':'text-slate-400')}/>
                      </div>
                      <div className="flex-1">
                        <p className={cn('text-[11px] font-semibold',clipAddFrame?'text-orange-700':'text-slate-700')}>Frame Template</p>
                        <p className="text-[9px] text-slate-400">Overlay branded frame on clip</p>
                      </div>
                      <div className={cn('w-8 h-4 rounded-full transition-all shrink-0',clipAddFrame?'bg-orange-500':'bg-slate-200')}>
                        <div className={cn('w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all mt-0.5',clipAddFrame?'translate-x-4':'translate-x-0.5')}/>
                      </div>
                    </button>
                    <button onClick={()=>setClipAddLogo(v=>!v)}
                      className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all',
                        clipAddLogo?'bg-orange-50 border-orange-200':'bg-white border-slate-200 hover:border-slate-300')}>
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',clipAddLogo?'bg-orange-100':'bg-slate-100')}>
                        <ImageIcon className={cn('w-4 h-4',clipAddLogo?'text-orange-600':'text-slate-400')}/>
                      </div>
                      <div className="flex-1">
                        <p className={cn('text-[11px] font-semibold',clipAddLogo?'text-orange-700':'text-slate-700')}>Logo Watermark</p>
                        <p className="text-[9px] text-slate-400">Add logo to each clip</p>
                      </div>
                      <div className={cn('w-8 h-4 rounded-full transition-all shrink-0',clipAddLogo?'bg-orange-500':'bg-slate-200')}>
                        <div className={cn('w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all mt-0.5',clipAddLogo?'translate-x-4':'translate-x-0.5')}/>
                      </div>
                    </button>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Split into Clips</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-700">Number of clips</span>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>setClipSplitCount(v=>Math.max(1,v-1))} className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold flex items-center justify-center transition-colors">−</button>
                        <span className="text-sm font-black text-slate-700 w-6 text-center">{clipSplitCount}</span>
                        <button onClick={()=>setClipSplitCount(v=>Math.min(20,v+1))} className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold flex items-center justify-center transition-colors">+</button>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-400 px-1">Each output clip will be processed separately and queued for upload.</p>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 space-y-1.5">
                    <div className="flex justify-between text-[10px]"><span className="text-orange-600">Frame template</span><span className={cn('font-bold',clipAddFrame?'text-orange-700':'text-slate-400')}>{clipAddFrame?'ON':'OFF'}</span></div>
                    <div className="flex justify-between text-[10px]"><span className="text-orange-600">Logo</span><span className={cn('font-bold',clipAddLogo?'text-orange-700':'text-slate-400')}>{clipAddLogo?'ON':'OFF'}</span></div>
                    <div className="flex justify-between text-[10px]"><span className="text-orange-600">Output clips</span><span className="font-bold text-orange-700">{clipSplitCount}</span></div>
                  </div>
                  <button onClick={runRender} disabled={rendering}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 shadow-md"
                    style={{background:'linear-gradient(135deg,#ea580c,#c2410c)'}}>
                    {rendering?<Loader2 className="w-4 h-4 animate-spin"/>:<Scissors className="w-4 h-4"/>}
                    RENDER CLIPS
                  </button>
                </div>
              </div>
            ) : (
              /* Clip mode — Layers panel */
              <div className="flex-1 overflow-y-auto">
                <div className="p-2 space-y-1">
                  {LAYER_DEFS.map(l=>(
                    <div key={l.k} className={cn('flex items-center gap-2 px-2 py-2 rounded-xl border cursor-pointer transition-all relative overflow-hidden',
                      activeElement===l.k||activeElement?.includes(l.k)?'border-orange-200 bg-orange-50':'border-transparent hover:border-slate-200 hover:bg-slate-50')}>
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l" style={{background:l.rowColor}}/>
                      <GripVertical className="w-3 h-3 text-slate-300 shrink-0 ml-0.5"/>
                      <div className="shrink-0 w-8 h-5 rounded text-[8px] font-black flex items-center justify-center" style={{background:l.tagBg,color:l.tagText}}>{l.tag}</div>
                      <span className="flex-1 text-[11px] font-medium text-slate-600 truncate">{l.label}</span>
                      <button onClick={()=>toggleLayer(l.k)} className="shrink-0 text-slate-300 hover:text-slate-600 transition-colors">
                        {layers[l.k] ? <Eye className="w-3.5 h-3.5"/> : <EyeOff className="w-3.5 h-3.5 text-slate-200"/>}
                      </button>
                      <button onClick={()=>toggleLock(l.k)} className={cn('shrink-0 transition-colors',lockedLayers.has(l.k)?'text-amber-500 hover:text-amber-700':'text-slate-200 hover:text-slate-500')}>
                        {lockedLayers.has(l.k) ? <Lock className="w-3 h-3"/> : <Unlock className="w-3 h-3"/>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            /* ── NEWS MODE (existing full panels) ─────────────────────────── */
            rightTab==='layers' ? (
              <div className="flex-1 overflow-y-auto">
                {/* Layer rows with colored left indicators */}
                <div className="p-2 space-y-1">
                  {LAYER_DEFS.map(l=>(
                    <div key={l.k} className={cn('flex items-center gap-2 px-2 py-2 rounded-xl border cursor-pointer transition-all relative overflow-hidden',
                      activeElement===l.k||activeElement?.includes(l.k)?'border-blue-200 bg-blue-50':'border-transparent hover:border-slate-200 hover:bg-slate-50')}>
                      {/* Colored row indicator */}
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l" style={{background:l.rowColor}}/>
                      <GripVertical className="w-3 h-3 text-slate-300 shrink-0 ml-0.5"/>
                      <div className="shrink-0 w-8 h-5 rounded text-[8px] font-black flex items-center justify-center" style={{background:l.tagBg,color:l.tagText}}>{l.tag}</div>
                      <span className="flex-1 text-[11px] font-medium text-slate-600 truncate">{l.label}</span>
                      {/* Eye toggle */}
                      <button onClick={()=>toggleLayer(l.k)} className="shrink-0 text-slate-300 hover:text-slate-600 transition-colors">
                        {layers[l.k] ? <Eye className="w-3.5 h-3.5"/> : <EyeOff className="w-3.5 h-3.5 text-slate-200"/>}
                      </button>
                      {/* Lock toggle (functional) */}
                      <button onClick={()=>toggleLock(l.k)} className={cn('shrink-0 transition-colors',lockedLayers.has(l.k)?'text-amber-500 hover:text-amber-700':'text-slate-200 hover:text-slate-500')}>
                        {lockedLayers.has(l.k) ? <Lock className="w-3 h-3"/> : <Unlock className="w-3 h-3"/>}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Master Mixer with gradient faders */}
                <div className="border-t border-slate-100 mt-1">
                  <div className="px-3 py-2 flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5 text-slate-400"/>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Mixer</span>
                  </div>
                  <div className="flex items-end justify-center gap-5 px-3 pb-4 pt-1">
                    <VolumeBar label="Main" value={audio.mainVideo} onChange={v=>setAudio(p=>({...p,mainVideo:v}))} gradientFrom="#6366f1" gradientTo="#8b5cf6"/>
                    <VolumeBar label="Music" value={audio.backgroundMusic} onChange={v=>setAudio(p=>({...p,backgroundMusic:v}))} gradientFrom="#10b981" gradientTo="#14b8a6"/>
                    <VolumeBar label="Voice" value={audio.voiceNarration} onChange={v=>setAudio(p=>({...p,voiceNarration:v}))} gradientFrom="#ec4899" gradientTo="#f43f5e"/>
                  </div>
                  <div className="px-3 pb-3">
                    <button onClick={runRender} disabled={rendering}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 shadow-md"
                      style={{background:'linear-gradient(135deg,#2563eb,#4338ca)'}}>
                      {rendering?<Loader2 className="w-4 h-4 animate-spin"/>:<Download className="w-4 h-4"/>}
                      EXPORT PROJECT
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* News Properties panel */
              <div className="flex flex-col overflow-hidden flex-1">
                {/* Contextual inspector — shown when element is selected */}
                {activeElement && inspectorLabel && (
                  <div className="shrink-0 px-3 py-2.5 border-b border-slate-100 bg-slate-50 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"/>
                      <span className="text-[11px] font-bold text-slate-700">{inspectorLabel}</span>
                    </div>
                    {inspectorX !== null && inspectorY !== null && (
                      <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500">
                        <span className="bg-slate-200 px-1.5 py-0.5 rounded">X <strong className="text-slate-700">{inspectorX}</strong></span>
                        <span className="bg-slate-200 px-1.5 py-0.5 rounded">Y <strong className="text-slate-700">{inspectorY}</strong></span>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">Opacity</span>
                        <span className="text-[9px] font-mono text-slate-700">100%</span>
                      </div>
                      <div className="relative h-1.5 bg-slate-200 rounded-full">
                        <div className="absolute left-0 top-0 h-full bg-blue-500 rounded-full" style={{width:'100%'}}/>
                        <input type="range" min={0} max={100} defaultValue={100} readOnly
                          className="absolute inset-0 w-full opacity-0 cursor-default"/>
                      </div>
                    </div>
                  </div>
                )}

                {/* Properties sub-tabs */}
                <div className="flex border-b border-slate-100 shrink-0 overflow-x-auto">
                  {([{id:'source' as const,label:'Source'},{id:'presets' as const,label:'Presets'},{id:'layout' as const,label:'Layout'},{id:'blur' as const,label:'Blur'}]).map(t=>(
                    <button key={t.id} onClick={()=>setPropTab(t.id)}
                      className={cn('flex-1 py-2 text-[9px] font-bold uppercase tracking-wide border-b-2 whitespace-nowrap transition-colors',propTab===t.id?'border-blue-500 text-blue-600':'border-transparent text-slate-400 hover:text-slate-600')}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">

                  {/* Source */}
                  {propTab==='source' && (
                    <div className="space-y-3">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Active Mode</p>
                        {(() => {
                          const m=SOURCE_MODES.find(x=>x.id===sourceMode.mode)||SOURCE_MODES[0]
                          return (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:m.color+'15'}}>
                                <m.icon className="w-4 h-4" style={{color:m.color}}/>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-700">{m.label}</p>
                                <p className="text-[9px] text-slate-400 leading-tight">{m.desc}</p>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                      <SourceModePanel config={sourceMode} onChange={setSourceMode}/>
                    </div>
                  )}

                  {/* Presets */}
                  {propTab==='presets' && (<>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-slate-500">Apply preset để load layout + audio.</p>
                      <button onClick={saveAsPreset} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"><Plus className="w-3 h-3"/>Save</button>
                    </div>
                    <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Built-in</p>
                    {BUILTIN_PRESETS.map(p=><PresetCard key={p.id} preset={p} isActive={activePresetId===p.id} onApply={()=>applyPreset(p)} onDuplicate={()=>duplicatePreset(p)}/>)}
                    {userPresets.length>0&&(<>
                      <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest pt-1">My Presets</p>
                      {userPresets.map(p=><PresetCard key={p.id} preset={p} isActive={activePresetId===p.id} onApply={()=>applyPreset(p)} onDuplicate={()=>duplicatePreset(p)} onDelete={()=>deleteUserPreset(p.id)} onRename={n=>renameUserPreset(p.id,n)}/>)}
                    </>)}
                  </>)}

                  {/* Layout */}
                  {propTab==='layout' && (<>
                    <Section label="Template Video" active={activeSection==='template'} color="#2563eb" icon={Film}>
                      <p className="text-[9px] text-slate-400">Kéo top-bar di chuyển, kéo góc/cạnh resize.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <NumField label="X" value={layout.templateX} onChange={v=>onLayout({templateX:v})}/>
                        <NumField label="Y" value={layout.templateY} onChange={v=>onLayout({templateY:v})} max={REAL_H}/>
                        <NumField label="Width" value={layout.templateW} onChange={v=>onLayout({templateW:v})} min={80} max={REAL_W}/>
                        <NumField label="Height" value={layout.templateH} onChange={v=>onLayout({templateH:v})} min={-1} max={REAL_H} hint="-1=auto"/>
                      </div>
                      {/* Scale slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">Scale</span>
                          <span className="text-[9px] font-mono text-slate-700">{Math.round((layout.templateW/REAL_W)*100)}%</span>
                        </div>
                        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="absolute left-0 top-0 h-full bg-blue-400 rounded-full" style={{width:`${(layout.templateW/REAL_W)*100}%`}}/>
                          <input type="range" min={80} max={REAL_W} step={10} value={layout.templateW}
                            onChange={e=>onLayout({templateW:+e.target.value})}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"/>
                        </div>
                      </div>
                      <div className="text-[9px] text-blue-600 bg-blue-50 rounded-lg px-2 py-1.5 border border-blue-100">
                        Rendered: {layout.templateW}×{tplRH}px
                      </div>
                      <NumField label="Main video skip (sequential)" value={layout.mainVideoSkip} onChange={v=>onLayout({mainVideoSkip:v})} min={0} max={600} unit="s"/>
                    </Section>
                    <Section label="Logo" active={activeSection==='logo'} color="#0ea5e9" icon={ImageIcon}>
                      <div className="grid grid-cols-2 gap-2">
                        <NumField label="X" value={layout.logoX} onChange={v=>onLayout({logoX:v})} max={REAL_W}/>
                        <NumField label="Y" value={layout.logoY} onChange={v=>onLayout({logoY:v})} max={REAL_H}/>
                        <NumField label="W" value={layout.logoW} onChange={v=>onLayout({logoW:v})} min={10} max={REAL_W}/>
                        <NumField label="H" value={layout.logoH} onChange={v=>onLayout({logoH:v})} min={5} max={REAL_H}/>
                      </div>
                      {/* Scale slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">Scale</span>
                          <span className="text-[9px] font-mono text-slate-700">{Math.round((layout.logoW/REAL_W)*100)}%</span>
                        </div>
                        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="absolute left-0 top-0 h-full bg-sky-400 rounded-full" style={{width:`${(layout.logoW/REAL_W)*100}%`}}/>
                          <input type="range" min={10} max={600} step={5} value={layout.logoW}
                            onChange={e=>onLayout({logoW:+e.target.value})}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"/>
                        </div>
                      </div>
                    </Section>
                    <Section label="Title Overlay" active={activeSection==='title'} color="#7c3aed" icon={Type}>
                      <div className="grid grid-cols-2 gap-2">
                        <NumField label="X" value={layout.titleX} onChange={v=>onLayout({titleX:v})} min={-REAL_W} max={REAL_W}/>
                        <NumField label="Y" value={layout.titleY} onChange={v=>onLayout({titleY:v})} max={REAL_H}/>
                        <NumField label="W" value={layout.titleW} onChange={v=>onLayout({titleW:v})} min={100} max={REAL_W}/>
                        <NumField label="H" value={layout.titleH} onChange={v=>onLayout({titleH:v})} min={20} max={800}/>
                        <NumField label="Duration" value={layout.titleDuration} onChange={v=>onLayout({titleDuration:v})} min={1} max={60} unit="s" hint="Giây hiển thị"/>
                      </div>
                    </Section>
                  </>)}

                  {/* Blur */}
                  {propTab==='blur' && (<>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-slate-500">Blur zones để che watermark.</p>
                      <button onClick={addBlurZone} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"><Plus className="w-3 h-3"/>Add</button>
                    </div>
                    {blurZones.map(z=>{
                      const bzKey:ActiveEl=`blur-${z.id}`,isA=activeElement===bzKey
                      return (
                        <div key={z.id} className={cn('rounded-xl border p-3 space-y-2 cursor-pointer transition-all',isA?'border-amber-300 bg-amber-50':'border-slate-200 bg-white hover:border-slate-300')} onClick={()=>setActiveElement(bzKey)}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-sm bg-amber-400 shrink-0"/>
                            <input value={z.label} onChange={e=>updateBlurZone(z.id,{label:e.target.value})}
                              className="flex-1 bg-transparent text-[11px] font-semibold text-slate-700 focus:outline-none"
                              onClick={e=>e.stopPropagation()}/>
                            <span className="text-[9px] text-slate-400 font-mono">σ={z.sigma}</span>
                            {blurZones.length>1&&<button onClick={e=>{e.stopPropagation();removeBlurZone(z.id)}} className="text-slate-300 hover:text-red-500 transition-colors p-0.5"><Trash2 className="w-3 h-3"/></button>}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <NumField label="X" value={z.x} onChange={v=>updateBlurZone(z.id,{x:v})}/>
                            <NumField label="Y" value={z.y} onChange={v=>updateBlurZone(z.id,{y:v})}/>
                            <NumField label="W" value={z.w} onChange={v=>updateBlurZone(z.id,{w:v})} min={10}/>
                            <NumField label="H" value={z.h} onChange={v=>updateBlurZone(z.id,{h:v})} min={5}/>
                          </div>
                          <NumField label="Blur strength (sigma)" value={z.sigma} onChange={v=>updateBlurZone(z.id,{sigma:v})} min={1} max={100} unit=""/>
                        </div>
                      )
                    })}
                  </>)}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
