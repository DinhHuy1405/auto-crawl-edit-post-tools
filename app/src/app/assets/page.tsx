'use client'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Film, Music, Image as ImageIcon, Type, Upload, RefreshCw, Trash2, Play, Loader2, Package } from 'lucide-react'
import { formatBytes } from '@/lib/utils'
import { toast } from 'sonner'

interface AssetFile {
  name: string; path: string; relativePath: string; size: number; extension: string
}

type TabKey = 'templates' | 'music' | 'logos' | 'fonts'

const TABS: { id: TabKey; label: string; icon: React.ElementType; accept: string; desc: string }[] = [
  { id: 'templates', label: 'Templates', icon: Film,      accept: '.mp4,.mov,.mkv', desc: 'Video nền gameplay/template' },
  { id: 'music',     label: 'Music',     icon: Music,     accept: '.mp3,.wav,.aac', desc: 'Nhạc nền cho video final' },
  { id: 'logos',     label: 'Logos',     icon: ImageIcon, accept: '.png,.jpg,.webp,.svg', desc: 'Logo overlay' },
  { id: 'fonts',     label: 'Fonts',     icon: Type,      accept: '.ttf,.otf', desc: 'Font cho title overlay' },
]

function AssetCard({ asset, onDelete }: { asset: AssetFile; onDelete: () => void }) {
  const isVideo = ['.mp4', '.mov', '.mkv', '.webm'].includes(asset.extension)
  const isAudio = ['.mp3', '.wav', '.aac'].includes(asset.extension)
  const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(asset.extension)
  const url = `/api/file?path=${encodeURIComponent(asset.path)}`

  return (
    <div className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all">
      {/* Preview area */}
      <div className="w-full h-28 bg-slate-100 flex items-center justify-center overflow-hidden">
        {isImage ? (
          <img src={url} alt={asset.name} className="max-w-full max-h-full object-contain" />
        ) : isVideo ? (
          <video src={url} className="max-w-full max-h-full" muted
            onMouseEnter={e => (e.target as HTMLVideoElement).play()}
            onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
          />
        ) : isAudio ? (
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-1">
              <Music className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-xs text-slate-400">{asset.extension}</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-1">
              <Type className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-xs text-slate-400">{asset.extension}</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs font-semibold text-slate-800 truncate" title={asset.name}>{asset.name}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{formatBytes(asset.size)}</p>
        <div className="flex gap-1.5 mt-2">
          {(isAudio || isVideo) && (
            <button
              onClick={() => {
                if (isAudio) { new Audio(url).play() }
                else window.open(url, '_blank')
              }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
            >
              <Play className="w-2.5 h-2.5" />Play
            </button>
          )}
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-500 bg-red-50 rounded-md hover:bg-red-100 transition-colors ml-auto"
          >
            <Trash2 className="w-2.5 h-2.5" />Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function UploadZone({ type, accept, label, onUpload }: {
  type: string; accept: string; label: string; onUpload: (type: string, file: File) => void
}) {
  return (
    <label className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all bg-slate-50/50">
      <Upload className="w-5 h-5 text-slate-400 mb-1.5" />
      <p className="text-xs font-medium text-slate-600">Upload {label}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{accept}</p>
      <input type="file" className="hidden" accept={accept}
        onChange={e => { if (e.target.files?.[0]) onUpload(type, e.target.files[0]) }}
      />
    </label>
  )
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Record<TabKey, AssetFile[]>>({
    templates: [], music: [], logos: [], fonts: [],
  })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState<TabKey>('templates')

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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  )

  const total = Object.values(assets).reduce((a, b) => a + b.length, 0)
  const current = TABS.find(t => t.id === tab)!

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title"><Package className="w-5 h-5 text-blue-500" />Asset Manager</h1>
          <p className="page-desc">Templates, music, logos & fonts — {total} files total</p>
        </div>
        <button onClick={load} disabled={loading || uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'stat-card text-left transition-all',
              tab === t.id ? 'ring-2 ring-blue-400 ring-offset-1' : ''
            )}>
            <div className="flex items-center justify-between mb-2">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                tab === t.id ? 'bg-blue-100' : 'bg-slate-100')}>
                <t.icon className={cn('w-4 h-4', tab === t.id ? 'text-blue-600' : 'text-slate-500')} />
              </div>
              <span className="text-2xl font-bold text-slate-900">{assets[t.id].length}</span>
            </div>
            <p className="text-xs font-medium text-slate-600">{t.label}</p>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="section-card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors',
                tab === t.id
                  ? 'border-blue-500 text-blue-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60'
              )}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              <span className={cn('ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                tab === t.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500')}>
                {assets[t.id].length}
              </span>
            </button>
          ))}
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-500">{current.desc}</p>
            {uploading && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading...
              </div>
            )}
          </div>

          <div className="grid grid-cols-5 gap-4">
            <UploadZone type={tab} accept={current.accept} label={current.label} onUpload={uploadFile} />
            {assets[tab].map(asset => (
              <AssetCard key={asset.path} asset={asset}
                onDelete={() => deleteAsset(asset.relativePath, asset.name)} />
            ))}
          </div>

          {assets[tab].length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <current.icon className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No {current.label.toLowerCase()} yet</p>
              <p className="text-xs mt-0.5">Upload a file to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
