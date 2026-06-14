import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ComponentType } from 'react'
import Hls from 'hls.js'
import {
  BadgePlus,
  Cast,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Focus,
  Grid2X2,
  LayoutDashboard,
  ListVideo,
  Maximize2,
  Pause,
  Pin,
  Play,
  Radio,
  RotateCcw,
  Rows3,
  Save,
  Search,
  Settings2,
  TimerReset,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import './App.css'

type FeedKind = 'demo-race' | 'demo-onboard' | 'hls' | 'video' | 'iframe' | 'timing' | 'track-map' | 'race-control' | 'race-trace'
type LayoutMode = 'race' | 'grid' | 'six' | 'focus' | 'stack'

type FeedSource = {
  id: string
  title: string
  group: string
  kind: FeedKind
  url: string
  color: string
  active: boolean
  locked?: boolean
  driver?: string
  car?: string
}

type SourceDraft = {
  title: string
  group: string
  kind: FeedKind
  url: string
  color: string
  driver: string
  car: string
}

type LayoutOption = {
  id: LayoutMode
  title: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

const storageKey = 'pitwall-web.sources.v2'
const layoutKey = 'pitwall-web.layout.v2'

const defaultFeeds: FeedSource[] = [
  {
    id: 'race-feed',
    title: 'Race Feed',
    group: 'International',
    kind: 'demo-race',
    url: '',
    color: '#ed1c24',
    active: true,
    locked: true,
  },
  {
    id: 'onboard-nova',
    title: 'L. Nova Onboard',
    group: 'Onboards',
    kind: 'demo-onboard',
    url: '',
    color: '#00d084',
    active: true,
    driver: 'NOVA',
    car: '16',
  },
  {
    id: 'onboard-atlas',
    title: 'K. Atlas Onboard',
    group: 'Onboards',
    kind: 'demo-onboard',
    url: '',
    color: '#36a3ff',
    active: true,
    driver: 'ATLAS',
    car: '22',
  },
  {
    id: 'live-timing',
    title: 'Live Timing',
    group: 'Data',
    kind: 'timing',
    url: '',
    color: '#f5c84b',
    active: true,
    locked: true,
  },
  {
    id: 'track-map',
    title: 'Track Map',
    group: 'Data',
    kind: 'track-map',
    url: '',
    color: '#9b7cff',
    active: true,
  },
  {
    id: 'race-control',
    title: 'Race Control',
    group: 'Data',
    kind: 'race-control',
    url: '',
    color: '#ff8a3d',
    active: true,
  },
  {
    id: 'race-trace',
    title: 'Race Trace',
    group: 'Analysis',
    kind: 'race-trace',
    url: '',
    color: '#19d3da',
    active: false,
  },
]

const emptyDraft: SourceDraft = {
  title: '',
  group: 'Custom',
  kind: 'hls',
  url: '',
  color: '#ed1c24',
  driver: '',
  car: '',
}

const layoutOptions: LayoutOption[] = [
  { id: 'race', title: 'Race setup', icon: LayoutDashboard },
  { id: 'grid', title: 'Grid', icon: Grid2X2 },
  { id: 'six', title: '6-up', icon: ListVideo },
  { id: 'stack', title: 'Stack', icon: Rows3 },
  { id: 'focus', title: 'Focus', icon: Focus },
]

const feedColors = ['#ed1c24', '#00d084', '#36a3ff', '#f5c84b', '#9b7cff', '#ff8a3d', '#19d3da']

function readSources() {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return defaultFeeds
    const parsed = JSON.parse(raw) as FeedSource[]
    return parsed.length > 0 ? parsed : defaultFeeds
  } catch {
    return defaultFeeds
  }
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function sourceNeedsUrl(kind: FeedKind) {
  return kind === 'hls' || kind === 'video' || kind === 'iframe'
}

function App() {
  const [sources, setSources] = useState<FeedSource[]>(readSources)
  const [layout, setLayout] = useState<LayoutMode>(() => {
    const saved = window.localStorage.getItem(layoutKey) as LayoutMode | null
    return saved ?? 'race'
  })
  const [focusedId, setFocusedId] = useState(() => sources.find((source) => source.active)?.id ?? sources[0]?.id ?? '')
  const [playing, setPlaying] = useState(true)
  const [muted, setMuted] = useState(true)
  const [spoilerSafe, setSpoilerSafe] = useState(false)
  const [delay, setDelay] = useState(0)
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [draft, setDraft] = useState<SourceDraft>(emptyDraft)

  const activeSources = useMemo(() => sources.filter((source) => source.active), [sources])
  const focusedSource = useMemo(
    () => activeSources.find((source) => source.id === focusedId) ?? activeSources[0],
    [activeSources, focusedId],
  )
  const visibleSources = layout === 'focus' && focusedSource ? [focusedSource] : activeSources
  const filteredSources = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return sources
    return sources.filter((source) => `${source.title} ${source.group} ${source.driver ?? ''} ${source.car ?? ''}`.toLowerCase().includes(needle))
  }, [query, sources])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(sources))
  }, [sources])

  useEffect(() => {
    window.localStorage.setItem(layoutKey, layout)
  }, [layout])

  function updateSource(id: string, patch: Partial<FeedSource>) {
    setSources((current) => current.map((source) => (source.id === id ? { ...source, ...patch } : source)))
  }

  function toggleSource(source: FeedSource) {
    updateSource(source.id, { active: !source.active })
    if (!source.active) setFocusedId(source.id)
  }

  function removeSource(id: string) {
    setSources((current) => current.filter((source) => source.locked || source.id !== id))
  }

  function resetWorkspace() {
    setSources(defaultFeeds)
    setLayout('race')
    setFocusedId('race-feed')
    setPlaying(true)
    setMuted(true)
    setDelay(0)
    setSpoilerSafe(false)
  }

  function applySetup(setup: 'race' | 'onboards' | 'data') {
    if (setup === 'race') {
      setSources((current) => current.map((source) => ({ ...source, active: source.id !== 'race-trace' })))
      setLayout('race')
      setFocusedId('race-feed')
      return
    }
    if (setup === 'onboards') {
      setSources((current) => current.map((source) => ({ ...source, active: source.group === 'Onboards' || source.id === 'race-feed' })))
      setLayout('grid')
      setFocusedId('race-feed')
      return
    }
    setSources((current) => current.map((source) => ({ ...source, active: source.group === 'Data' || source.id === 'race-trace' })))
    setLayout('grid')
    setFocusedId('live-timing')
  }

  function addSource() {
    if (!draft.title.trim()) return
    if (sourceNeedsUrl(draft.kind) && !draft.url.trim()) return

    const source: FeedSource = {
      id: uid(),
      title: draft.title.trim(),
      group: draft.group.trim() || 'Custom',
      kind: draft.kind,
      url: sourceNeedsUrl(draft.kind) ? draft.url.trim() : '',
      color: draft.color,
      active: true,
      driver: draft.driver.trim() || undefined,
      car: draft.car.trim() || undefined,
    }
    setSources((current) => [...current, source])
    setFocusedId(source.id)
    setDraft(emptyDraft)
    setAddOpen(false)
  }

  async function copySetup() {
    const payload = JSON.stringify({ sources, layout, delay, muted, spoilerSafe }, null, 2)
    await navigator.clipboard?.writeText(payload)
  }

  return (
    <main className="mv-shell">
      <header className="app-titlebar">
        <div className="window-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="title-cluster">
          <strong>PitWall Web</strong>
          <span>Multi-feed race viewer</span>
        </div>
        <button className="session-picker" type="button">
          <Cast size={16} />
          <span>Grand Prix - Race</span>
          <ChevronDown size={15} />
        </button>
        <div className="title-actions">
          <span className={spoilerSafe ? 'pill active' : 'pill'}>Spoiler safe</span>
          <SessionClock />
        </div>
      </header>

      <aside className="feed-sidebar" aria-label="Feed catalog">
        <section className="event-card">
          <div className="event-meta">
            <span>LIVE SESSION</span>
            <strong>Lap 46 / 58</strong>
          </div>
          <div className="event-progress">
            <span style={{ width: '79%' }}></span>
          </div>
          <div className="event-grid">
            <span>SYNC</span>
            <strong>{delay >= 0 ? '+' : ''}{delay.toFixed(1)}s</strong>
            <span>WINDOWS</span>
            <strong>{activeSources.length}</strong>
          </div>
        </section>

        <section className="side-section">
          <div className="section-title">
            <span>Content catalog</span>
            <button className="icon-button" type="button" onClick={() => setAddOpen(true)} aria-label="Add feed">
              <BadgePlus size={17} />
            </button>
          </div>
          <label className="search-box">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find feed, driver, data" />
          </label>
          <div className="feed-list">
            {filteredSources.map((source) => (
              <article className={source.active ? 'feed-row active' : 'feed-row'} key={source.id} style={{ '--feed-color': source.color } as CSSProperties}>
                <button type="button" className="feed-toggle" onClick={() => toggleSource(source)} aria-label={`Toggle ${source.title}`}>
                  <span className="feed-check">{source.active ? <Check size={12} /> : null}</span>
                  <span>
                    <strong>{source.title}</strong>
                    <small>{source.group} {source.car ? `- Car ${source.car}` : ''}</small>
                  </span>
                </button>
                <div className="feed-tools">
                  <button
                    className="mini-button"
                    type="button"
                    onClick={() => {
                      setFocusedId(source.id)
                      setLayout('focus')
                    }}
                    aria-label={`Focus ${source.title}`}
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button
                    className="mini-button"
                    type="button"
                    disabled={source.locked}
                    onClick={() => removeSource(source.id)}
                    aria-label={`Remove ${source.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="side-section">
          <div className="section-title">
            <span>One-click setups</span>
            <Settings2 size={15} />
          </div>
          <div className="setup-list">
            <button type="button" onClick={() => applySetup('race')}>
              <strong>Race day</strong>
              <span>World feed + onboards + timing + map</span>
            </button>
            <button type="button" onClick={() => applySetup('onboards')}>
              <strong>Onboard wall</strong>
              <span>World feed with driver cams</span>
            </button>
            <button type="button" onClick={() => applySetup('data')}>
              <strong>Data wall</strong>
              <span>Timing, trace, control, map</span>
            </button>
          </div>
        </section>
      </aside>

      <section className="viewer-stage">
        <div className="stage-toolbar">
          <div className="layout-tabs">
            {layoutOptions.map((option) => {
              const Icon = option.icon
              return (
                <button
                  type="button"
                  className={layout === option.id ? 'selected' : ''}
                  key={option.id}
                  onClick={() => setLayout(option.id)}
                >
                  <Icon size={16} />
                  <span>{option.title}</span>
                </button>
              )
            })}
          </div>

          <div className="transport">
            <button className="transport-button" type="button" onClick={() => setPlaying((value) => !value)}>
              {playing ? <Pause size={17} /> : <Play size={17} />}
              <span>{playing ? 'Pause all' : 'Play all'}</span>
            </button>
            <button className="transport-button" type="button" onClick={() => setMuted((value) => !value)}>
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              <span>{muted ? 'Muted' : 'Audio'}</span>
            </button>
            <button className="transport-button" type="button" onClick={() => setSpoilerSafe((value) => !value)}>
              <TimerReset size={17} />
              <span>Spoilers</span>
            </button>
            <button className="transport-button" type="button" onClick={copySetup}>
              <Copy size={17} />
              <span>Copy setup</span>
            </button>
            <button className="transport-button" type="button" onClick={resetWorkspace}>
              <RotateCcw size={17} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <div className="sync-strip">
          <span>Global sync</span>
          <input
            type="range"
            min="-8"
            max="8"
            step="0.5"
            value={delay}
            onChange={(event) => setDelay(Number(event.target.value))}
            aria-label="Global sync delay"
          />
          <strong>{delay >= 0 ? '+' : ''}{delay.toFixed(1)}s</strong>
          <div className="buffer-bars" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        <section className={`window-grid layout-${layout}`} data-count={visibleSources.length}>
          {visibleSources.map((source, index) => (
            <ViewerWindow
              key={source.id}
              index={index}
              source={source}
              playing={playing}
              muted={muted}
              focused={source.id === focusedSource?.id}
              onFocus={() => {
                setFocusedId(source.id)
                setLayout('focus')
              }}
            />
          ))}
        </section>
      </section>

      {addOpen && (
        <div className="dialog-backdrop" role="presentation">
          <form
            className="source-dialog"
            onSubmit={(event) => {
              event.preventDefault()
              addSource()
            }}
          >
            <div className="dialog-header">
              <div>
                <span>Add authorized feed</span>
                <h2>New window source</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setAddOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <label>
              <span>Name</span>
              <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} autoFocus />
            </label>
            <label>
              <span>Group</span>
              <input value={draft.group} onChange={(event) => setDraft((current) => ({ ...current, group: event.target.value }))} />
            </label>
            <div className="dialog-grid">
              <label>
                <span>Type</span>
                <select value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as FeedKind }))}>
                  <option value="hls">HLS stream</option>
                  <option value="video">Video file</option>
                  <option value="iframe">Embed URL</option>
                  <option value="timing">Live timing</option>
                  <option value="track-map">Track map</option>
                  <option value="race-control">Race control</option>
                  <option value="race-trace">Race trace</option>
                  <option value="demo-onboard">Demo onboard</option>
                </select>
              </label>
              <label>
                <span>Car</span>
                <input value={draft.car} onChange={(event) => setDraft((current) => ({ ...current, car: event.target.value }))} />
              </label>
            </div>
            {sourceNeedsUrl(draft.kind) && (
              <label>
                <span>URL</span>
                <input value={draft.url} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} />
              </label>
            )}
            <label>
              <span>Driver tag</span>
              <input value={draft.driver} onChange={(event) => setDraft((current) => ({ ...current, driver: event.target.value }))} />
            </label>
            <div className="swatches" aria-label="Feed color">
              {feedColors.map((color) => (
                <button
                  type="button"
                  key={color}
                  className={draft.color === color ? 'swatch selected' : 'swatch'}
                  style={{ backgroundColor: color }}
                  onClick={() => setDraft((current) => ({ ...current, color }))}
                  aria-label={color}
                />
              ))}
            </div>
            <div className="dialog-actions">
              <button className="transport-button" type="button" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button className="save-button" type="submit">
                <Save size={17} />
                <span>Save window</span>
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
    <time dateTime={now.toISOString()} className="session-clock">
      <Clock3 size={14} />
      {now.toLocaleTimeString('en-US', { hour12: false })}
    </time>
  )
}

function ViewerWindow({
  source,
  index,
  playing,
  muted,
  focused,
  onFocus,
}: {
  source: FeedSource
  index: number
  playing: boolean
  muted: boolean
  focused: boolean
  onFocus: () => void
}) {
  return (
    <article
      className={`viewer-window ${focused ? 'focused' : ''} ${source.id === 'race-feed' ? 'primary-feed' : ''}`}
      style={{ '--feed-color': source.color } as CSSProperties}
      data-index={index}
    >
      <header className="window-bar">
        <div className="window-identity">
          <div className="window-controls" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div>
            <strong>{source.title}</strong>
            <span>{source.group}{source.car ? ` - Car ${source.car}` : ''}</span>
          </div>
        </div>
        <div className="window-actions">
          {source.driver ? <span className="driver-badge">{source.driver}</span> : null}
          <button className="mini-button" type="button" aria-label={`Pin ${source.title}`}>
            <Pin size={13} />
          </button>
          <button className="mini-button" type="button" onClick={onFocus} aria-label={`Focus ${source.title}`}>
            <Maximize2 size={14} />
          </button>
        </div>
      </header>
      <div className="window-body">
        {source.kind === 'demo-race' ? (
          <RaceFeed />
        ) : source.kind === 'demo-onboard' ? (
          <OnboardFeed source={source} />
        ) : source.kind === 'timing' ? (
          <TimingPanel />
        ) : source.kind === 'track-map' ? (
          <TrackMapPanel />
        ) : source.kind === 'race-control' ? (
          <RaceControlPanel />
        ) : source.kind === 'race-trace' ? (
          <RaceTracePanel />
        ) : source.kind === 'iframe' ? (
          <iframe src={source.url} title={source.title} loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <StreamPlayer source={source} playing={playing} muted={muted} />
        )}
      </div>
    </article>
  )
}

function RaceFeed() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const lap = 46 + Math.floor((tick % 24) / 12)
  const phase = tick % 12

  return (
    <div className="broadcast-feed">
      <div className="video-noise"></div>
      <div className="broadcast-track">
        <span className="grandstand"></span>
        <span className="runoff left"></span>
        <span className="runoff right"></span>
        <span className="race-line"></span>
        <span className="lead-car"></span>
        <span className="chase-car"></span>
      </div>
      <div className="feed-bug">
        <strong>LIVE</strong>
        <span>Race feed</span>
      </div>
      <div className="lower-third">
        <div>
          <span>Leader</span>
          <strong>NOVA</strong>
        </div>
        <div>
          <span>Lap</span>
          <strong>{lap}/58</strong>
        </div>
        <div>
          <span>Gap</span>
          <strong>+{(1.214 + phase / 100).toFixed(3)}</strong>
        </div>
      </div>
    </div>
  )
}

function OnboardFeed({ source }: { source: FeedSource }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 800)
    return () => window.clearInterval(id)
  }, [])

  const phase = tick % 18
  const speed = source.id === 'onboard-atlas' ? 221 + phase * 4 : 246 + phase * 3
  const gear = source.id === 'onboard-atlas' ? 5 + (phase % 2) : 6 + (phase % 2)
  const throttle = Math.min(96, 68 + phase * 2)
  const brake = phase > 12 ? (phase - 12) * 12 : 0

  return (
    <div className="onboard-feed">
      <div className="cockpit-view">
        <span className="halo"></span>
        <span className="road"></span>
        <span className="apex-light"></span>
        <span className="wheel"></span>
      </div>
      <div className="driver-tag">
        <strong>{source.driver ?? 'DRIVER'}</strong>
        <span>CAR {source.car ?? '--'}</span>
      </div>
      <div className="speed-overlay">
        <div className="speed-ring" style={{ '--speed': `${Math.min(312, speed) / 3.12}%` } as CSSProperties}>
          <strong>{speed}</strong>
          <span>km/h</span>
        </div>
        <div className="gear-box">
          <span>GEAR</span>
          <strong>{gear}</strong>
        </div>
      </div>
      <div className="pedal-stack">
        <label>
          <span>THR</span>
          <i style={{ width: `${throttle}%` }}></i>
        </label>
        <label>
          <span>BRK</span>
          <i style={{ width: `${brake}%` }}></i>
        </label>
      </div>
    </div>
  )
}

function StreamPlayer({ source, playing, muted }: { source: FeedSource; playing: boolean; muted: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState('READY')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let hls: Hls | null = null
    const markReady = () => setStatus('LIVE')
    queueMicrotask(() => setStatus('TUNING'))

    if (source.kind === 'hls' && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 })
      hls.loadSource(source.url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, markReady)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setStatus('ERROR')
      })
    } else {
      video.src = source.url
      video.addEventListener('loadedmetadata', markReady)
      video.addEventListener('canplay', markReady, { once: true })
    }

    return () => {
      hls?.destroy()
      video.removeEventListener('loadedmetadata', markReady)
      video.removeEventListener('canplay', markReady)
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
    <div className="stream-player">
      <video ref={videoRef} playsInline muted={muted} controls={false} preload="auto" />
      <span className="stream-state">{status}</span>
    </div>
  )
}

function TimingPanel() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1600)
    return () => window.clearInterval(id)
  }, [])

  const rows = useMemo(() => {
    const base = [
      ['01', 'NOVA', '16', '+0.000', '1:41.832', 'S2'],
      ['02', 'ATLAS', '22', '+1.284', '1:42.107', 'S3'],
      ['03', 'VOLT', '04', '+2.916', '1:42.446', 'PIT'],
      ['04', 'ORION', '31', '+4.021', '1:42.913', 'S1'],
      ['05', 'APEX', '07', '+6.447', '1:43.088', 'S2'],
      ['06', 'LYNX', '11', '+8.105', '1:43.320', 'S3'],
      ['07', 'MOSS', '55', '+9.830', '1:43.508', 'S1'],
    ]
    return base.map((row, index) => {
      const pulse = (tick + index) % 5 === 0
      const gap = pulse && index > 0 ? `+${(Number(row[3].slice(1)) + 0.132).toFixed(3)}` : row[3]
      return { pos: row[0], driver: row[1], car: row[2], gap, best: row[4], sector: row[5], pulse }
    })
  }, [tick])

  return (
    <div className="timing-panel">
      <div className="timing-head">
        <span>POS</span>
        <span>DRV</span>
        <span>GAP</span>
        <span>BEST</span>
        <span>STAT</span>
      </div>
      {rows.map((row) => (
        <div className={row.pulse ? 'timing-row pulse' : 'timing-row'} key={row.pos}>
          <span>{row.pos}</span>
          <strong>{row.driver}</strong>
          <span>{row.gap}</span>
          <span>{row.best}</span>
          <span>{row.sector}</span>
        </div>
      ))}
    </div>
  )
}

function TrackMapPanel() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1200)
    return () => window.clearInterval(id)
  }, [])

  const cars = [
    { id: '16', x: 28 + (tick % 8) * 2, y: 31, color: '#00d084' },
    { id: '22', x: 61, y: 23 + (tick % 6) * 2, color: '#36a3ff' },
    { id: '04', x: 74 - (tick % 5) * 2, y: 64, color: '#f5c84b' },
    { id: '31', x: 39, y: 76 - (tick % 7) * 2, color: '#ed1c24' },
  ]

  return (
    <div className="track-panel">
      <svg viewBox="0 0 100 100" role="img" aria-label="Demo track map">
        <path className="map-grid" d="M8 18 H92 M8 38 H92 M8 58 H92 M8 78 H92 M20 8 V92 M40 8 V92 M60 8 V92 M80 8 V92" />
        <path className="sector-a" d="M21 55 C11 34 26 15 49 17 C74 19 85 29 82 45" />
        <path className="sector-b" d="M82 45 C78 64 65 79 43 80" />
        <path className="sector-c" d="M43 80 C20 80 13 66 21 55" />
        <path className="pit-line" d="M26 61 C39 69 55 68 68 57" />
        {cars.map((car) => (
          <g key={car.id} transform={`translate(${car.x} ${car.y})`}>
            <circle r="2.4" fill={car.color} />
            <text x="4" y="3">
              {car.id}
            </text>
          </g>
        ))}
      </svg>
      <div className="map-callouts">
        <span>DRS 1</span>
        <span>DRS 2</span>
        <strong>PIT +14.2</strong>
      </div>
    </div>
  )
}

function RaceControlPanel() {
  const messages = [
    ['46', 'YELLOW', 'Sector 2 briefly under local yellow'],
    ['45', 'INFO', 'Car 04 noted for track limits'],
    ['43', 'DRS', 'DRS enabled'],
    ['42', 'PIT', 'Car 22 pit exit clear'],
    ['40', 'RADIO', 'Car 16 reports front-left vibration'],
    ['38', 'INFO', 'Weather risk remains low'],
  ]

  return (
    <div className="race-control-panel">
      <div className="radio-header">
        <Radio size={16} />
        <span>Race control and radio transcript</span>
      </div>
      {messages.map((message) => (
        <div className="control-message" key={`${message[0]}-${message[1]}`}>
          <span>L{message[0]}</span>
          <strong>{message[1]}</strong>
          <p>{message[2]}</p>
        </div>
      ))}
    </div>
  )
}

function RaceTracePanel() {
  return (
    <div className="race-trace-panel">
      <svg viewBox="0 0 360 180" role="img" aria-label="Race trace">
        <path className="trace-grid" d="M24 30 H340 M24 70 H340 M24 110 H340 M24 150 H340 M80 20 V160 M140 20 V160 M200 20 V160 M260 20 V160 M320 20 V160" />
        <path className="trace-line red" d="M24 136 C60 114 84 102 114 86 C146 69 172 76 201 61 C238 42 276 51 340 31" />
        <path className="trace-line green" d="M24 146 C62 130 88 121 120 106 C148 92 178 98 206 78 C237 58 286 63 340 44" />
        <path className="trace-line blue" d="M24 151 C68 139 96 132 125 119 C158 102 183 115 214 91 C254 63 286 80 340 58" />
      </svg>
      <div className="trace-legend">
        <span>NOVA</span>
        <span>ATLAS</span>
        <span>VOLT</span>
      </div>
    </div>
  )
}

export default App
