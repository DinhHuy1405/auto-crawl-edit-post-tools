'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Play, Square, Terminal, RotateCcw, GitBranch,
  CheckCircle2, XCircle, Loader2, Clock, ChevronRight,
  AlertCircle, Layers, Plus, Link as LinkIcon,
  Pencil, Trash2, Check, X,
} from 'lucide-react'
import {
  TikTokIcon, FacebookIcon, ThreadsIcon, YouTubeIcon,
} from '@/components/platform-icons'

type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'
interface Step { id: string; label: string; description: string; status: StepStatus; duration?: number }
interface LogLine { message: string; level: string; ts: string }
interface Channel { id: string; label: string; enabled: boolean; channelId?: string }

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

  const runStep = useCallback(async (stepId: string): Promise<boolean> => {
    updStep(stepId, 'running')
    startTimeRef.current[stepId] = Date.now()
    addLog(`▶ ${STEPS.find(s => s.id === stepId)?.label}`, 'info')
    try {
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const res = await fetch('/api/workflow/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepId, runId }), signal: ctrl.signal,
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
            }
          } catch {}
        }
      }
      return ok
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') { updStep(stepId, 'skipped'); return false }
      updStep(stepId, 'error'); addLog(`Error: ${String(err)}`, 'error'); return false
    }
  }, [runId, addLog, updStep])

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
    setIsRunning(true)
    await runStep(id)
    setIsRunning(false)
    toast.success(`Step completed: ${STEPS.find(s => s.id === id)?.label}`)
  }, [runStep])

  const stop = () => {
    abortRef.current?.abort()
    fetch(`/api/workflow/run?runId=${runId}`, { method: 'DELETE' }).catch(() => {})
    setIsRunning(false); addLog('Stopped by user', 'warning'); toast.warning('Workflow stopped')
  }

  const reset = () => { setSteps(STEPS.map(s => ({ ...s, status: 'pending' }))); setLogs([]) }
  const done = steps.filter(s => s.status === 'done').length
  const pct = Math.round((done / STEPS.length) * 100)

  const stepIcon = (s: Step) => {
    if (s.status === 'running') return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
    if (s.status === 'done')    return <CheckCircle2 className="w-4 h-4 text-green-500" />
    if (s.status === 'error')   return <XCircle className="w-4 h-4 text-red-500" />
    if (s.status === 'skipped') return <AlertCircle className="w-4 h-4 text-amber-500" />
    return <Clock className="w-4 h-4 text-slate-300" />
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title"><GitBranch className="w-5 h-5 text-blue-500" />Workflow Runner</h1>
          <p className="page-desc">Automated pipeline: Crawl → Edit → Upload</p>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} disabled={isRunning} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />Reset
          </button>
          {isRunning ? (
            <button onClick={stop} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors">
              <Square className="w-3.5 h-3.5 fill-white" />Stop
            </button>
          ) : (
            <button onClick={runFull} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              <Play className="w-3.5 h-3.5 fill-white" />Run Full Workflow
            </button>
          )}
        </div>
      </div>

      {/* Config row: Crawl Sources + Upload Platforms */}
      <div className="grid grid-cols-2 gap-4">
        {/* Crawl Sources */}
        <div className="section-card overflow-hidden">
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
        <div className="section-card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <TikTokIcon size={13} className="text-slate-700" />
              <FacebookIcon size={13} className="text-blue-600" />
              <ThreadsIcon size={13} className="text-slate-700" />
            </div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Upload Platforms</p>
            <span className="ml-auto text-[10px] text-slate-400">{platforms.length} selected</span>
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

      {/* Progress bar */}
      <div className="section-card p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-medium text-slate-700">Overall Progress</span>
          <span className="text-sm font-bold text-blue-600">{done}/{STEPS.length} steps · {pct}%</span>
        </div>
        <div className="workflow-progress">
          <div className="workflow-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4" style={{ height: 480 }}>
        {/* Steps */}
        <div className="col-span-2 section-card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
            <Layers className="w-4 h-4 text-slate-400" />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pipeline Steps</p>
          </div>
          <div className="p-2 space-y-0.5 overflow-y-auto flex-1">
            {steps.map((step, i) => (
              <div key={step.id} className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-all',
                step.status === 'running' ? 'step-active-pulse border border-blue-200' :
                step.status === 'done'    ? 'bg-green-50/60' :
                step.status === 'error'   ? 'bg-red-50/60' : ''
              )}>
                <span className="text-xs font-mono text-slate-300 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', step.status === 'running' ? 'text-blue-700' : 'text-slate-800')}>{step.label}</p>
                  <p className="text-xs text-slate-400 truncate">{step.description}</p>
                  {step.id === 'upload' && platforms.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      {platforms.includes('tiktok')   && <TikTokIcon   size={10} className="text-slate-500" />}
                      {platforms.includes('facebook') && <FacebookIcon size={10} className="text-blue-500" />}
                      {platforms.includes('threads')  && <ThreadsIcon  size={10} className="text-slate-600" />}
                    </div>
                  )}
                  {step.duration !== undefined && <p className="text-[10px] text-slate-400 mt-0.5">{step.duration}s</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {stepIcon(step)}
                  {step.status === 'pending' && !isRunning && (
                    <button onClick={() => runSingle(step.id)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logs — fixed height, scrolls internally */}
        <div className="col-span-3 section-card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Live Logs</p>
            </div>
            <div className="flex items-center gap-2">
              {isRunning && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', isRunning ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}>
                {isRunning ? 'Running...' : 'Idle'}
              </span>
            </div>
          </div>
          <div
            ref={logScrollRef}
            className="font-mono text-[11px] leading-5 bg-slate-950 text-slate-300 overflow-y-auto p-4 flex-1"
          >
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Terminal className="w-8 h-8 text-slate-700 opacity-20 mb-2" />
                <span className="text-slate-600 text-xs">Logs will stream here when workflow runs...</span>
              </div>
            ) : logs.map((l, i) => (
              <span key={i} className={cn('log-line', l.level)}>
                {l.ts && <span className="text-slate-600 mr-2">[{l.ts}]</span>}
                {l.message}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Individual step runner */}
      <div className="section-card p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Run Individual Steps</p>
        <div className="flex flex-wrap gap-2">
          {STEPS.map(step => (
            <button key={step.id} disabled={isRunning} onClick={() => runSingle(step.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 transition-colors">
              {step.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
