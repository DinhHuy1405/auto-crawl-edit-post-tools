'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { formatDate, truncate } from '@/lib/utils'
import {
  Film, ArrowUpToLine, CheckCircle2, XCircle, Clock, RefreshCw,
  Play, ArrowRight, GitBranch, Key, AlertTriangle, Zap, TrendingUp,
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
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="flex items-center justify-between px-8 h-16 bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 shadow-sm shadow-slate-200/50">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Dashboard</h2>
          <p className="text-xs text-slate-400">{formatDate(new Date())}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link href="/workflow"
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-md shadow-blue-200 hover:opacity-90 transition-all active:scale-95">
            <Play className="w-3.5 h-3.5 fill-white" />
            Run Workflow
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-8 space-y-6 animate-fade-in">

        {/* API Key Warning */}
        {stats?.apiKeys.quota ? (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">API Quota Exceeded</p>
              <p className="text-xs text-amber-600 mt-0.5">{stats.apiKeys.quota} key(s) exceeded. Workflow may fail. Go to Settings → API Keys to reset.</p>
            </div>
            <Link href="/settings" className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors">
              Fix Now <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ) : null}

        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm animate-pulse">
                <div className="h-3 bg-slate-200 rounded w-2/3 mb-4" />
                <div className="h-8 bg-slate-200 rounded w-1/3 mb-2" />
                <div className="h-2 bg-slate-100 rounded w-1/2" />
              </div>
            ))
          ) : [
            { label: 'Videos Rendered', value: stats?.videos.done ?? 0, sub: `${stats?.videos.pending ?? 0} pending in queue`, icon: Film, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', trend: '+12%' },
            { label: 'TikTok Uploads', value: stats?.upload.tiktok_uploaded ?? 0, sub: `${stats?.upload.tiktok_pending ?? 0} scheduled today`, icon: TikTokIcon, iconBg: 'bg-slate-50', iconColor: 'text-slate-900', trend: 'STABLE' },
            { label: 'Facebook Reels', value: stats?.upload.facebook_uploaded ?? 0, sub: `${stats?.upload.facebook_pending ?? 0} pending approval`, icon: FacebookIcon, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', trend: '+8%' },
            { label: 'Threads Posts', value: stats?.upload.threads_uploaded ?? 0, sub: `${stats?.upload.threads_pending ?? 0} pending`, icon: ThreadsIcon, iconBg: 'bg-slate-50', iconColor: 'text-slate-800', trend: 'LOW' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.trend}</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs font-medium text-slate-400 mt-1">{s.label}</p>
              <p className="text-[11px] text-slate-300 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-5">
          {/* Quick Actions */}
          <div className="col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800">Quick Actions</p>
            </div>
            <div className="p-3 space-y-1">
              {[
                { href: '/workflow', icon: GitBranch, label: 'Run Full Workflow', desc: 'Automate tasks', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
                { href: '/editor',   icon: Film,      label: 'Video Editor',      desc: 'Modify clips',   iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
                { href: '/upload',   icon: ArrowUpToLine, label: 'Upload Manager', desc: 'Post to social', iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
                { href: '/settings', icon: Key,       label: 'API Keys',          desc: 'Configure app',  iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                  <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}>
                    <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">{item.desc}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Videos */}
          <div className="col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Recent Videos</p>
              <Link href="/upload" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recentVideos.length === 0 ? (
              <div className="py-12 text-center">
                <Film className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No videos yet</p>
                <p className="text-xs text-slate-300 mt-0.5">Run the workflow to get started</p>
              </div>
            ) : (
              <table className="data-table w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-left py-3 px-5">Video Title</th>
                    <th className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-left py-3 px-4">Date Created</th>
                    <th className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center py-3 px-4">Channels</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVideos.map(v => (
                    <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Film className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <span className="text-sm font-medium text-slate-800">{truncate(v.title, 42)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(v.created_at).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">{platformStatus(v.tiktok)}</div>
                          <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center">{platformStatus(v.facebook)}</div>
                          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">{platformStatus(v.threads)}</div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* API Status */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center">
                <Zap className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">API Infrastructure</p>
                <p className="text-xs text-slate-400">
                  {stats?.apiKeys.active ?? 0} active keys · {stats?.apiKeys.quota ?? 0} quota exceeded
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(stats?.apiKeys.quota ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700">
                  <AlertTriangle className="w-3 h-3" />EXCEEDED
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" />ACTIVE
              </span>
              <Link href="/settings"
                className="ml-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                <TrendingUp className="w-3 h-3" />Manage
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
