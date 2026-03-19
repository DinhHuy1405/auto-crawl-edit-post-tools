'use client'
import { useState, useEffect, useCallback } from 'react'
import { cn, truncate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ArrowUpToLine, RefreshCw, CheckCircle2, XCircle, Clock, Loader2,
  Play, Film, ChevronDown, ChevronUp, AlertCircle,
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

export default function UploadPage() {
  const [videos, setVideos] = useState<UploadVideo[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ msg: string; level: string }[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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
    setUploading(label); setLogs([])
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
            if (ev.type === 'done') { toast[ev.success ? 'success' : 'error'](ev.success ? `Upload complete!` : 'Upload had errors'); load() }
          } catch {}
        }
      }
    } catch (e) { toast.error(String(e)) }
    finally { setUploading(null) }
  }

  const toggle = (id: string) => {
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const PChip = ({ p, d }: { p: string; d: { uploaded: boolean; error?: string } }) => (
    <div className={cn('platform-chip', d?.uploaded ? 'uploaded' : d?.error ? 'failed' : 'pending')}>
      {d?.uploaded ? <CheckCircle2 className="w-3 h-3" /> : d?.error ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {p}
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title"><ArrowUpToLine className="w-5 h-5 text-blue-500" />Upload Manager</h1>
          <p className="page-desc">Multi-platform video publishing dashboard</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />Refresh
          </button>
          <button onClick={() => doUpload('upload', 'all')} disabled={!!uploading} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
            {uploading === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
            Upload All
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <div className="stat-card text-center">
            <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Total Videos</p>
          </div>
          {[
            { key: 'tiktok', label: 'TikTok', up: stats.tiktok_uploaded, pending: stats.tiktok_pending, icon: TikTokIcon, color: 'text-slate-900' },
            { key: 'facebook', label: 'Facebook', up: stats.facebook_uploaded, pending: stats.facebook_pending, icon: FacebookIcon, color: 'text-blue-600' },
            { key: 'threads', label: 'Threads', up: stats.threads_uploaded, pending: stats.threads_pending, icon: ThreadsIcon, color: 'text-slate-800' },
          ].map(s => (
            <div key={s.key} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{s.up}</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Progress</span><span>{s.pending} pending</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${stats.total > 0 ? (s.up / stats.total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Upload Controls */}
        <div className="section-card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Quick Upload</p>
          </div>
          <div className="p-3 space-y-2">
            {[
              { step: 'upload', platform: 'tiktok', label: 'Upload to TikTok', Icon: TikTokIcon, iconColor: 'text-slate-900', pending: stats?.tiktok_pending ?? 0 },
              { step: 'upload', platform: 'facebook', label: 'Upload to Facebook', Icon: FacebookIcon, iconColor: 'text-blue-600', pending: stats?.facebook_pending ?? 0 },
              { step: 'upload', platform: 'threads', label: 'Post to Threads', Icon: ThreadsIcon, iconColor: 'text-slate-800', pending: stats?.threads_pending ?? 0 },
            ].map(p => (
              <button
                key={p.platform}
                disabled={!!uploading || p.pending === 0}
                onClick={() => doUpload(p.step, p.platform)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left',
                  p.pending > 0
                    ? 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                    : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                )}
              >
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  p.platform === 'tiktok' ? 'bg-slate-100' : p.platform === 'facebook' ? 'bg-blue-50' : 'bg-slate-100')}>
                  <p.Icon size={16} className={p.iconColor} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{p.label}</p>
                </div>
                {p.pending > 0 && (
                  <span className="status-pending">{p.pending} pending</span>
                )}
                {uploading === p.platform && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Logs */}
        <div className="col-span-2 section-card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', uploading ? 'bg-green-400 animate-pulse' : 'bg-slate-300')} />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Upload Logs</p>
            {uploading && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin ml-auto" />}
          </div>
          <div className="log-viewer flex-1 h-52 text-[11px]">
            {logs.length === 0
              ? <span className="text-slate-600">Upload logs will appear here...</span>
              : logs.map((l, i) => <span key={i} className={cn('log-line', l.level)}>{l.msg}</span>)}
          </div>
        </div>
      </div>

      {/* Video Table */}
      <div className="section-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Film className="w-4 h-4 text-slate-400" />
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">All Videos ({videos.length})</p>
        </div>
        {videos.length === 0 ? (
          <div className="py-12 text-center">
            <ArrowUpToLine className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No videos in database</p>
            <p className="text-xs text-slate-300 mt-0.5">Run the workflow to add videos</p>
          </div>
        ) : (
          <div>
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th className="text-center">TikTok</th>
                  <th className="text-center">Facebook</th>
                  <th className="text-center">Threads</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {videos.map(v => (
                  <>
                    <tr key={v.id} className="cursor-pointer" onClick={() => toggle(v.id)}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center shrink-0">
                            <Film className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <span className="font-medium text-slate-800">{truncate(v.title, 50)}</span>
                        </div>
                      </td>
                      <td className="text-xs text-slate-400 whitespace-nowrap">{new Date(v.created_at).toLocaleDateString('vi-VN')}</td>
                      <td className="text-center"><PChip p="TikTok" d={v.tiktok} /></td>
                      <td className="text-center"><PChip p="FB" d={v.facebook} /></td>
                      <td className="text-center"><PChip p="Threads" d={v.threads} /></td>
                      <td className="text-right pr-3">
                        {expanded.has(v.id) ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </td>
                    </tr>
                    {expanded.has(v.id) && (
                      <tr key={`${v.id}-detail`}>
                        <td colSpan={6} className="bg-slate-50 px-6 py-3 border-t-0">
                          <p className="text-xs text-slate-500 font-mono break-all mb-2">{v.file_path}</p>
                          {['tiktok', 'facebook', 'threads'].map(p => {
                            const d = v[p as keyof typeof v] as { uploaded: boolean; error?: string }
                            return d?.error ? (
                              <div key={p} className="flex items-start gap-2 mb-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-red-600"><strong className="capitalize">{p}:</strong> {d.error.slice(0, 120)}...</p>
                              </div>
                            ) : null
                          })}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
