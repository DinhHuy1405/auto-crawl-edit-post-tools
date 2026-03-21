'use client'
import { useState, useEffect, useCallback } from 'react'
import { cn, truncate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Loader2,
  Play, Film, ChevronDown, ChevronUp, AlertCircle, CloudUpload, Trash2,
} from 'lucide-react'
import { TikTokIcon, FacebookIcon, ThreadsIcon } from '@/components/platform-icons'

interface UploadVideo {
  id: string; title: string; description: string; file_path: string
  status: string; created_at: string
  facebook: { uploaded: boolean; uploaded_at?: string | null; reel_id?: string; error?: string }
  tiktok:   { uploaded: boolean; uploaded_at?: string | null; error?: string }
  threads:  { uploaded: boolean; uploaded_at?: string | null; error?: string }
}
interface Stats { total: number; ready: number; facebook_uploaded: number; tiktok_uploaded: number; threads_uploaded: number; facebook_pending: number; tiktok_pending: number; threads_pending: number }

const STATUS_LABEL = { completed: 'COMPLETED', failed: 'FAILED', queued: 'QUEUED', pending: 'PENDING' }

export default function UploadPage() {
  const [videos, setVideos] = useState<UploadVideo[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ msg: string; level: string }[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [logOpen, setLogOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/upload')
      const { videos: v, stats: s } = await res.json()
      setVideos(Array.isArray(v) ? v : []); setStats(s)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const doUpload = async (step: string, label: string) => {
    setUploading(label); setLogs([]); setLogOpen(true)
    try {
      const res = await fetch('/api/workflow/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, runId: `up_${Date.now()}` }),
      })
      if (!res.body) { setUploading(null); return }
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
            if (ev.type === 'log') setLogs(p => [...p.slice(-400), { msg: ev.message, level: ev.level || 'default' }])
            if (ev.type === 'done') { toast[ev.success ? 'success' : 'error'](ev.success ? 'Upload complete!' : 'Upload had errors'); load() }
          } catch {}
        }
      }
    } catch (e) { toast.error(String(e)) }
    finally { setUploading(null) }
  }

  const toggle = (id: string) => {
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const videoStatus = (v: UploadVideo) => {
    const allDone = v.tiktok?.uploaded && v.facebook?.uploaded && v.threads?.uploaded
    const anyError = v.tiktok?.error || v.facebook?.error || v.threads?.error
    if (allDone) return { label: 'COMPLETED', cls: 'bg-emerald-50 text-emerald-700' }
    if (anyError) return { label: 'FAILED', cls: 'bg-red-50 text-red-700' }
    const anyDone = v.tiktok?.uploaded || v.facebook?.uploaded || v.threads?.uploaded
    if (anyDone) return { label: 'PARTIAL', cls: 'bg-amber-50 text-amber-700' }
    return { label: 'QUEUED', cls: 'bg-blue-50 text-blue-600' }
  }

  const PlatformBadge = ({ label, d }: { label: string; d: { uploaded: boolean; error?: string } }) => (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
      d?.uploaded ? 'bg-emerald-50 text-emerald-700' : d?.error ? 'bg-red-50 text-red-600' : 'text-slate-400 border border-slate-200'
    )}>
      {d?.uploaded ? <CheckCircle2 className="w-3 h-3" /> : d?.error ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {label}
    </span>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="flex items-center justify-between px-8 h-16 bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 shadow-sm shadow-slate-200/50">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Upload Manager</h2>
          <p className="text-xs text-slate-400">Monitor and manage your automated content distribution pipeline.</p>
        </div>
        <div className="flex items-center gap-3">
          {uploading && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
              <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Uploading...</span>
            </div>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
          <button onClick={() => doUpload('upload', 'all')} disabled={!!uploading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-md shadow-blue-200 hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {uploading === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
            Upload All
          </button>
        </div>
      </header>

      <div className="flex-1 p-8 space-y-6 animate-fade-in">
        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Ready</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-slate-900">{stats?.total ?? 0}</span>
              {(stats?.ready ?? 0) > 0 && (
                <span className="text-xs text-emerald-600 font-semibold mb-1">+{stats?.ready} new</span>
              )}
            </div>
          </div>
          {[
            { key: 'tiktok', label: 'TikTok', up: stats?.tiktok_uploaded ?? 0, pending: stats?.tiktok_pending ?? 0, Icon: TikTokIcon, barColor: 'bg-slate-900' },
            { key: 'facebook', label: 'Facebook', up: stats?.facebook_uploaded ?? 0, pending: stats?.facebook_pending ?? 0, Icon: FacebookIcon, barColor: 'bg-blue-500' },
            { key: 'threads', label: 'Threads', up: stats?.threads_uploaded ?? 0, pending: stats?.threads_pending ?? 0, Icon: ThreadsIcon, barColor: 'bg-slate-700' },
          ].map(s => (
            <div key={s.key} className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{s.label}</p>
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl font-bold text-slate-900">{s.up}</span>
                <s.Icon className="w-5 h-5 text-slate-400" />
              </div>
              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${s.barColor} rounded-full`}
                  style={{ width: `${(stats?.total ?? 0) > 0 ? (s.up / (stats?.total ?? 1)) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-5">
          {/* Platform Upload Controls */}
          <div className="col-span-3 space-y-3">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quick Upload</p>
              </div>
              <div className="p-3 space-y-2">
                {[
                  { platform: 'tiktok',   label: 'Upload to TikTok',    Icon: TikTokIcon,   pending: stats?.tiktok_pending ?? 0 },
                  { platform: 'facebook', label: 'Upload to Facebook',  Icon: FacebookIcon, pending: stats?.facebook_pending ?? 0 },
                  { platform: 'threads',  label: 'Post to Threads',     Icon: ThreadsIcon,  pending: stats?.threads_pending ?? 0 },
                ].map(p => (
                  <button key={p.platform}
                    disabled={!!uploading || p.pending === 0}
                    onClick={() => doUpload('upload', p.platform)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all',
                      p.pending > 0
                        ? 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                        : 'border-slate-100 bg-slate-50/50 opacity-40 cursor-not-allowed'
                    )}>
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                      <p.Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{p.label}</p>
                    </div>
                    {p.pending > 0 && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">{p.pending}</span>
                    )}
                    {uploading === p.platform && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Log toggle */}
            <button onClick={() => setLogOpen(o => !o)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <div className={cn('w-2 h-2 rounded-full', uploading ? 'bg-green-400 animate-pulse' : 'bg-slate-300')} />
              {logOpen ? 'Hide' : 'Show'} Upload Logs
            </button>
          </div>

          {/* Upload Logs */}
          {logOpen && (
            <div className="col-span-9 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-950">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <p className="text-xs font-mono text-slate-400 ml-2">LOG VIEWER</p>
                {uploading && <Loader2 className="w-3 h-3 text-blue-400 animate-spin ml-auto" />}
              </div>
              <div className="log-viewer h-52 text-[11px]">
                {logs.length === 0
                  ? <span className="text-slate-600">Upload logs will appear here...</span>
                  : logs.map((l, i) => <span key={i} className={cn('log-line', l.level)}>{l.msg}</span>)}
              </div>
            </div>
          )}

          {/* Video Table — full width when logs hidden */}
          <div className={cn('bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden', logOpen ? 'col-span-12' : 'col-span-9')}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">All Videos</p>
                <p className="text-xs text-slate-400 mt-0.5">Monitor and manage your automated content distribution pipeline.</p>
              </div>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{videos.length} total</span>
            </div>
            {videos.length === 0 ? (
              <div className="py-16 text-center">
                <CloudUpload className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-400">No videos in database</p>
                <p className="text-xs text-slate-300 mt-1">Run the workflow to add videos</p>
              </div>
            ) : (
              <div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-[11px] font-bold text-slate-400 uppercase tracking-wide text-left py-3 px-5">Video Title & Path</th>
                      <th className="text-[11px] font-bold text-slate-400 uppercase tracking-wide text-left py-3 px-4">Status</th>
                      <th className="text-[11px] font-bold text-slate-400 uppercase tracking-wide text-left py-3 px-4">Platforms</th>
                      <th className="py-3 px-4 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {videos.map(v => {
                      const st = videoStatus(v)
                      return (
                        <>
                          <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                            onClick={() => toggle(v.id)}>
                            <td className="py-4 px-5">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                  <Film className="w-4 h-4 text-slate-400" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{truncate(v.title, 55)}</p>
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{truncate(v.file_path, 50)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide', st.cls)}>
                                ● {st.label}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5">
                                <PlatformBadge label="TIKTOK" d={v.tiktok} />
                                <PlatformBadge label="FACEBOOK" d={v.facebook} />
                                <PlatformBadge label="THREADS" d={v.threads} />
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              {expanded.has(v.id)
                                ? <ChevronUp className="w-4 h-4 text-slate-300" />
                                : <ChevronDown className="w-4 h-4 text-slate-300" />}
                            </td>
                          </tr>
                          {expanded.has(v.id) && (
                            <tr key={`${v.id}-detail`}>
                              <td colSpan={4} className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                                <div className="space-y-2">
                                  <p className="text-[11px] text-slate-500 font-mono break-all">{v.file_path}</p>
                                  <p className="text-[11px] text-slate-400">
                                    Created: {new Date(v.created_at).toLocaleString('vi-VN')}
                                  </p>
                                  {['tiktok', 'facebook', 'threads'].map(p => {
                                    const d = v[p as keyof typeof v] as { uploaded: boolean; error?: string; uploaded_at?: string | null }
                                    return d?.error ? (
                                      <div key={p} className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                                        <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                                        <div>
                                          <p className="text-[11px] font-bold text-red-700 uppercase">{p} Error</p>
                                          <p className="text-[11px] text-red-600 mt-0.5">{d.error.slice(0, 200)}</p>
                                        </div>
                                      </div>
                                    ) : d?.uploaded ? (
                                      <div key={p} className="flex items-center gap-2 text-[11px] text-emerald-700">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span className="font-semibold capitalize">{p}</span> uploaded {d.uploaded_at ? `· ${new Date(d.uploaded_at).toLocaleString('vi-VN')}` : ''}
                                      </div>
                                    ) : null
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
