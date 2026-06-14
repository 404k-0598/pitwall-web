import { useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import {
  Activity,
  BadgePlus,
  Columns3,
  Copy,
  Focus,
  Grid2X2,
  LayoutDashboard,
  Maximize2,
  MonitorPlay,
  Pause,
  Play,
  RotateCcw,
  Rows3,
  Save,
  Settings2,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import './App.css'

type SourceKind = 'hls' | 'video' | 'iframe' | 'timing' | 'demo' | 'map'
type LayoutMode = 'auto' | 'quad' | 'six' | 'stack' | 'focus'

type ViewerSource = {
  id: string
  title: string
  label: string
  kind: SourceKind
  url: string
  accent: string
  active: boolean
  locked?: boolean
}

type SourceDraft = {
  title: string
  label: string
  kind: SourceKind
  url: string
  accent: string
}

const storageKey = 'pitwall-web.sources.v1'
const layoutKey = 'pitwall-web.layout.v1'

const demoSources: ViewerSource[] = [
  {
    id: 'world-feed',
    title: 'Main Feed',
    label: 'WORLD',
    kind: 'demo',
    url: '',
    accent: '#f97316',
    active: true,
  },
  {
    id: 'onboard-alpha',
    title: 'Onboard A',
    label: 'CAM 12',
    kind: 'demo',
    url: '',
    accent: '#22c55e',
    active: true,
  },
  {
    id: 'timing',
    title: 'Timing',
    label: 'DATA',
    kind: 'timing',
    url: '',
    accent: '#38bdf8',
    active: true,
    locked: true,
  },
  {
    id: 'track-map',
    title: 'Track Map',
    label: 'MAP',
    kind: 'map',
    url: '',
    accent: '#eab308',
    active: true,
  },
]

const emptyDraft: SourceDraft = {
  title: '',
  label: 'LIVE',
  kind: 'hls',
  url: '',
  accent: '#f97316',
}

const accents = ['#f97316', '#22c55e', '#38bdf8', '#eab308', '#ef4444', '#a3e635']

const layoutOptions: { id: LayoutMode; title: string; icon: typeof LayoutDashboard }[] = [
  { id: 'auto', title: 'Auto', icon: LayoutDashboard },
  { id: 'quad', title: '2x2', icon: Grid2X2 },
  { id: 'six', title: '3x2', icon: Columns3 },
  { id: 'stack', title: 'Stack', icon: Rows3 },
  { id: 'focus', title: 'Focus', icon: Focus },
]

function readSources() {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return demoSources
    const parsed = JSON.parse(raw) as ViewerSource[]
    return parsed.length > 0 ? parsed : demoSources
  } catch {
    return demoSources
  }
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function App() {
  const [sources, setSources] = useState<ViewerSource[]>(readSources)
  const [layout, setLayout] = useState<LayoutMode>(() => {
    const saved = window.localStorage.getItem(layoutKey) as LayoutMode | null
    return saved ?? 'quad'
  })
  const [focusedId, setFocusedId] = useState<string>(sources.find((source) => source.active)?.id ?? sources[0]?.id ?? '')
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [draft, setDraft] = useState<SourceDraft>(emptyDraft)

  const activeSources = useMemo(() => sources.filter((source) => source.active), [sources])
  const focusedSource = useMemo(
    () => activeSources.find((source) => source.id === focusedId) ?? activeSources[0],
    [activeSources, focusedId],
  )

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(sources))
  }, [sources])

  useEffect(() => {
    window.localStorage.setItem(layoutKey, layout)
  }, [layout])

  const gridSources = layout === 'focus' && focusedSource ? [focusedSource] : activeSources

  function addSource() {
    if (!draft.title.trim()) return
    if (draft.kind !== 'timing' && !draft.url.trim()) return
    const source: ViewerSource = {
      id: uid(),
      title: draft.title.trim(),
      label: draft.label.trim() || draft.kind.toUpperCase(),
      kind: draft.kind,
      url: draft.kind === 'timing' ? '' : draft.url.trim(),
      accent: draft.accent,
      active: true,
    }
    setSources((current) => [...current, source])
    setFocusedId(source.id)
    setDraft(emptyDraft)
    setIsAddOpen(false)
  }

  function updateSource(id: string, patch: Partial<ViewerSource>) {
    setSources((current) => current.map((source) => (source.id === id ? { ...source, ...patch } : source)))
  }

  function removeSource(id: string) {
    setSources((current) => current.filter((source) => source.locked || source.id !== id))
  }

  function resetWorkspace() {
    setSources(demoSources)
    setLayout('quad')
    setFocusedId('world-feed')
    setIsPlaying(true)
    setIsMuted(true)
  }

  async function copyPreset() {
    const payload = JSON.stringify({ sources, layout }, null, 2)
    await navigator.clipboard?.writeText(payload)
  }

  return (
    <main className="app-shell">
      <aside className="control-rail" aria-label="PitWall controls">
        <header className="brand-strip">
          <div className="mark">PW</div>
          <div>
            <h1>PitWall Web</h1>
            <span>Race control</span>
          </div>
        </header>

        <section className="session-card">
          <div className="session-row">
            <span>Session</span>
            <strong>LIVE</strong>
          </div>
          <SessionClock />
          <div className="signal-strip">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </section>

        <section className="rail-section">
          <div className="section-head">
            <span>Sources</span>
            <button className="icon-button" type="button" onClick={() => setIsAddOpen(true)} aria-label="Add source">
              <BadgePlus size={18} />
            </button>
          </div>
          <div className="source-list">
            {sources.map((source) => (
              <article
                className={`source-item ${source.active ? 'is-active' : ''}`}
                key={source.id}
                style={{ '--source-accent': source.accent } as React.CSSProperties}
              >
                <button
                  className="source-main"
                  type="button"
                  onClick={() => {
                    updateSource(source.id, { active: !source.active })
                    setFocusedId(source.id)
                  }}
                >
                  <span className="source-dot"></span>
                  <span>
                    <strong>{source.title}</strong>
                    <small>{source.label}</small>
                  </span>
                </button>
                <div className="source-actions">
                  <button className="icon-button ghost" type="button" onClick={() => setFocusedId(source.id)} aria-label={`Focus ${source.title}`}>
                    <Maximize2 size={15} />
                  </button>
                  <button
                    className="icon-button ghost"
                    type="button"
                    disabled={source.locked}
                    onClick={() => removeSource(source.id)}
                    aria-label={`Remove ${source.title}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rail-section">
          <div className="section-head">
            <span>Layout</span>
            <Settings2 size={16} />
          </div>
          <div className="layout-grid">
            {layoutOptions.map((option) => {
              const Icon = option.icon
              return (
                <button
                  className={layout === option.id ? 'layout-option selected' : 'layout-option'}
                  type="button"
                  key={option.id}
                  onClick={() => setLayout(option.id)}
                  aria-label={option.title}
                >
                  <Icon size={18} />
                  <span>{option.title}</span>
                </button>
              )
            })}
          </div>
        </section>
      </aside>

      <section className="viewer-workspace">
        <header className="topbar">
          <div className="topbar-title">
            <Activity size={18} />
            <span>{activeSources.length} panels active</span>
          </div>
          <div className="global-controls">
            <button className="toolbar-button" type="button" onClick={() => setIsPlaying((value) => !value)}>
              {isPlaying ? <Pause size={17} /> : <Play size={17} />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <button className="toolbar-button" type="button" onClick={() => setIsMuted((value) => !value)}>
              {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              <span>{isMuted ? 'Muted' : 'Audio'}</span>
            </button>
            <button className="toolbar-button" type="button" onClick={copyPreset}>
              <Copy size={17} />
              <span>Copy</span>
            </button>
            <button className="toolbar-button" type="button" onClick={resetWorkspace}>
              <RotateCcw size={17} />
              <span>Reset</span>
            </button>
          </div>
        </header>

        <section className={`viewer-grid layout-${layout}`} data-count={gridSources.length}>
          {gridSources.map((source) => (
            <ViewerTile
              key={source.id}
              source={source}
              playing={isPlaying}
              muted={isMuted}
              focused={source.id === focusedSource?.id}
              onFocus={() => {
                setFocusedId(source.id)
                if (layout === 'focus') return
                setLayout('focus')
              }}
            />
          ))}
        </section>
      </section>

      {isAddOpen && (
        <div className="dialog-backdrop" role="presentation">
          <form
            className="source-dialog"
            onSubmit={(event) => {
              event.preventDefault()
              addSource()
            }}
          >
            <div className="dialog-title">
              <MonitorPlay size={20} />
              <h2>Add panel</h2>
            </div>
            <label>
              <span>Name</span>
              <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} autoFocus />
            </label>
            <label>
              <span>Tag</span>
              <input value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} />
            </label>
            <label>
              <span>Type</span>
              <select
                value={draft.kind}
                onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as SourceKind }))}
              >
                <option value="hls">HLS stream</option>
                <option value="video">Video file</option>
                <option value="iframe">Embed URL</option>
                <option value="timing">Timing board</option>
              </select>
            </label>
            {draft.kind !== 'timing' && (
              <label>
                <span>URL</span>
                <input value={draft.url} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} />
              </label>
            )}
            <div className="swatches" aria-label="Accent color">
              {accents.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  className={draft.accent === accent ? 'swatch selected' : 'swatch'}
                  style={{ backgroundColor: accent }}
                  onClick={() => setDraft((current) => ({ ...current, accent }))}
                  aria-label={accent}
                />
              ))}
            </div>
            <div className="dialog-actions">
              <button className="toolbar-button" type="button" onClick={() => setIsAddOpen(false)}>
                Cancel
              </button>
              <button className="primary-button" type="submit">
                <Save size={17} />
                <span>Save</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

function SessionClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <time className="session-clock" dateTime={now.toISOString()}>
      {now.toLocaleTimeString('en-US', { hour12: false })}
    </time>
  )
}

function ViewerTile({
  source,
  playing,
  muted,
  focused,
  onFocus,
}: {
  source: ViewerSource
  playing: boolean
  muted: boolean
  focused: boolean
  onFocus: () => void
}) {
  return (
    <article className={`viewer-tile ${focused ? 'is-focused' : ''}`} style={{ '--source-accent': source.accent } as React.CSSProperties}>
      <div className="tile-head">
        <div>
          <span className="tile-label">{source.label}</span>
          <h2>{source.title}</h2>
        </div>
        <button className="icon-button tile-focus" type="button" onClick={onFocus} aria-label={`Focus ${source.title}`}>
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="tile-body">
        {source.kind === 'demo' ? (
          <DemoFeed source={source} />
        ) : source.kind === 'map' ? (
          <TrackMap />
        ) : source.kind === 'timing' ? (
          <TimingBoard />
        ) : source.kind === 'iframe' ? (
          <iframe src={source.url} title={source.title} loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <StreamPlayer source={source} playing={playing} muted={muted} />
        )}
      </div>
    </article>
  )
}

function DemoFeed({ source }: { source: ViewerSource }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 900)
    return () => window.clearInterval(id)
  }, [])

  const telemetry = useMemo(() => {
    const phase = tick % 12
    return {
      speed: source.id === 'world-feed' ? 276 + phase * 3 : 231 + phase * 5,
      gear: source.id === 'world-feed' ? 7 : 5 + (phase % 2),
      gap: source.id === 'world-feed' ? '+0.000' : `+${(1.41 + phase / 100).toFixed(2)}`,
      sector: ['S1', 'S2', 'S3'][phase % 3],
    }
  }, [source.id, tick])

  return (
    <div className={`demo-feed ${source.id === 'world-feed' ? 'wide-shot' : 'cockpit-shot'}`}>
      <div className="track-horizon">
        <span></span>
        <span></span>
      </div>
      <div className="track-surface">
        <div className="kerb left"></div>
        <div className="lane-grid"></div>
        <div className="racing-line"></div>
        <div className="car-shadow"></div>
        <div className="apex-marker"></div>
      </div>
      <div className="feed-hud">
        <div>
          <span>{telemetry.sector}</span>
          <strong>{telemetry.speed}</strong>
          <small>KM/H</small>
        </div>
        <div>
          <span>GEAR</span>
          <strong>{telemetry.gear}</strong>
          <small>{telemetry.gap}</small>
        </div>
      </div>
    </div>
  )
}

function TrackMap() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1200)
    return () => window.clearInterval(id)
  }, [])

  const cars = useMemo(
    () => [
      { id: '01', x: 26 + (tick % 6) * 2, y: 34, color: '#f97316' },
      { id: '02', x: 55, y: 23 + (tick % 5) * 2, color: '#22c55e' },
      { id: '03', x: 70 - (tick % 4) * 2, y: 62, color: '#38bdf8' },
      { id: '04', x: 42, y: 72 - (tick % 6) * 2, color: '#eab308' },
    ],
    [tick],
  )

  return (
    <div className="track-map-panel">
      <svg viewBox="0 0 100 100" role="img" aria-label="Demo track map">
        <path className="map-grid-line" d="M10 18 H90 M10 38 H90 M10 58 H90 M10 78 H90 M20 8 V92 M40 8 V92 M60 8 V92 M80 8 V92" />
        <path className="sector sector-one" d="M21 55 C11 34 26 15 49 17 C74 19 85 29 82 45" />
        <path className="sector sector-two" d="M82 45 C78 64 65 79 43 80" />
        <path className="sector sector-three" d="M43 80 C20 80 13 66 21 55" />
        <path className="pit-lane" d="M25 61 C38 69 55 68 68 57" />
        {cars.map((car) => (
          <g key={car.id} transform={`translate(${car.x} ${car.y})`}>
            <circle r="2.4" fill={car.color} />
            <text x="4" y="3">
              {car.id}
            </text>
          </g>
        ))}
      </svg>
      <div className="map-legend">
        <span>S1</span>
        <span>S2</span>
        <span>S3</span>
        <strong>PIT +14.2</strong>
      </div>
    </div>
  )
}

function StreamPlayer({ source, playing, muted }: { source: ViewerSource; playing: boolean; muted: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState('READY')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let hls: Hls | null = null
    const handleLoadedMetadata = () => setStatus('LIVE')
    queueMicrotask(() => setStatus('TUNING'))

    if (source.kind === 'hls' && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 })
      hls.loadSource(source.url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => setStatus('LIVE'))
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setStatus('ERROR')
      })
    } else {
      video.src = source.url
      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      video.addEventListener('canplay', handleLoadedMetadata, { once: true })
    }

    return () => {
      hls?.destroy()
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('canplay', handleLoadedMetadata)
      video.removeAttribute('src')
      video.load()
    }
  }, [source.kind, source.url])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = muted
    if (playing) {
      video.play().catch(() => setStatus('CLICK'))
    } else {
      video.pause()
    }
  }, [playing, muted])

  return (
    <>
      <video ref={videoRef} playsInline muted={muted} controls={false} preload="auto" />
      <div className="stream-status">{status}</div>
    </>
  )
}

function TimingBoard() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1600)
    return () => window.clearInterval(id)
  }, [])

  const rows = useMemo(() => {
    const base = [
      ['01', 'NOVA', '+0.000', '1:41.832', 'S2'],
      ['02', 'ATLAS', '+1.284', '1:42.107', 'S3'],
      ['03', 'VOLT', '+2.916', '1:42.446', 'PIT'],
      ['04', 'ORION', '+4.021', '1:42.913', 'S1'],
      ['05', 'APEX', '+6.447', '1:43.088', 'S2'],
      ['06', 'LYNX', '+8.105', '1:43.320', 'S3'],
    ]
    return base.map((row, index) => {
      const pulse = (tick + index) % 5 === 0
      return {
        position: row[0],
        driver: row[1],
        gap: pulse && index > 0 ? `+${(Number(row[2].slice(1)) + 0.132).toFixed(3)}` : row[2],
        lap: row[3],
        sector: row[4],
        pulse,
      }
    })
  }, [tick])

  return (
    <div className="timing-board">
      <div className="timing-head">
        <span>POS</span>
        <span>CAR</span>
        <span>GAP</span>
        <span>BEST</span>
        <span>STAT</span>
      </div>
      {rows.map((row) => (
        <div className={`timing-row ${row.pulse ? 'pulse' : ''}`} key={row.position}>
          <span>{row.position}</span>
          <strong>{row.driver}</strong>
          <span>{row.gap}</span>
          <span>{row.lap}</span>
          <span>{row.sector}</span>
        </div>
      ))}
    </div>
  )
}

export default App
