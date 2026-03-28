'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Play, Square, RotateCcw, FastForward,
  Loader2, Plus, Link as LinkIcon,
  Pencil, Trash2, Check, X, Video, EyeOff, Monitor, MonitorOff,
} from 'lucide-react'
import {
  TikTokIcon, FacebookIcon, ThreadsIcon, YouTubeIcon,
} from '@/components/platform-icons'

type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'
interface Step { id: string; label: string; description: string; status: StepStatus; duration?: number }
interface LogLine { message: string; level: string; ts: string }
interface Channel { id: string; label: string; enabled: boolean; channelId?: string }
interface UploadQueueVideo {
  id: string; title: string; video_name: string; file_path: string
  skip?: boolean; upload_date?: string; created_at: string; status: string
  threads: { uploaded: boolean }; tiktok: { uploaded: boolean }; facebook: { uploaded: boolean }
}

const STEPS: Omit<Step, 'status'>[] = [
  { id: 'crawl',          label: 'Crawl Videos',    description: 'Tải video từ YouTube hôm qua'        },
  { id: 'news',           label: 'Generate News',    description: 'Gemini AI tạo nội dung từ subtitle'  },
  { id: 'voice',          label: 'Generate Voice',   description: 'Gemini TTS → giọng đọc WAV'          },
  { id: 'prepare',        label: 'Prepare Videos',   description: 'Tạo danh sách videos.json'           },
  { id: 'render',         label: 'Render Videos',    description: 'FFmpeg trộn video + audio + overlay' },
  { id: 'prepare-upload', label: 'Prepare Upload',   description: 'Chuẩn bị database upload'            },
  { id: 'upload',         label: 'Upload Platforms', description: 'Upload to platforms'                  },
]

const PLATFORM_META = [
  { id: 'tiktok',   label: 'TikTok',   Icon: TikTokIcon,   iconColor: 'text-slate-900', bg: 'bg-slate-900/5',   activeBg: 'bg-slate-900',   activeBorder: 'border-slate-700' },
  { id: 'facebook', label: 'Facebook', Icon: FacebookIcon, iconColor: 'text-blue-600',  bg: 'bg-blue-50',       activeBg: 'bg-blue-600',    activeBorder: 'border-blue-500'  },
  { id: 'threads',  label: 'Threads',  Icon: ThreadsIcon,  iconColor: 'text-slate-800', bg: 'bg-slate-100',     activeBg: 'bg-slate-800',   activeBorder: 'border-slate-600' },
]

// ─── Channel pill editor ───────────────────────────────────────────────────────
function ChannelPills({ channels, onChange, disabled }: {
  channels: Channel[]; onChange: (ch: Channel[]) => void; disabled: boolean
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editChannelId, setEditChannelId] = useState('')
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newChannelId, setNewChannelId] = useState('')

  const toggle = (i: number) => {
    if (disabled) return
    const next = [...channels]
    next[i] = { ...next[i], enabled: !next[i].enabled }
    onChange(next)
  }
  const startEdit = (i: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingIdx(i)
    setEditLabel(channels[i].label)
    setEditChannelId(channels[i].channelId ?? '')
  }
  const confirmEdit = (i: number) => {
    if (!editLabel.trim()) { setEditingIdx(null); return }
    const next = [...channels]
    next[i] = { ...next[i], label: editLabel.trim(), id: editLabel.trim(), channelId: editChannelId.trim() || undefined }
    onChange(next); setEditingIdx(null)
  }
  const remove = (i: number, e: React.MouseEvent) => {
    e.stopPropagation(); onChange(channels.filter((_, idx) => idx !== i))
  }
  const addChannel = () => {
    const label = newLabel.trim()
    if (!label) return
    onChange([...channels, { id: label, label, enabled: true, channelId: newChannelId.trim() || undefined }])
    setNewLabel(''); setNewChannelId(''); setAdding(false)
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {channels.map((ch, i) => (
        <div key={i} className={cn(
          'group flex items-center rounded-lg border transition-colors',
          ch.enabled ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-slate-200 text-slate-500',
          !disabled && 'cursor-pointer',
        )}>
          {editingIdx === i ? (
            <div className="flex flex-col gap-1 px-2 py-1.5">
              <input autoFocus value={editLabel} onChange={e => setEditLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setEditingIdx(null) }}
                placeholder="Channel name"
                className="w-44 h-5 px-1.5 text-[11px] bg-white border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400/40"
                onClick={e => e.stopPropagation()} />
              <div className="flex items-center gap-1">
                <input value={editChannelId} onChange={e => setEditChannelId(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmEdit(i); if (e.key === 'Escape') setEditingIdx(null) }}
                  placeholder="UCxxxxx (optional)"
                  className="w-44 h-5 px-1.5 text-[11px] bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400/40 font-mono"
                  onClick={e => e.stopPropagation()} />
                <button onClick={() => confirmEdit(i)} className="text-green-600 hover:bg-green-50 rounded p-0.5"><Check className="w-3 h-3" /></button>
                <button onClick={() => setEditingIdx(null)} className="text-slate-400 hover:bg-slate-100 rounded p-0.5"><X className="w-3 h-3" /></button>
              </div>
              {!editChannelId && (
                <span className="text-[9px] text-amber-500">⚠ Không có Channel ID → dùng Search API (kém chính xác)</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5" onClick={() => toggle(i)}>
              <input type="checkbox" checked={ch.enabled} onChange={() => toggle(i)}
                className="accent-red-500 w-3.5 h-3.5 pointer-events-none" onClick={e => e.stopPropagation()} />
              <div className="flex flex-col">
                <span className="text-[11px] font-medium leading-tight">{ch.label}</span>
                {ch.channelId
                  ? <span className="text-[9px] font-mono opacity-50 leading-tight">{ch.channelId.slice(0, 12)}…</span>
                  : <span className="text-[9px] text-amber-500 leading-tight">no ID</span>
                }
              </div>
              {!disabled && (
                <div className="hidden group-hover:flex items-center gap-0.5 ml-0.5">
                  <button onClick={e => startEdit(i, e)} className="p-0.5 text-slate-400 hover:text-slate-700 rounded"><Pencil className="w-2.5 h-2.5" /></button>
                  <button onClick={e => remove(i, e)} className="p-0.5 text-slate-300 hover:text-red-500 rounded"><Trash2 className="w-2.5 h-2.5" /></button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="flex flex-col gap-1 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
          <input autoFocus placeholder="Channel name" value={newLabel} onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setAdding(false); setNewLabel(''); setNewChannelId('') } }}
            className="w-44 h-5 px-1.5 text-[11px] bg-white border border-blue-300 rounded focus:outline-none" />
          <div className="flex items-center gap-1">
            <input placeholder="UCxxxxx (optional)" value={newChannelId} onChange={e => setNewChannelId(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addChannel(); if (e.key === 'Escape') { setAdding(false); setNewLabel(''); setNewChannelId('') } }}
              className="w-44 h-5 px-1.5 text-[11px] font-mono bg-white border border-slate-200 rounded focus:outline-none" />
            <button onClick={addChannel} className="text-green-600 hover:bg-green-50 rounded p-0.5"><Check className="w-3 h-3" /></button>
            <button onClick={() => { setAdding(false); setNewLabel(''); setNewChannelId('') }} className="text-slate-400 rounded p-0.5"><X className="w-3 h-3" /></button>
          </div>
          <span className="text-[9px] text-slate-400">Channel ID giúp crawl chính xác hơn</span>
        </div>
      ) : !disabled && (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 bg-white border border-dashed border-slate-300 rounded-lg hover:border-slate-400 hover:text-slate-700 transition-colors">
          <Plus className="w-3 h-3" /> Add
        </button>
      )}
    </div>
  )
}

export default function WorkflowPage() {
  const [steps, setSteps] = useState<Step[]>(STEPS.map(s => ({ ...s, status: 'pending' })))
  const [logs, setLogs] = useState<LogLine[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [runId] = useState(() => `run_${Date.now()}`)
  const [channels, setChannels] = useState<Channel[]>([])
  const [platforms, setPlatforms] = useState<string[]>(['tiktok', 'threads', 'facebook'])
  const [manualUrl, setManualUrl] = useState('')
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [uploadQueue, setUploadQueue] = useState<UploadQueueVideo[]>([])
  const [showBrowser, setShowBrowser] = useState(true)
  const [uploadDate, setUploadDate] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })

  const logScrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const startTimeRef = useRef<Record<string, number>>({})

  // Load config once
  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then((cfg) => {
      setConfig(cfg)
      const cfgChannels = (cfg?.crawler as Record<string, unknown>)?.channels
      if (Array.isArray(cfgChannels) && cfgChannels.length > 0) setChannels(cfgChannels as Channel[])
      const cfgPlatforms = (cfg?.upload as Record<string, unknown>)?.platforms
      if (Array.isArray(cfgPlatforms) && cfgPlatforms.length > 0) setPlatforms(cfgPlatforms as string[])
      setConfigLoaded(true)
    }).catch(() => { setConfigLoaded(true) })
  }, [])

  const fetchUploadQueue = useCallback(() => {
    fetch(`/api/upload?date=${uploadDate}`).then(r => r.json()).then(data => {
      if (Array.isArray(data.videos)) setUploadQueue(data.videos)
      if (typeof data.showBrowser === 'boolean') setShowBrowser(data.showBrowser)
    }).catch(() => {})
  }, [uploadDate])

  useEffect(() => { fetchUploadQueue() }, [fetchUploadQueue])

  const toggleShowBrowser = useCallback(async () => {
    const next = !showBrowser
    setShowBrowser(next)
    await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ showBrowser: next }) })
  }, [showBrowser])

  const toggleSkipVideo = useCallback(async (id: string, skip: boolean) => {
    await fetch('/api/upload', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, skip }) })
    setUploadQueue(prev => prev.map(v => v.id === id ? { ...v, skip } : v))
  }, [])

  const handleChannelsChange = useCallback((newChannels: Channel[]) => {
    setChannels(newChannels)
    setConfig(prev => {
      if (!prev) return prev
      const updated = { ...prev, crawler: { ...(prev.crawler as Record<string, unknown>), channels: newChannels } }
      fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
      return updated
    })
  }, [])

  const togglePlatform = useCallback((pid: string) => {
    setPlatforms(prev => {
      const next = prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
      setConfig(cfg => {
        if (!cfg) return cfg
        const updated = { ...cfg, upload: { ...(cfg.upload as Record<string, unknown>), platforms: next } }
        fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
        return updated
      })
      return next
    })
  }, [])

  const setTool = (useJDownloader: boolean) => {
    setConfig(prev => {
      if (!prev) return prev
      const updated = { ...prev, crawler: { ...(prev.crawler as Record<string, unknown>), useJDownloader } }
      fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
      return updated
    })
  }

  const useJDownloader = (config?.crawler as Record<string, unknown>)?.useJDownloader === true

  // Auto-scroll logs: just scroll the container to bottom on new logs
  useEffect(() => {
    const el = logScrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [logs])

  const addLog = useCallback((msg: string, level = 'default') => {
    const ts = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [...prev.slice(-600), { message: msg, level, ts }])
  }, [])

  const updStep = useCallback((id: string, status: StepStatus, dur?: number) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, duration: dur } : s))
  }, [])

  const runStep = useCallback(async (stepId: string, force = false): Promise<boolean> => {
    updStep(stepId, 'running')
    startTimeRef.current[stepId] = Date.now()
    addLog(`▶ ${STEPS.find(s => s.id === stepId)?.label}${force ? ' (force)' : ''}`, 'info')
    try {
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const res = await fetch('/api/workflow/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepId, runId, force, ...(stepId === 'upload' ? { date: uploadDate } : {}) }), signal: ctrl.signal,
      })
      if (!res.ok || !res.body) { updStep(stepId, 'error'); return false }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let ok = false
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
            if (ev.type === 'log') addLog(ev.message, ev.level || 'default')
            if (ev.type === 'done') {
              ok = ev.success
              updStep(stepId, ok ? 'done' : 'error', Math.round((Date.now() - startTimeRef.current[stepId]) / 1000))
              // Refresh upload queue after prepare-upload step
              if (stepId === 'prepare-upload' && ok) fetchUploadQueue()
            }
          } catch {}
        }
      }
      return ok
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') { updStep(stepId, 'skipped'); return false }
      updStep(stepId, 'error'); addLog(`Error: ${String(err)}`, 'error'); return false
    }
  }, [runId, addLog, updStep, fetchUploadQueue])

  const runFull = useCallback(async () => {
    setIsRunning(true); setLogs([]); setSteps(STEPS.map(s => ({ ...s, status: 'pending' })))
    addLog('Starting Full Workflow', 'info')
    for (const step of STEPS) {
      const ok = await runStep(step.id)
      if (!ok) { addLog(`Stopped at: ${step.label}`, 'error'); toast.error(`Stopped at: ${step.label}`); break }
    }
    setIsRunning(false); addLog('Workflow finished', 'info'); toast.success('Workflow complete!')
  }, [runStep, addLog])

  const runSingle = useCallback(async (id: string) => {
    const isRenderStep = ['prepare', 'render'].includes(id)
    const currentStatus = steps.find(s => s.id === id)?.status
    const force = isRenderStep && currentStatus === 'done'
    setIsRunning(true)
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status: 'pending' } : s))
    await runStep(id, force)
    setIsRunning(false)
    toast.success(`Step completed: ${STEPS.find(s => s.id === id)?.label}`)
  }, [runStep, steps])

  const runFrom = useCallback(async (fromId: string, force = false) => {
    const startIdx = STEPS.findIndex(s => s.id === fromId)
    if (startIdx < 0) return
    setIsRunning(true)
    setLogs([])
    // Reset all steps from startIdx onwards
    setSteps(prev => prev.map((s, i) => i >= startIdx ? { ...s, status: 'pending' } : s))
    addLog(`Starting from: ${STEPS[startIdx].label}${force ? ' (force re-render)' : ''}`, 'info')
    for (let i = startIdx; i < STEPS.length; i++) {
      // Pass force only to prepare+render steps
      const isRenderStep = ['prepare', 'render'].includes(STEPS[i].id)
      const ok = await runStep(STEPS[i].id, force && isRenderStep)
      if (!ok) { addLog(`Stopped at: ${STEPS[i].label}`, 'error'); toast.error(`Stopped at: ${STEPS[i].label}`); break }
    }
    setIsRunning(false); addLog('Workflow finished', 'info'); toast.success('Workflow complete!')
  }, [runStep, addLog])

  const stop = () => {
    abortRef.current?.abort()
    fetch(`/api/workflow/run?runId=${runId}`, { method: 'DELETE' }).catch(() => {})
    setIsRunning(false); addLog('Stopped by user', 'warning'); toast.warning('Workflow stopped')
  }

  const reset = () => { setSteps(STEPS.map(s => ({ ...s, status: 'pending' }))); setLogs([]) }
  const done = steps.filter(s => s.status === 'done').length


  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Top Header */}
      <header className="flex items-center justify-between px-8 h-16 bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 shadow-sm shadow-slate-200/50">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Workflow</h2>
          <p className="text-xs text-slate-400">Automated pipeline: Crawl → Edit → Upload</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={reset} disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-50 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />Reset
          </button>
          {isRunning ? (
            <button onClick={stop}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shadow-md shadow-red-200">
              <Square className="w-3.5 h-3.5 fill-white" />Stop
            </button>
          ) : (
            <button onClick={runFull}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg hover:opacity-90 transition-all shadow-md shadow-blue-200 active:scale-95">
              <Play className="w-3.5 h-3.5 fill-white" />Run Full Workflow
            </button>
          )}
        </div>
      </header>
      <div className="flex-1 p-8 space-y-5">

      {/* Config row: Crawl Sources + Upload Platforms */}
      <div className="grid grid-cols-2 gap-4">
        {/* Crawl Sources */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <YouTubeIcon className="text-red-500" size={14} />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Crawl Sources</p>
            <div className="flex-1" />
            {configLoaded && config && (
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-slate-200">
                <button onClick={() => setTool(false)}
                  className={cn('px-2 py-0.5 rounded text-[10px] font-bold transition-all', !useJDownloader ? 'bg-red-50 text-red-700 border border-red-200' : 'text-slate-400 hover:text-slate-600')}>
                  yt-dlp
                </button>
                <button onClick={() => setTool(true)}
                  className={cn('px-2 py-0.5 rounded text-[10px] font-bold transition-all', useJDownloader ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-slate-400 hover:text-slate-600')}>
                  JDownloader
                </button>
              </div>
            )}
          </div>
          <div className="p-3 space-y-2.5">
            {!configLoaded ? (
              <div className="flex gap-2">
                {[1, 2, 3].map(i => <div key={i} className="h-7 w-28 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <ChannelPills channels={channels} onChange={handleChannelsChange} disabled={isRunning} />
            )}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <input type="text" value={manualUrl} onChange={e => setManualUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (() => { if (!manualUrl.trim()) return; toast.success('URL added'); setManualUrl('') })()}
                  placeholder="Paste YouTube / TikTok URL to manual crawl..."
                  className="w-full h-8 pl-8 pr-3 text-[11px] bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400" />
              </div>
              <button onClick={() => { if (!manualUrl.trim()) return; toast.success('URL added'); setManualUrl('') }}
                className="h-8 px-3 flex items-center gap-1 text-[11px] font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors shrink-0">
                <Plus className="w-3.5 h-3.5" /> Add URL
              </button>
            </div>
          </div>
        </div>

        {/* Upload Platforms */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <TikTokIcon size={13} className="text-slate-700" />
              <FacebookIcon size={13} className="text-blue-600" />
              <ThreadsIcon size={13} className="text-slate-700" />
            </div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Upload Platforms</p>
            <button
              onClick={toggleShowBrowser}
              disabled={isRunning}
              title={showBrowser ? 'Browser đang hiện — click để ẩn' : 'Browser đang ẩn — click để hiện'}
              className={cn(
                'ml-auto flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors',
                showBrowser
                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100',
                isRunning && 'opacity-50 cursor-not-allowed'
              )}
            >
              {showBrowser ? <Monitor className="w-3 h-3" /> : <MonitorOff className="w-3 h-3" />}
              {showBrowser ? 'Browser: ON' : 'Browser: OFF'}
            </button>
          </div>
          <div className="p-3">
            <div className="flex gap-2 mb-2.5">
              {PLATFORM_META.map(p => {
                const active = platforms.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    disabled={isRunning}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all font-medium text-[11px]',
                      active
                        ? 'border-blue-400 bg-blue-50 text-blue-800 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600',
                      isRunning && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <p.Icon size={18} className={active ? p.iconColor : 'text-slate-300'} />
                    <span>{p.label}</span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-slate-400">
              {platforms.length === 0
                ? 'No platforms selected — upload step will be skipped'
                : `Will upload to: ${platforms.join(', ')}`}
            </p>
          </div>
        </div>
      </div>

      {/* Upload Video Queue */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Video className="w-4 h-4 text-slate-400" />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Upload Queue</p>
            <input
              type="date"
              value={uploadDate}
              onChange={e => setUploadDate(e.target.value)}
              disabled={isRunning}
              className="ml-2 px-2 py-0.5 text-[11px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
            />
            <span className="ml-auto text-[10px] text-slate-400">
              {uploadQueue.filter(v => !v.skip).length}/{uploadQueue.length} video
            </span>
            <button onClick={fetchUploadQueue} className="text-[10px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors">
              Refresh
            </button>
          </div>
          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {uploadQueue.map(v => (
              <div key={v.id} className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors', v.skip ? 'bg-slate-50 opacity-50' : 'bg-white hover:bg-slate-50/60')}>
                <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', v.skip ? 'bg-slate-300' : 'bg-green-400')} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-700 truncate">{v.title || v.video_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn('text-[9px] px-1 rounded', v.threads?.uploaded ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400')}>Threads</span>
                    <span className={cn('text-[9px] px-1 rounded', v.tiktok?.uploaded ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400')}>TikTok</span>
                    <span className={cn('text-[9px] px-1 rounded', v.facebook?.uploaded ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400')}>Facebook</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleSkipVideo(v.id, !v.skip)}
                  title={v.skip ? 'Bỏ qua — click để bật lại' : 'Click để bỏ qua video này'}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors shrink-0',
                    v.skip
                      ? 'bg-slate-100 text-slate-500 hover:bg-green-50 hover:text-green-700'
                      : 'bg-red-50 text-red-500 hover:bg-red-100'
                  )}
                >
                  {v.skip ? <><Check className="w-3 h-3" />Bật lại</> : <><EyeOff className="w-3 h-3" />Bỏ qua</>}
                </button>
              </div>
            ))}
          </div>
          {uploadQueue.length === 0 && (
            <p className="px-4 py-4 text-[11px] text-slate-400 text-center">Không có video nào cần upload cho ngày {uploadDate}</p>
          )}
        </div>

      {/* System Pipeline — horizontal */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-8 py-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-800">System Pipeline</h3>
          <div className="flex items-center gap-3">
            {done > 0 && !isRunning && (
              <button
                onClick={() => runSingle('render')}
                title="Render lại — giữ nguyên videos.json và các video đã bỏ qua"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors">
                <RotateCcw className="w-3 h-3" />Re-render
              </button>
            )}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Active</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />Waiting</span>
            </div>
          </div>
        </div>
        <div className="relative">
          {/* Background connecting line */}
          <div className="absolute top-6 left-6 right-6 h-0.5 bg-slate-200 z-0" />
          {/* Progress line */}
          <div
            className="absolute top-6 left-6 h-0.5 bg-blue-500 z-0 transition-all duration-700"
            style={{ width: done > 0 ? `calc(${((done - 1) / (STEPS.length - 1)) * 100}% * ((100% - 3rem) / 100%))` : '0' }}
          />
          <div className="grid relative z-10" style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}>
            {steps.map((step) => {
              const isDone    = step.status === 'done'
              const isRun     = step.status === 'running'
              const isError   = step.status === 'error'
              const isSkipped = step.status === 'skipped'
              const canClick = !isRunning && !isRun
              return (
                <div key={step.id} className="text-center group relative">
                  <button
                    onClick={() => canClick ? runSingle(step.id) : undefined}
                    disabled={!canClick}
                    title={canClick ? (isDone ? `Re-run ${step.label}` : `Run ${step.label}`) : undefined}
                    className={cn(
                      'w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3 border-2 bg-white transition-all',
                      isDone    ? 'border-emerald-500 bg-emerald-50 text-emerald-600' :
                      isRun     ? 'border-blue-500 bg-blue-50 text-blue-600 animate-pulse' :
                      isError   ? 'border-red-400 bg-red-50 text-red-500' :
                      isSkipped ? 'border-amber-400 bg-amber-50 text-amber-500' :
                                  'border-slate-200 text-slate-400',
                      canClick && isDone    && 'hover:border-emerald-400 hover:bg-emerald-100 cursor-pointer',
                      canClick && isError   && 'hover:border-red-400 hover:bg-red-100 cursor-pointer',
                      canClick && isSkipped && 'hover:border-blue-300 hover:bg-blue-50 cursor-pointer',
                      canClick && !isDone && !isError && !isSkipped && 'hover:border-blue-300 hover:text-blue-500 cursor-pointer',
                      !canClick && 'cursor-not-allowed'
                    )}>
                    {isRun ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isDone ? (
                      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    ) : isError ? (
                      <span className="material-symbols-outlined text-xl">error</span>
                    ) : isSkipped ? (
                      <span className="material-symbols-outlined text-xl">warning</span>
                    ) : (
                      <span className="material-symbols-outlined text-xl">{{
                        crawl: 'travel_explore', news: 'auto_awesome', voice: 'mic',
                        prepare: 'auto_fix_high', render: 'movie_edit',
                        'prepare-upload': 'database', upload: 'upload_file',
                      }[step.id] ?? 'circle'}</span>
                    )}
                  </button>
                  <p className={cn(
                    'text-[11px] font-bold uppercase tracking-tight',
                    isRun ? 'text-blue-600' : isDone ? 'text-emerald-700' : isError ? 'text-red-500' : 'text-slate-400'
                  )}>{step.label}</p>
                  <p className={cn('text-[10px] mt-0.5',
                    isRun ? 'text-blue-400' : isDone ? 'text-emerald-500' : 'text-slate-300'
                  )}>
                    {isRun ? 'Running...' : isDone ? `${step.duration ?? ''}s` : isError ? 'Error' : 'Pending'}
                  </p>
                  
                  {/* Actions — visible on hover if idle */}
                  {canClick && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg py-1 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <button
                        onClick={e => { e.stopPropagation(); runSingle(step.id) }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Chạy lại bước này
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); runFrom(step.id, isDone) }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2"
                      >
                        <FastForward className="w-3.5 h-3.5" />
                        Chạy từ đây tới cuối
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4" style={{ height: 420 }}>
        {/* Logs — fixed height, scrolls internally */}
        <div className="section-card overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-slate-500">terminal</span>
              <span className="text-sm font-semibold text-slate-700">Execution Logs</span>
              {isRunning && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin ml-1" />}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const text = logs.map(l => `[${l.ts}] ${l.level.toUpperCase()} ${l.message}`).join('\n')
                  navigator.clipboard.writeText(text)
                  toast.success('Logs copied!')
                }}
                className="text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors tracking-wider">
                EXPORT
              </button>
              <button onClick={() => setLogs([])} className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors tracking-wider">
                CLEAR
              </button>
            </div>
          </div>
          <div
            ref={logScrollRef}
            className="font-mono text-xs leading-6 bg-white text-slate-700 overflow-y-auto p-6 flex-1 space-y-1.5"
          >
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <span className="material-symbols-outlined text-slate-200 text-4xl mb-2">terminal</span>
                <span className="text-slate-300 text-xs">Logs will stream here when workflow runs...</span>
              </div>
            ) : logs.map((l, i) => {
              const levelMap: Record<string, { text: string; cls: string }> = {
                error:   { text: 'ERROR',   cls: 'text-red-500' },
                warning: { text: 'WARN',    cls: 'text-amber-500' },
                success: { text: 'SUCCESS', cls: 'text-emerald-600' },
                info:    { text: 'INFO',    cls: 'text-blue-500' },
              }
              const lbl = levelMap[l.level] ?? { text: 'LOG', cls: 'text-slate-400' }
              return (
                <div key={i} className="flex gap-4">
                  <span className="text-slate-400 w-20 shrink-0">[{l.ts}]</span>
                  <span className={cn('font-bold w-14 shrink-0', lbl.cls)}>{lbl.text}</span>
                  <span className="text-slate-700 opacity-80">{l.message}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      </div>{/* end flex-1 p-8 */}
    </div>
  )
}
