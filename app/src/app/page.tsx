'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { formatDate, truncate } from '@/lib/utils'
import {
  Film, ArrowUpToLine, CheckCircle2, XCircle, Clock, RefreshCw,
  Play, ArrowRight, GitBranch, Key, AlertTriangle, Zap,
} from 'lucide-react'
import { TikTokIcon, FacebookIcon, ThreadsIcon } from '@/components/platform-icons'

interface Stats {
  videos: { total: number; done: number; pending: number; error: number }
  upload: { total: number; tiktok_uploaded: number; facebook_uploaded: number; threads_uploaded: number; tiktok_pending: number; facebook_pending: number; threads_pending: number }
  apiKeys: { active: number; quota: number }
}
interface UploadVideo {
  id: string; title: string; created_at: string
  tiktok: { uploaded: boolean; error?: string }
  facebook: { uploaded: boolean; error?: string }
  threads: { uploaded: boolean; error?: string }
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentVideos, setRecentVideos] = useState<UploadVideo[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [vRes, uRes, kRes] = await Promise.all([
        fetch('/api/videos'), fetch('/api/upload'), fetch('/api/config?type=api-keys'),
      ])
      const videos = await vRes.json()
      const { videos: uv, stats: us } = await uRes.json()
      const keys = await kRes.json()
      setStats({
        videos: {
          total: Array.isArray(videos) ? videos.length : 0,
          done: Array.isArray(videos) ? videos.filter((v: { status: string }) => v.status === 'done').length : 0,
          pending: Array.isArray(videos) ? videos.filter((v: { status: string }) => v.status === 'not yet').length : 0,
          error: Array.isArray(videos) ? videos.filter((v: { status: string }) => v.status === 'error').length : 0,
        },
        upload: us || { total: 0, tiktok_uploaded: 0, facebook_uploaded: 0, threads_uploaded: 0, tiktok_pending: 0, facebook_pending: 0, threads_pending: 0 },
        apiKeys: {
          active: [...(keys.gemini || []), ...(keys.tts || [])].filter((k: { status: string }) => k.status === 'active').length,
          quota: [...(keys.gemini || []), ...(keys.tts || [])].filter((k: { status: string }) => k.status === 'quota_exceeded').length,
        },
      })
      setRecentVideos(Array.isArray(uv) ? uv.slice(0, 8) : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const platformStatus = (data: { uploaded: boolean; error?: string }) => {
    if (data?.uploaded) return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
    if (data?.error) return <XCircle className="w-3.5 h-3.5 text-red-400" />
    return <Clock className="w-3.5 h-3.5 text-slate-300" />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">{formatDate(new Date())}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link href="/workflow" className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Play className="w-3.5 h-3.5 fill-white" />Run Workflow
          </Link>
        </div>
      </div>

      {/* API Key Warning */}
      {stats?.apiKeys.quota ? (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">{stats.apiKeys.quota} API key(s) quota exceeded</p>
            <p className="text-xs text-amber-600 mt-0.5">Workflow may fail. Go to Settings → API Keys to reset.</p>
          </div>
          <Link href="/settings" className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1">
            Fix Now <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : null}

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-2/3 mb-4" />
              <div className="h-8 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-2 bg-slate-100 rounded w-1/2" />
            </div>
          ))
        ) : [
          { label: 'Videos Rendered', value: stats?.videos.done ?? 0, sub: `${stats?.videos.pending ?? 0} pending`, icon: Film, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'TikTok Uploads', value: stats?.upload.tiktok_uploaded ?? 0, sub: `${stats?.upload.tiktok_pending ?? 0} pending`, icon: TikTokIcon, color: 'text-slate-900', bg: 'bg-slate-50', border: 'border-slate-200' },
          { label: 'Facebook Reels', value: stats?.upload.facebook_uploaded ?? 0, sub: `${stats?.upload.facebook_pending ?? 0} pending`, icon: FacebookIcon, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Threads Posts', value: stats?.upload.threads_uploaded ?? 0, sub: `${stats?.upload.threads_pending ?? 0} pending`, icon: ThreadsIcon, color: 'text-slate-800', bg: 'bg-slate-50', border: 'border-slate-200' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
              <div className={`w-8 h-8 rounded-lg ${s.bg} border ${s.border} flex items-center justify-center`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-3">{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Quick Actions */}
        <div className="col-span-2 section-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Quick Actions</p>
          </div>
          <div className="p-3 space-y-1">
            {[
              { href: '/workflow', icon: GitBranch, label: 'Run Full Workflow', desc: 'Crawl → Edit → Upload', color: 'bg-blue-50 text-blue-600 border-blue-100' },
              { href: '/editor',   icon: Film,     label: 'Video Editor',      desc: 'Edit & render videos',  color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
              { href: '/upload',   icon: ArrowUpToLine, label: 'Upload Manager', desc: 'Manage platforms',  color: 'bg-violet-50 text-violet-600 border-violet-100' },
              { href: '/settings', icon: Key,      label: 'API Keys',          desc: 'Manage credentials',   color: 'bg-amber-50 text-amber-600 border-amber-100' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${item.color}`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Videos */}
        <div className="col-span-3 section-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Recent Videos</p>
            <Link href="/upload" className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentVideos.length === 0 ? (
            <div className="py-12 text-center">
              <Film className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No videos yet</p>
              <p className="text-xs text-slate-300 mt-0.5">Run the workflow to get started</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Title</th>
                <th>Date</th>
                <th className="text-center">TikTok</th>
                <th className="text-center">Facebook</th>
                <th className="text-center">Threads</th>
              </tr></thead>
              <tbody>
                {recentVideos.map(v => (
                  <tr key={v.id}>
                    <td className="font-medium text-slate-800">{truncate(v.title, 40)}</td>
                    <td className="text-slate-400 text-xs whitespace-nowrap">{new Date(v.created_at).toLocaleDateString('vi-VN')}</td>
                    <td className="text-center">{platformStatus(v.tiktok)}</td>
                    <td className="text-center">{platformStatus(v.facebook)}</td>
                    <td className="text-center">{platformStatus(v.threads)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* API Status */}
      <div className="section-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Gemini API Status</p>
              <p className="text-xs text-slate-400">
                {stats?.apiKeys.active ?? 0} active keys · {stats?.apiKeys.quota ?? 0} quota exceeded
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(stats?.apiKeys.quota ?? 0) > 0 && (
              <span className="status-error"><AlertTriangle className="w-3 h-3" />{stats?.apiKeys.quota} Exceeded</span>
            )}
            <span className="status-active"><CheckCircle2 className="w-3 h-3" />{stats?.apiKeys.active ?? 0} Active</span>
            <Link href="/settings" className="ml-2 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
              Manage
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
