'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/utils'
import { toast } from 'sonner'

interface AssetFile {
  name: string; path: string; relativePath: string; size: number; extension: string
}

type TabKey = 'templates' | 'music' | 'logos' | 'fonts'

const TABS: { id: TabKey; label: string; accept: string; desc: string; icon: string }[] = [
  { id: 'templates', label: 'Templates', accept: '.mp4,.mov,.mkv', desc: 'Video nền gameplay/template', icon: 'movie' },
  { id: 'music',     label: 'Music',     accept: '.mp3,.wav,.aac', desc: 'Nhạc nền cho video final',   icon: 'audiotrack' },
  { id: 'logos',     label: 'Logos',     accept: '.png,.jpg,.webp,.svg', desc: 'Logo overlay',         icon: 'image' },
  { id: 'fonts',     label: 'Fonts',     accept: '.ttf,.otf', desc: 'Font cho title overlay',          icon: 'font_download' },
]

function AssetCard({ asset, onDelete }: { asset: AssetFile; onDelete: () => void }) {
  const isVideo = ['.mp4', '.mov', '.mkv', '.webm'].includes(asset.extension)
  const isAudio = ['.mp3', '.wav', '.aac'].includes(asset.extension)
  const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(asset.extension)
  const url = `/api/file?path=${encodeURIComponent(asset.path)}`

  const typeLabel = isVideo ? 'Video' : isAudio ? 'Audio' : isImage ? 'Image' : 'Font'

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.02] transition-all group">
      {/* Preview */}
      <div className="aspect-video relative bg-slate-100 overflow-hidden flex items-center justify-center">
        {isImage ? (
          <img src={url} alt={asset.name} className="w-full h-full object-cover" />
        ) : isVideo ? (
          <video src={url} className="w-full h-full object-cover" muted
            onMouseEnter={e => (e.target as HTMLVideoElement).play()}
            onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
          />
        ) : isAudio ? (
          <span className="material-symbols-outlined text-5xl text-blue-200">audiotrack</span>
        ) : (
          <span className="material-symbols-outlined text-5xl text-blue-200">font_download</span>
        )}

        {/* Play overlay for video/audio */}
        {(isVideo || isAudio) && (
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              onClick={() => isAudio ? new Audio(url).play() : window.open(url, '_blank')}
              className="w-10 h-10 rounded-full bg-white/90 text-blue-600 flex items-center justify-center shadow-lg active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
            </button>
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur rounded text-[9px] font-bold uppercase tracking-tight text-slate-900 shadow-sm">
          {typeLabel}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h6 className="font-bold text-sm text-slate-800 truncate" title={asset.name}>{asset.name}</h6>
        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] font-medium text-slate-400">{formatBytes(asset.size)}</span>
          <div className="flex gap-1">
            <button
              onClick={onDelete}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
              title="Delete"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
            <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="More">
              <span className="material-symbols-outlined text-lg">more_vert</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UploadZone({ type, accept, label, onUpload, uploading }: {
  type: string; accept: string; label: string
  onUpload: (type: string, file: File) => void; uploading: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onUpload(type, file)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'h-full bg-white rounded-xl border-2 border-dashed transition-all group flex flex-col items-center justify-center p-12 text-center cursor-pointer min-h-[280px]',
        dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'
      )}
    >
      <div className={cn(
        'w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-transform',
        dragging ? 'scale-110 bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:scale-110 group-hover:bg-blue-100 group-hover:text-blue-600'
      )}>
        {uploading
          ? <span className="material-symbols-outlined text-3xl animate-spin">refresh</span>
          : <span className="material-symbols-outlined text-3xl">upload_file</span>
        }
      </div>
      <h4 className="text-base font-bold text-slate-700 mb-2">
        {uploading ? 'Uploading...' : `Upload ${label}`}
      </h4>
      <p className="text-sm text-slate-400 leading-relaxed mb-6">
        Drag and drop files here, or click to browse
      </p>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
        {accept.replace(/\./g, '').toUpperCase()}
      </span>
      <input ref={inputRef} type="file" className="hidden" accept={accept}
        onChange={e => { if (e.target.files?.[0]) onUpload(type, e.target.files[0]) }}
      />
    </div>
  )
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Record<TabKey, AssetFile[]>>({
    templates: [], music: [], logos: [], fonts: [],
  })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState<TabKey>('templates')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/assets')
      setAssets(await res.json())
    } catch { toast.error('Failed to load assets') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const uploadFile = async (type: string, file: File) => {
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`/api/assets?type=${type}`, { method: 'POST', body: fd })
      if (res.ok) { toast.success(`Uploaded ${file.name}`); load() }
      else toast.error('Upload failed')
    } catch { toast.error('Upload error') }
    finally { setUploading(false) }
  }

  const deleteAsset = async (path: string, name: string) => {
    if (!confirm(`Delete ${name}?`)) return
    try {
      await fetch(`/api/assets?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
      toast.success(`Deleted ${name}`); load()
    } catch { toast.error('Delete failed') }
  }

  const current = TABS.find(t => t.id === tab)!
  const total = Object.values(assets).reduce((a, b) => a + b.length, 0)

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-1 block">
            Management Suite
          </span>
          <h3 className="text-3xl font-bold tracking-tight text-slate-900">Assets Manager</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 font-semibold text-sm rounded-lg shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50 border border-slate-200"
          >
            <span className={cn('material-symbols-outlined text-[20px]', loading && 'animate-spin')}>refresh</span>
            Refresh
          </button>
          <label className="flex items-center gap-2 px-6 py-2 bg-gradient-to-br from-blue-600 to-blue-400 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Upload Asset
            <input type="file" className="hidden" accept={current.accept}
              onChange={e => { if (e.target.files?.[0]) uploadFile(tab, e.target.files[0]) }}
            />
          </label>
        </div>
      </div>

      {/* Stats + Tabs row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-5 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2',
                tab === t.id
                  ? 'bg-white text-blue-600 font-semibold shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                tab === t.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'
              )}>
                {assets[t.id].length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{total} files total</span>
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-1.5 transition-colors', viewMode === 'grid' ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600')}
            >
              <span className="material-symbols-outlined">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-1.5 transition-colors', viewMode === 'list' ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600')}
            >
              <span className="material-symbols-outlined">format_list_bulleted</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bento layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Upload Zone */}
        <div className="col-span-12 lg:col-span-4">
          <UploadZone
            type={tab}
            accept={current.accept}
            label={current.label}
            onUpload={uploadFile}
            uploading={uploading}
          />
        </div>

        {/* Asset Grid */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Recent {current.label}
            </h5>
            <span className="text-xs text-slate-400">{current.desc}</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse">
                  <div className="aspect-video bg-slate-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                    <div className="h-2 bg-slate-100 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : assets[tab].length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-slate-100">
              <span className="material-symbols-outlined text-5xl text-slate-200 mb-4">{current.icon}</span>
              <p className="text-sm font-medium text-slate-500">No {current.label.toLowerCase()} yet</p>
              <p className="text-xs text-slate-400 mt-1">Upload a file to get started</p>
            </div>
          ) : (
            <div className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5'
                : 'space-y-3'
            )}>
              {assets[tab].map(asset => (
                <AssetCard
                  key={asset.path}
                  asset={asset}
                  onDelete={() => deleteAsset(asset.relativePath, asset.name)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
