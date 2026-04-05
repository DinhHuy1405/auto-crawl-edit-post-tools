'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Scissors, Play, Square, Download, Trash2,
  Link as LinkIcon, Youtube, Clock, Film,
  ChevronDown, ChevronRight, FolderOpen, RefreshCw,
  Plus, HardDrive,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LogLine { message: string; level: string }
interface ClipFile { name: string; path: string; size: number }
interface ClipJob {
  id: string
  dir: string
  clipsDir: string
  clips: ClipFile[]
  clipCount: number
}

// ─── Log level styles ─────────────────────────────────────────────────────────
const logStyle = (level: string) => {
  switch (level) {
    case 'error':   return 'text-red-400'
    case 'success': return 'text-green-400'
    case 'warning': return 'text-yellow-400'
    case 'info':    return 'text-blue-300'
    case 'dim':     return 'text-slate-500'
    default:        return 'text-slate-300'
  }
}

// ─── Duration presets ─────────────────────────────────────────────────────────
const DURATION_PRESETS = [
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: '2m',  value: 120 },
  { label: '3m',  value: 180 },
  { label: '5m',  value: 300 },
]

// ─── Source type detection ────────────────────────────────────────────────────
function detectSourceType(url: string): 'youtube' | 'facebook' | 'id' | 'other' {
  if (!url) return 'other'
  if (url.match(/^[a-zA-Z0-9_-]{11}$/)) return 'id'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook'
  return 'other'
}

// ─── Format bytes ─────────────────────────────────────────────────────────────
function fmtSize(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClipCutterPage() {
  // Form state
  const [url, setUrl]               = useState('')
  const [duration, setDuration]     = useState(60)
  const [customDur, setCustomDur]   = useState('')
  const [startTime, setStartTime]   = useState('')
  const [endTime, setEndTime]       = useState('')
  const [maxClips, setMaxClips]     = useState(0)
  const [jobTitle, setJobTitle]     = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Runtime state
  const [running, setRunning]   = useState(false)
  const [logs, setLogs]         = useState<LogLine[]>([])
  const [done, setDone]         = useState(false)
  const [result, setResult]     = useState<{
    clips?: ClipFile[]
    clipCount?: number
    outputDir?: string
    jobTitle?: string
  } | null>(null)
  const [jobs, setJobs]         = useState<ClipJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  const runIdRef  = useRef(`cc_${Date.now()}`)
  const logEndRef = useRef<HTMLDivElement>(null)

  const sourceType = detectSourceType(url)

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Load previous jobs on mount
  useEffect(() => { fetchJobs() }, [])

  const fetchJobs = async () => {
    setLoadingJobs(true)
    try {
      const res = await fetch('/api/clip-cutter')
      const data = await res.json()
      setJobs(data.jobs ?? [])
    } catch { /* ignore */ }
    finally { setLoadingJobs(false) }
  }

  const addLog = useCallback((msg: string, level: string) => {
    setLogs(prev => [...prev, { message: msg, level }])
  }, [])

  // ─── Start cutting ─────────────────────────────────────────────────────────
  const startCutting = async () => {
    if (!url.trim()) { toast.error('Nhập URL hoặc YouTube ID'); return }
    if (running) return

    const actualDuration = customDur ? parseInt(customDur, 10) : duration

    setRunning(true)
    setDone(false)
    setLogs([])
    setResult(null)
    runIdRef.current = `cc_${Date.now()}`

    const title = jobTitle.trim() || `clips_${Date.now()}`

    try {
      const res = await fetch('/api/clip-cutter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          duration: actualDuration,
          startTime: startTime || undefined,
          endTime:   endTime   || undefined,
          maxClips,
          runId:     runIdRef.current,
          title,
        }),
      })

      if (!res.body) throw new Error('No response stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        const text = decoder.decode(value)
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))
            if (ev.type === 'log') addLog(ev.message, ev.level)
            else if (ev.type === 'done') {
              setDone(true)
              if (ev.success && ev.result) {
                setResult(ev.result)
                toast.success(`✅ Tạo ${ev.result.clipCount} clips thành công!`)
                fetchJobs()
              } else {
                toast.error('Clip cutting thất bại')
              }
            }
          } catch {}
        }
      }
    } catch (err) {
      addLog(`Error: ${String(err)}`, 'error')
      toast.error('Lỗi kết nối')
    } finally {
      setRunning(false)
    }
  }

  // ─── Cancel ────────────────────────────────────────────────────────────────
  const cancelJob = async () => {
    await fetch(`/api/clip-cutter?runId=${runIdRef.current}`, { method: 'DELETE' })
    setRunning(false)
    addLog('⛔ Job cancelled', 'warning')
    toast('Job cancelled')
  }

  return (
    <main className="ml-64 min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <div className="border-b border-slate-200/70 bg-white px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-200">
            <Scissors className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Clip Cutter</h1>
            <p className="text-xs text-slate-400 mt-0.5">Cắt video dài thành nhiều clip ngắn từ YouTube / Facebook</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 grid grid-cols-[1fr_380px] gap-6">
        {/* ── LEFT: Config + Logs ── */}
        <div className="space-y-4">

          {/* Source input */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Nguồn video</h2>

            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {sourceType === 'youtube' ? (
                  <Youtube className="w-4 h-4 text-red-500" />
                ) : sourceType === 'facebook' ? (
                  <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">f</span>
                  </div>
                ) : sourceType === 'id' ? (
                  <Youtube className="w-4 h-4 text-red-400" />
                ) : (
                  <LinkIcon className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Dán link YouTube / Facebook hoặc YouTube ID (11 ký tự)"
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 bg-slate-50"
                disabled={running}
              />
            </div>

            {sourceType !== 'other' && url && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                {sourceType === 'id'
                  ? `YouTube ID → https://youtube.com/watch?v=${url}`
                  : sourceType === 'youtube' ? '✅ YouTube URL' : '✅ Facebook URL'}
              </p>
            )}
          </div>

          {/* Duration */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" /> Độ dài mỗi clip
            </h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {DURATION_PRESETS.map(p => (
                <button key={p.value}
                  onClick={() => { setDuration(p.value); setCustomDur('') }}
                  disabled={running}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                    duration === p.value && !customDur
                      ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-orange-400 hover:text-orange-600',
                  )}
                >
                  {p.label}
                </button>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={customDur}
                  onChange={e => { setCustomDur(e.target.value); setDuration(0) }}
                  placeholder="Tùy chỉnh (giây)"
                  disabled={running}
                  className="w-36 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                />
                <span className="text-xs text-slate-400">giây</span>
              </div>
            </div>
          </div>

          {/* Advanced */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span>Tùy chọn nâng cao</span>
              {showAdvanced ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {showAdvanced && (
              <div className="px-5 pb-5 grid grid-cols-2 gap-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 mt-3">Bắt đầu từ (hh:mm:ss)</label>
                  <input
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    placeholder="00:00:00"
                    disabled={running}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 mt-3">Kết thúc tại (hh:mm:ss)</label>
                  <input
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    placeholder="Mặc định: hết video"
                    disabled={running}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Số clip tối đa (0 = không giới hạn)</label>
                  <input
                    type="number"
                    value={maxClips}
                    onChange={e => setMaxClips(parseInt(e.target.value, 10) || 0)}
                    min={0}
                    disabled={running}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Tên job (tuỳ chọn)</label>
                  <input
                    value={jobTitle}
                    onChange={e => setJobTitle(e.target.value)}
                    placeholder="clips_xxxxxxx"
                    disabled={running}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={running ? cancelJob : startCutting}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm',
                running
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200',
              )}
            >
              {running ? (
                <><Square className="w-4 h-4" /> Dừng lại</>
              ) : (
                <><Scissors className="w-4 h-4" /> Bắt đầu cắt</>
              )}
            </button>
            {!running && logs.length === 0 && (
              <button
                onClick={() => { setLogs([]); setResult(null); setDone(false) }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all"
              >
                <RefreshCw className="w-4 h-4" /> Reset
              </button>
            )}
          </div>

          {/* Logs */}
          {logs.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Logs</span>
                {running && (
                  <span className="flex items-center gap-1.5 text-xs text-orange-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                    Running...
                  </span>
                )}
                {done && (
                  <span className="flex items-center gap-1.5 text-xs text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Done
                  </span>
                )}
              </div>
              <div className="p-4 h-64 overflow-y-auto font-mono text-[11px] space-y-0.5">
                {logs.map((l, i) => (
                  <div key={i} className={logStyle(l.level)}>{l.message}</div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* Result clips */}
          {result?.clips && result.clips.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">
                  🎬 {result.clips.length} clips đã tạo
                </h3>
                <span className="text-xs text-slate-400 font-mono truncate max-w-xs">{result.outputDir}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {result.clips.map((clip, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                      <Film className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{clip.name}</p>
                      <p className="text-xs text-slate-400">{fmtSize(clip.size)}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-400">#{String(i + 1).padStart(2, '0')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Previous jobs ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-slate-400" /> Các job trước
              </h2>
              <button
                onClick={fetchJobs}
                disabled={loadingJobs}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', loadingJobs && 'animate-spin')} />
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <HardDrive className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Chưa có job nào</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                {jobs.map(job => (
                  <div key={job.id}>
                    <button
                      onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                        <Scissors className="w-3.5 h-3.5 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{job.id}</p>
                        <p className="text-xs text-slate-400">{job.clipCount} clips</p>
                      </div>
                      {expandedJob === job.id
                        ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    </button>

                    {expandedJob === job.id && job.clips.length > 0 && (
                      <div className="bg-slate-50 px-4 py-2 space-y-1.5">
                        {job.clips.map((clip, i) => (
                          <div key={i} className="flex items-center gap-2 py-1">
                            <Film className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-600 flex-1 truncate">{clip.name}</span>
                            <span className="text-xs text-slate-400">{fmtSize(clip.size)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="bg-orange-50 rounded-xl border border-orange-100 p-4">
            <h3 className="text-xs font-semibold text-orange-700 mb-2">💡 Hướng dẫn</h3>
            <ul className="text-xs text-orange-600 space-y-1">
              <li>• Dán link YouTube / Facebook đầy đủ</li>
              <li>• Hoặc nhập YouTube ID (11 ký tự, vd: <code className="font-mono bg-orange-100 px-1 rounded">dQw4w9WgXcQ</code>)</li>
              <li>• Chọn độ dài mỗi clip (mặc định 60 giây)</li>
              <li>• Có thể giới hạn số clip đầu ra</li>
              <li>• Clips lưu tại <code className="font-mono bg-orange-100 px-1 rounded">temp-clips/</code></li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
