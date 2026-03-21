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
      {/* Subtle grid */}
      <div className="absolute inset-0 pointer-events-none" style={{opacity:0.03,backgroundImage:'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',backgroundSize:`${CW/9}px ${CH/16}px`}}/>
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
          {/* Blur zones inside template */}
          {layers.blurZones && blurZones.map(z=>{
            const bzKey:ActiveEl=`blur-${z.id}`,isA=activeElement===bzKey
            const bScale=tplCW/layout.templateW
            const bx=z.x*bScale,by=z.y*bScale,bw=Math.max(4,z.w*bScale),bh=Math.max(3,z.h*bScale)
            return <div key={z.id}
              className={cn('absolute border border-dashed cursor-move',isA?'border-orange-400 bg-orange-400/25 z-20':'border-orange-400/50 bg-orange-400/10 hover:bg-orange-400/20 z-10')}
              style={{left:bx,top:by,width:bw,height:bh}}
              onMouseDown={e=>startMove(e,bzKey,()=>[z.x,z.y],(nx,ny)=>onBlurZones(blurZones.map(b=>b.id===z.id?{...b,x:nx,y:ny}:b)))}
              onClick={e=>{e.stopPropagation();setActiveElement(bzKey)}}>
              <div className="absolute inset-0 pointer-events-none" style={{backdropFilter:'blur(3px)',WebkitBackdropFilter:'blur(3px)'}}/>
              <span className="absolute top-0 left-0.5 text-orange-300 font-bold pointer-events-none leading-none" style={{fontSize:Math.max(5,bw*0.2)}}>{z.label}</span>
              {isA && <ResizeHandles w={bw} h={bh} onHandle={(e,h)=>startResize(e,h,{x:z.x,y:z.y,w:z.w,h:z.h},b=>onBlurZones(blurZones.map(bl=>bl.id===z.id?{...bl,...b}:bl)),10,5)}/>}
            </div>
          })}
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
function Timeline({ sourceMode, onSourceModeChange, layout, onLayout, totalDuration=160, renderLogs, rendering, showLogs }:{
  sourceMode: SourceModeConfig; onSourceModeChange: (c: SourceModeConfig) => void
  layout: Layout; onLayout: (l: Partial<Layout>) => void
  totalDuration?: number
  renderLogs:{msg:string;level:string}[]; rendering:boolean; showLogs:boolean
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
  // Title overlay: startPct=0, duration=titleDuration
  const titleStartPct = 0
  const titleWidthPct = clampPct(secToPct(layout.titleDuration))

  // ── playhead click on ruler ───────────────────────────────────────────────
  const handleRulerClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pct = ((e.clientX - rect.left) / rect.width) * 100
    setPlayheadPct(clampPct(pct))
  }

  const TRACKS = [
    { id:'overlays', label:'OVERLAYS', height:26, rowBg:'#fafafa' },
    { id:'video1',   label:'VIDEO 1',  height:32, rowBg:'#f0f7ff' },
    { id:'audio1',   label:'AUDIO 1',  height:22, rowBg:'#fdfaff' },
    { id:'voice',    label:'VOICEOVER',height:22, rowBg:'#fff5fa' },
  ]
  const ticks = Array.from({length:13},(_,i)=>({ label:formatTime(totalDuration*i/12), pct:i/12*100 }))

  return (
    <div className="flex flex-col" style={{background:'#f8fafc',borderTop:'1px solid #e2e8f0'}}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 h-8 border-b border-slate-200 shrink-0" style={{background:'#f1f5f9'}}>
        <div className="flex items-center gap-1.5">
          <Scissors className="w-3.5 h-3.5 text-slate-400"/>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Timeline</span>
          <span className="text-[10px] text-violet-500 font-medium ml-1 capitalize">· {mode.replace(/_/g,' ')}</span>
        </div>
        {rendering && <div className="flex items-center gap-1.5 ml-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/><span className="text-[10px] text-green-600 font-medium">Rendering...</span></div>}
        <div className="flex-1"/>
        {/* Timeline zoom */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-200/60">
          <button onClick={()=>setTlZoom(z=>Math.max(0.5,+(z-0.25).toFixed(2)))} className="text-slate-500 hover:text-slate-800"><ZoomOut className="w-3.5 h-3.5"/></button>
          <div className="relative w-20 h-1.5 bg-slate-300 rounded-full cursor-pointer" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setTlZoom(+(0.5+(e.clientX-r.left)/r.width*4).toFixed(2))}}>
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
        <div className="flex overflow-x-auto" style={{minHeight:116}}>
          {/* Track labels */}
          <div className="shrink-0 flex flex-col border-r border-slate-200 z-10" style={{width:90,background:'#f1f5f9',position:'sticky',left:0}}>
            <div className="border-b border-slate-200" style={{height:20}}/>
            {TRACKS.map(t=>(
              <div key={t.id} className="flex items-center px-2 gap-1.5 border-b border-slate-100" style={{height:t.height,background:'#f1f5f9'}}>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide leading-none">{t.label}</span>
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

      {/* Tooltip: show selected clip info */}
      {activeClip && !showLogs && (
        <div className="flex items-center gap-3 px-3 py-1 border-t border-slate-100 bg-white text-[9px] text-slate-500 font-mono">
          <span className="font-bold text-blue-600">{activeClip}</span>
          {activeClip==='title-overlay' && <span>duration: {layout.titleDuration}s · drag right edge to resize</span>}
          {activeClip.startsWith('rc') && <span>random clip · position auto-generated at render</span>}
          {activeClip==='cr' && <span>start: {sourceMode.customRange.startSec}s · end: {sourceMode.customRange.endSec}s · drag to move, drag right edge to resize</span>}
          {activeClip.startsWith('mc') && (() => { const i=+activeClip.slice(2); const c=sourceMode.multiClip.clips[i]; return c?<span>start: {c.startSec}s · dur: {c.durationSec}s · drag to move, drag right edge to resize</span>:null })()}
          {activeClip==='skip' && <span>skip: {sourceMode.sequential.skipSec}s · drag right edge to adjust</span>}
          {activeClip==='fn' && <span>first N: {sourceMode.firstN.durationSec}s · drag right edge to adjust</span>}
          <span className="text-slate-300">|</span>
          <button className="text-slate-400 hover:text-slate-700" onClick={()=>setActiveClip(null)}>deselect ×</button>
        </div>
      )}
    </div>
  )
}

function formatTime(sec: number) {
  const m=Math.floor(sec/60), s=Math.round(sec%60)
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// ─── NumField (light mode) ────────────────────────────────────────────────────
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

// ─── VolumeBar (like master mixer fader) ─────────────────────────────────────
function VolumeBar({ label, value, onChange, color }:{
  label:string; value:number; onChange:(v:number)=>void; color:string
}) {
  const pct = Math.min((value/2)*100,100)
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-8 h-24 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
        <div className="absolute bottom-0 left-0 right-0 rounded-full transition-all" style={{height:`${pct}%`,background:color}}/>
        <input type="range" min={0} max={2} step={0.05} value={value} onChange={e=>onChange(+e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" style={{writingMode:'vertical-lr',direction:'rtl',transform:'rotate(180deg)'}}/>
      </div>
      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide text-center leading-tight">{label}</span>
      <span className="text-[10px] font-mono font-bold text-slate-700">{(value*100).toFixed(0)}%</span>
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
  {k:'title'        as const, label:'Title: OVERLAY', tag:'TXT',  tagBg:'#6366f1', tagText:'#fff', color:'#818cf8'},
  {k:'logo'         as const, label:'Overlay Logo',   tag:'LOGO', tagBg:'#10b981', tagText:'#fff', color:'#34d399'},
  {k:'blurZones'    as const, label:'Blur Zone',      tag:'BLUR', tagBg:'#f59e0b', tagText:'#fff', color:'#fbbf24'},
  {k:'templateVideo'as const, label:'Template Video', tag:'VID',  tagBg:'#3b82f6', tagText:'#fff', color:'#60a5fa'},
  {k:'mainVideo'    as const, label:'Main Clip',      tag:'VID',  tagBg:'#2563eb', tagText:'#fff', color:'#3b82f6'},
]

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EditorPage() {
  const [layout,setLayout]=useState<Layout>({templateX:0,templateY:476,templateW:1440,templateH:-1,logoX:56,logoY:198,logoW:200,logoH:146,titleX:5,titleY:1469,titleW:1435,titleH:300,titleDuration:30,mainVideoSkip:180})
  const [audio,setAudio]=useState<AudioConfig>({mainVideo:0,backgroundMusic:1.45,voiceNarration:1.75})
  const [blurZones,setBlurZones]=useState<BlurZone[]>([{id:'tl',label:'Top-Left',x:0,y:-30,w:210,h:210,sigma:30},{id:'tr',label:'Top-Right',x:1130,y:-30,w:350,h:180,sigma:30},{id:'bt',label:'Bottom-Ctr',x:420,y:-200,w:600,h:80,sigma:30}])
  const [layers,setLayers]=useState<LayersVis>({mainVideo:true,templateVideo:true,blurZones:true,title:true,logo:true})
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
  const [userPresets,setUserPresets]=useState<Preset[]>([])
  const [activePresetId,setActivePresetId]=useState<string>('standard')

  useEffect(()=>{
    fetch('/api/config').then(r=>r.json()).then((c:Record<string,unknown>)=>{
      setConfig(c)
      if(c?.layout) setLayout(prev=>({...prev,...(c.layout as Partial<Layout>)}))
      if(c?.audio){const a=c.audio as {volumes?:Partial<AudioConfig>};if(a.volumes)setAudio(prev=>({...prev,...a.volumes}))}
      if(c?.sourceMode) setSourceMode(prev=>({...prev,...(c.sourceMode as Partial<SourceModeConfig>)}))
    }).catch(()=>{})
    fetch('/api/videos').then(r=>r.json()).then((v:VideoItem[])=>setVideos(Array.isArray(v)?v:[])).catch(()=>{})
  },[])

  const onLayout=useCallback((l:Partial<Layout>)=>setLayout(prev=>({...prev,...l})),[])
  const toggleLayer=(k:keyof LayersVis)=>setLayers(prev=>({...prev,[k]:!prev[k]}))
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
      const next={...config,layout:{...(config?.layout as object||{}),...layout,logoScale:`${layout.logoW}:${layout.logoH}`},audio:{...(config?.audio as object||{}),volumes:audio},sourceMode}
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

  // Left tool items
  const LEFT_TOOLS = [
    {id:'media'  as const, icon:Film,    label:'Media'},
    {id:'source' as const, icon:Clapperboard, label:'Source'},
    {id:'audio'  as const, icon:Music,   label:'Audio'},
    {id:'text'   as const, icon:Type,    label:'Text'},
    {id:'effects'as const, icon:Wand2,   label:'Effects'},
  ]

  return (
    <div className="flex flex-col overflow-hidden" style={{height:'calc(100vh - 64px)',background:'#f1f5f9'}}>

      {/* ── TOP BAR ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 h-12 shrink-0 border-b border-slate-200 bg-white shadow-sm">
        {/* Left: undo/redo */}
        <div className="flex items-center gap-0.5">
          <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Undo2 className="w-4 h-4"/></button>
          <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Redo2 className="w-4 h-4"/></button>
        </div>

        <div className="w-px h-5 bg-slate-200"/>

        {/* Zoom */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">
          <button onClick={()=>setZoom(z=>Math.max(0.4,z-0.15))} className="text-slate-400 hover:text-slate-700"><ZoomOut className="w-3.5 h-3.5"/></button>
          <span className="text-xs font-mono font-bold text-slate-600 w-10 text-center">Fit {Math.round(zoom*54)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(2.5,z+0.15))} className="text-slate-400 hover:text-slate-700"><ZoomIn className="w-3.5 h-3.5"/></button>
          <button onClick={()=>setZoom(1.0)} className="text-slate-300 hover:text-slate-500 ml-0.5"><RotateCcw className="w-3 h-3"/></button>
        </div>

        <div className="flex-1 flex items-center justify-center gap-2">
          {/* Active element */}
          {activeElement && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/>
              <span className="text-xs font-semibold text-blue-600 capitalize">{activeElement.replace('blur-','Blur: ')} selected</span>
            </div>
          )}
          {/* Source mode badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-200">
            <Wand2 className="w-3 h-3 text-violet-500"/>
            <span className="text-xs font-semibold text-violet-600 capitalize">{sourceMode.mode.replace(/_/g,' ')}</span>
          </div>
        </div>

        {/* Right: actions */}
        <button onClick={saveLayout} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-40 shadow-sm">
          {saving?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Save className="w-3.5 h-3.5"/>} Save
        </button>
        <button onClick={runRender} disabled={rendering}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm">
          {rendering?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Download className="w-3.5 h-3.5"/>} Export
        </button>
      </div>

      {/* ── MAIN 3-PANEL LAYOUT ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Icon toolbar + panel ───────────────────────────────────── */}
        <div className="flex shrink-0" style={{background:'#fff',borderRight:'1px solid #e2e8f0'}}>
          {/* Icon column */}
          <div className="flex flex-col items-center pt-2 pb-2 gap-1 w-14 border-r border-slate-100">
            {LEFT_TOOLS.map(t=>(
              <button key={t.id} onClick={()=>setLeftTab(t.id)}
                className={cn('flex flex-col items-center gap-0.5 w-11 py-2 rounded-xl transition-all',leftTab===t.id?'bg-blue-50 text-blue-600':'text-slate-400 hover:text-slate-600 hover:bg-slate-50')}>
                <t.icon className="w-4.5 h-4.5"/>
                <span className="text-[8px] font-bold uppercase tracking-wide">{t.label}</span>
              </button>
            ))}
            <div className="flex-1"/>
            <button className="flex flex-col items-center gap-0.5 w-11 py-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
              <Settings2 className="w-4 h-4"/>
              <span className="text-[8px] font-bold uppercase tracking-wide">Config</span>
            </button>
          </div>

          {/* Panel content */}
          <div className="w-48 flex flex-col overflow-hidden">
            <div className="px-3 pt-3 pb-2 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{LEFT_TOOLS.find(t=>t.id===leftTab)?.label}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {leftTab==='media' && (<>
                {videos.length===0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-center rounded-xl border-2 border-dashed border-slate-200 p-4">
                    <Film className="w-6 h-6 text-slate-300 mb-1.5"/>
                    <p className="text-[10px] text-slate-400">No source videos</p>
                  </div>
                ) : videos.map(v=>(
                  <button key={v.id} onClick={()=>setSelectedVideo(v)}
                    className={cn('w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all border',selectedVideo?.id===v.id?'border-blue-200 bg-blue-50 text-blue-700':'border-transparent hover:bg-slate-50 text-slate-600')}>
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',selectedVideo?.id===v.id?'bg-blue-100':'bg-slate-100')}>
                      <Film className="w-3.5 h-3.5"/>
                    </div>
                    <span className="text-[10px] font-medium truncate">{v.title}</span>
                  </button>
                ))}
              </>)}
              {leftTab==='source' && <SourceModePanel config={sourceMode} onChange={setSourceMode}/>}
              {leftTab==='audio' && (
                <div className="px-1 py-2 space-y-3">
                  <p className="text-[9px] text-slate-400">3 luồng audio mix bằng FFmpeg amix.</p>
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
            </div>
          </div>
        </div>

        {/* ── CENTER: Canvas ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{background:'#e5e9f0'}}>
          <div className="flex-1 overflow-auto flex items-start justify-center p-6">
            <div className="flex flex-col items-center gap-3">
              {/* Coords bar above canvas */}
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/90 border border-slate-200 shadow-sm text-[10px] font-mono">
                <span className="text-blue-600">Tpl <strong>{layout.templateX},{layout.templateY}</strong> {layout.templateW}×{tplRH}</span>
                <span className="text-slate-200">|</span>
                <span className="text-sky-600">Logo <strong>{layout.logoX},{layout.logoY}</strong> {layout.logoW}×{layout.logoH}</span>
                <span className="text-slate-200">|</span>
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
            <Timeline sourceMode={sourceMode} onSourceModeChange={setSourceMode} layout={layout} onLayout={onLayout} renderLogs={renderLogs} rendering={rendering} showLogs={showLogs}/>
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

        {/* ── RIGHT: Properties + Layers ───────────────────────────────────── */}
        <div className="w-64 shrink-0 flex flex-col overflow-hidden bg-white border-l border-slate-200">
          {/* Tab switcher */}
          <div className="flex border-b border-slate-200 shrink-0">
            {[{id:'properties' as const,label:'PROPERTIES'},{id:'layers' as const,label:'LAYERS'}].map(t=>(
              <button key={t.id} onClick={()=>setRightTab(t.id)}
                className={cn('flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-colors',rightTab===t.id?'border-blue-500 text-blue-600':'border-transparent text-slate-400 hover:text-slate-600')}>
                {t.label}
              </button>
            ))}
          </div>

          {rightTab==='layers' ? (
            <div className="flex-1 overflow-y-auto">
              {/* Layer rows */}
              <div className="p-2 space-y-1">
                {LAYER_DEFS.map(l=>(
                  <div key={l.k} className={cn('flex items-center gap-2 px-2 py-2 rounded-xl border cursor-pointer transition-all',
                    activeElement===l.k||activeElement?.includes(l.k)?'border-blue-200 bg-blue-50':'border-transparent hover:border-slate-200 hover:bg-slate-50')}>
                    <GripVertical className="w-3 h-3 text-slate-300 shrink-0"/>
                    <div className="shrink-0 w-8 h-5 rounded text-[8px] font-black flex items-center justify-center" style={{background:l.tagBg,color:l.tagText}}>{l.tag}</div>
                    <span className="flex-1 text-[11px] font-medium text-slate-600 truncate">{l.label}</span>
                    <button onClick={()=>toggleLayer(l.k)} className="shrink-0 text-slate-300 hover:text-slate-600 transition-colors">
                      {layers[l.k] ? <Eye className="w-3.5 h-3.5"/> : <EyeOff className="w-3.5 h-3.5 text-slate-200"/>}
                    </button>
                    <Lock className="w-3 h-3 text-slate-200 shrink-0"/>
                  </div>
                ))}
              </div>

              {/* Master Mixer */}
              <div className="border-t border-slate-100 mt-2">
                <div className="px-3 py-2 flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5 text-slate-400"/>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Mixer</span>
                </div>
                <div className="flex items-end justify-center gap-4 px-3 pb-4 pt-1">
                  <VolumeBar label="Main" value={audio.mainVideo} onChange={v=>setAudio(p=>({...p,mainVideo:v}))} color="#818cf8"/>
                  <VolumeBar label="Music" value={audio.backgroundMusic} onChange={v=>setAudio(p=>({...p,backgroundMusic:v}))} color="#c084fc"/>
                  <VolumeBar label="Voice" value={audio.voiceNarration} onChange={v=>setAudio(p=>({...p,voiceNarration:v}))} color="#f472b6"/>
                </div>
                <div className="px-3 pb-3">
                  <button onClick={runRender} disabled={rendering}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-md">
                    {rendering?<Loader2 className="w-4 h-4 animate-spin"/>:<Download className="w-4 h-4"/>}
                    EXPORT PROJECT
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Properties panel */
            <div className="flex flex-col overflow-hidden flex-1">
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
                    <p className="text-[10px] font-semibold text-slate-500">Apply preset để load toàn bộ layout + audio.</p>
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
          )}
        </div>
      </div>
    </div>
  )
}
