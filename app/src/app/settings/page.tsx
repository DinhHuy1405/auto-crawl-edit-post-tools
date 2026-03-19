'use client'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Save, RefreshCw, Key, Volume2, Film, Mic, Newspaper,
  Globe, Settings, CheckCircle2, XCircle, Clock, RotateCcw,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

interface AppConfig {
  paths: { outputDir: string; editVideoDir: string; socialUploadDir: string; crawlDir: string; templateDir: string; publicDir: string }
  audio: { volumes: { mainVideo: number; backgroundMusic: number; voiceNarration: number }; codec: string; bitrate: string; sampleRate: number }
  video: { codec: string; preset: string; resolution: string; maxDurationSec: number }
  templates: { mainVideo: string; templateVideo: string; backgroundMusic: string; logo: string }
  layout: { templateX: number; templateY: number; logoX: number; logoY: number; logoScale: string }
  tts: { provider: string; model: string; voice: string; language: string; sampleRate: number; audioFormat: string; style: string }
  newsGeneration: { provider: string; model: string; language: string; type: string; style: string; minWords: number; maxWords: number; tone: string }
  crawler: { useJDownloader: boolean; downloadFormat: string; minDurationSec: number; channels: { id: string; label: string; enabled: boolean }[] }
  upload: { platforms: string[]; showBrowser: boolean; timeout: number }
}
interface ApiKey {
  name: string; key: string; env: string
  status: 'active' | 'quota_exceeded' | 'standby'
  lastUsed: string | null; quotaExceededAt: string | null
}

type TabId = 'audio' | 'video' | 'tts' | 'news' | 'upload' | 'keys'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'audio',  label: 'Audio',    icon: Volume2   },
  { id: 'video',  label: 'Video',    icon: Film      },
  { id: 'tts',    label: 'TTS',      icon: Mic       },
  { id: 'news',   label: 'News',     icon: Newspaper },
  { id: 'upload', label: 'Upload',   icon: Globe     },
  { id: 'keys',   label: 'API Keys', icon: Key       },
]

const VOICES = ['fenrir', 'erinome', 'alnilam', 'sulafat', 'despina', 'aoede']
const GEMINI_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']

// ─── Native select ───────────────────────────────────────────────────────────
function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-9 px-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-800"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function NativeInput({ value, onChange, type = 'text' }: {
  value: string | number; onChange: (v: string) => void; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-9 px-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-800"
    />
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-slate-600 mb-1.5">{children}</label>
}

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [apiKeys, setApiKeys] = useState<{ gemini: ApiKey[]; tts: ApiKey[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('audio')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, keysRes] = await Promise.all([
        fetch('/api/config'), fetch('/api/config?type=api-keys'),
      ])
      setConfig(await cfgRes.json())
      setApiKeys(await keysRes.json())
    } catch { toast.error('Failed to load config') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const saveConfig = async () => {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch('/api/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) toast.success('Config saved!')
      else toast.error('Failed to save config')
    } catch { toast.error('Network error') }
    finally { setSaving(false) }
  }

  const resetQuota = async (service: string, name: string) => {
    await fetch('/api/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, name }),
    })
    load(); toast.success(`Reset quota for ${name}`)
  }

  const upd = (path: string, value: unknown) => {
    setConfig(prev => {
      if (!prev) return prev
      const next = JSON.parse(JSON.stringify(prev))
      const parts = path.split('.')
      let obj: Record<string, unknown> = next
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]] as Record<string, unknown>
      obj[parts[parts.length - 1]] = value
      return next
    })
  }

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title"><Settings className="w-5 h-5 text-blue-500" />Settings</h1>
          <p className="page-desc">Cấu hình workflow và API keys</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />Reload
          </button>
          <button onClick={saveConfig} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Config
          </button>
        </div>
      </div>

      <div className="section-card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors',
                tab === t.id
                  ? 'border-blue-500 text-blue-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60'
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {/* ─ Audio ─ */}
          {tab === 'audio' && (
            <div className="space-y-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Volume Mix</p>
              {[
                { key: 'mainVideo', label: 'Main Video Audio', desc: 'Âm thanh gốc từ video crawled', color: 'bg-blue-500' },
                { key: 'backgroundMusic', label: 'Background Music', desc: 'Nhạc nền (sound.mp3)', color: 'bg-green-500' },
                { key: 'voiceNarration', label: 'Voice Narration', desc: 'Giọng đọc AI (output.wav)', color: 'bg-purple-500' },
              ].map(({ key, label, desc, color }) => {
                const val = config.audio.volumes[key as keyof typeof config.audio.volumes]
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{label}</p>
                        <p className="text-xs text-slate-400">{desc}</p>
                      </div>
                      <span className="text-sm font-mono font-bold text-slate-700 w-10 text-right">{val.toFixed(2)}</span>
                    </div>
                    <div className="relative h-2 bg-slate-200 rounded-full">
                      <div className={`absolute left-0 top-0 h-full ${color} rounded-full transition-all`} style={{ width: `${(val / 2) * 100}%` }} />
                      <input type="range" min={0} max={2} step={0.05} value={val}
                        onChange={e => upd(`audio.volumes.${key}`, +e.target.value)}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-0.5"><span>0</span><span>2.0</span></div>
                  </div>
                )
              })}

              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Codec Settings</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <FieldLabel>Codec</FieldLabel>
                    <Select value={config.audio.codec} onChange={v => upd('audio.codec', v)}
                      options={['aac', 'mp3', 'opus'].map(c => ({ value: c, label: c }))} />
                  </div>
                  <div>
                    <FieldLabel>Bitrate</FieldLabel>
                    <Select value={config.audio.bitrate} onChange={v => upd('audio.bitrate', v)}
                      options={['128k', '192k', '256k', '320k'].map(b => ({ value: b, label: b }))} />
                  </div>
                  <div>
                    <FieldLabel>Sample Rate (Hz)</FieldLabel>
                    <NativeInput type="number" value={config.audio.sampleRate} onChange={v => upd('audio.sampleRate', +v)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─ Video ─ */}
          {tab === 'video' && (
            <div className="space-y-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">FFmpeg Encoding</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Video Codec</FieldLabel>
                  <Select value={config.video.codec} onChange={v => upd('video.codec', v)}
                    options={['libx264', 'libx265', 'h264_videotoolbox'].map(c => ({ value: c, label: c }))} />
                </div>
                <div>
                  <FieldLabel>Preset</FieldLabel>
                  <Select value={config.video.preset} onChange={v => upd('video.preset', v)}
                    options={['ultrafast','superfast','veryfast','faster','fast','medium','slow'].map(p => ({ value: p, label: p }))} />
                </div>
                <div>
                  <FieldLabel>Resolution</FieldLabel>
                  <Select value={config.video.resolution} onChange={v => upd('video.resolution', v)}
                    options={['1440p', '1080p', '720p'].map(r => ({ value: r, label: r }))} />
                </div>
                <div>
                  <FieldLabel>Max Duration (s)</FieldLabel>
                  <NativeInput type="number" value={config.video.maxDurationSec} onChange={v => upd('video.maxDurationSec', +v)} />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Layout Positions (px)</p>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    ['layout.templateX', 'Template X'], ['layout.templateY', 'Template Y'],
                    ['layout.logoX', 'Logo X'], ['layout.logoY', 'Logo Y'],
                  ] as [string, string][]).map(([path, lbl]) => (
                    <div key={path}>
                      <FieldLabel>{lbl}</FieldLabel>
                      <NativeInput type="number"
                        value={path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)[k], config) as number}
                        onChange={v => upd(path, +v)} />
                    </div>
                  ))}
                  <div>
                    <FieldLabel>Logo Scale (WxH)</FieldLabel>
                    <NativeInput value={config.layout.logoScale} onChange={v => upd('layout.logoScale', v)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─ TTS ─ */}
          {tab === 'tts' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Gemini Text-to-Speech</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Model</FieldLabel>
                  <Select value={config.tts.model} onChange={v => upd('tts.model', v)}
                    options={GEMINI_MODELS.map(m => ({ value: m, label: m }))} />
                </div>
                <div>
                  <FieldLabel>Voice</FieldLabel>
                  <Select value={config.tts.voice} onChange={v => upd('tts.voice', v)}
                    options={VOICES.map(v => ({ value: v, label: v }))} />
                  <p className="text-[11px] text-slate-400 mt-1">erinome = tốt nhất cho tiếng Việt</p>
                </div>
                <div>
                  <FieldLabel>Language</FieldLabel>
                  <Select value={config.tts.language} onChange={v => upd('tts.language', v)}
                    options={['vi-VN', 'en-US', 'zh-CN'].map(l => ({ value: l, label: l }))} />
                </div>
                <div>
                  <FieldLabel>Sample Rate (Hz)</FieldLabel>
                  <Select value={String(config.tts.sampleRate)} onChange={v => upd('tts.sampleRate', +v)}
                    options={['8000', '16000', '22050', '24000', '44100', '48000'].map(r => ({ value: r, label: `${r} Hz` }))} />
                </div>
              </div>
            </div>
          )}

          {/* ─ News ─ */}
          {tab === 'news' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">AI News Generation</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Model</FieldLabel>
                  <Select value={config.newsGeneration.model} onChange={v => upd('newsGeneration.model', v)}
                    options={GEMINI_MODELS.map(m => ({ value: m, label: m }))} />
                </div>
                <div>
                  <FieldLabel>Language</FieldLabel>
                  <Select value={config.newsGeneration.language} onChange={v => upd('newsGeneration.language', v)}
                    options={['vi-VN', 'en-US'].map(l => ({ value: l, label: l }))} />
                </div>
                <div>
                  <FieldLabel>Min Words</FieldLabel>
                  <NativeInput type="number" value={config.newsGeneration.minWords} onChange={v => upd('newsGeneration.minWords', +v)} />
                </div>
                <div>
                  <FieldLabel>Max Words</FieldLabel>
                  <NativeInput type="number" value={config.newsGeneration.maxWords} onChange={v => upd('newsGeneration.maxWords', +v)} />
                </div>
                <div className="col-span-2">
                  <FieldLabel>Style</FieldLabel>
                  <NativeInput value={config.newsGeneration.style} onChange={v => upd('newsGeneration.style', v)} />
                </div>
                <div className="col-span-2">
                  <FieldLabel>Tone</FieldLabel>
                  <NativeInput value={config.newsGeneration.tone} onChange={v => upd('newsGeneration.tone', v)} />
                </div>
              </div>
            </div>
          )}

          {/* ─ Upload ─ */}
          {tab === 'upload' && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Platforms</p>
                <div className="flex gap-3">
                  {['tiktok', 'threads', 'facebook'].map(p => {
                    const on = config.upload.platforms.includes(p)
                    return (
                      <button
                        key={p}
                        onClick={() => {
                          const platforms = on
                            ? config.upload.platforms.filter(x => x !== p)
                            : [...config.upload.platforms, p]
                          upd('upload.platforms', platforms)
                        }}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                          on ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        <span className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center', on ? 'bg-blue-500 border-blue-500' : 'border-slate-300')}>
                          {on && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </span>
                        <span className="capitalize">{p}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-800">Show Browser</p>
                  <p className="text-xs text-slate-400">Hiển thị browser khi upload</p>
                </div>
                <button
                  onClick={() => upd('upload.showBrowser', !config.upload.showBrowser)}
                  className={cn(
                    'relative w-10 h-6 rounded-full transition-colors',
                    config.upload.showBrowser ? 'bg-blue-500' : 'bg-slate-200'
                  )}
                >
                  <span className={cn(
                    'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    config.upload.showBrowser ? 'translate-x-5' : 'translate-x-1'
                  )} />
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Crawler</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Tool</FieldLabel>
                    <Select
                      value={config.crawler.useJDownloader ? 'jdownloader' : 'ytdlp'}
                      onChange={v => upd('crawler.useJDownloader', v === 'jdownloader')}
                      options={[
                        { value: 'jdownloader', label: 'JDownloader' },
                        { value: 'ytdlp', label: 'yt-dlp' },
                      ]}
                    />
                  </div>
                  <div>
                    <FieldLabel>Download Format</FieldLabel>
                    <Select value={config.crawler.downloadFormat} onChange={v => upd('crawler.downloadFormat', v)}
                      options={['mp4', 'mkv', 'webm'].map(f => ({ value: f, label: f }))} />
                  </div>
                  <div>
                    <FieldLabel>Timeout (ms)</FieldLabel>
                    <NativeInput type="number" value={config.upload.timeout} onChange={v => upd('upload.timeout', +v)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─ API Keys ─ */}
          {tab === 'keys' && (
            <div className="space-y-6">
              {apiKeys && (['gemini', 'tts'] as const).map(service => (
                <div key={service}>
                  <div className="flex items-center gap-2 mb-3">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      {service === 'gemini' ? 'Gemini API Keys (Text/News)' : 'TTS API Keys (Voice)'}
                    </p>
                    <span className="ml-auto text-xs text-slate-400">{apiKeys[service].length} keys</span>
                  </div>
                  <div className="space-y-2">
                    {apiKeys[service].map((key, i) => (
                      <div key={i} className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                        key.status === 'active' ? 'border-green-200 bg-green-50/50' :
                        key.status === 'quota_exceeded' ? 'border-red-200 bg-red-50/50' :
                        'border-slate-200 bg-slate-50'
                      )}>
                        {key.status === 'active' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        ) : key.status === 'quota_exceeded' ? (
                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800">{key.name}</p>
                            <span className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                              key.status === 'active' ? 'bg-green-100 text-green-700' :
                              key.status === 'quota_exceeded' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-500'
                            )}>
                              {key.status === 'active' ? 'Active' : key.status === 'quota_exceeded' ? 'Quota Exceeded' : 'Standby'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{key.key}</p>
                          {key.lastUsed && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Last used: {new Date(key.lastUsed).toLocaleString('vi-VN')}
                            </p>
                          )}
                          {key.quotaExceededAt && (
                            <p className="text-[11px] text-red-500 mt-0.5">
                              Quota exceeded: {new Date(key.quotaExceededAt).toLocaleString('vi-VN')}
                            </p>
                          )}
                        </div>
                        {key.status === 'quota_exceeded' && (
                          <button
                            onClick={() => resetQuota(service, key.name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                          >
                            <RotateCcw className="w-3 h-3" />Reset
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
