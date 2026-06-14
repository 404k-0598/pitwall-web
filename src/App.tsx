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
  driverNumber?: number
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

type OpenF1CarData = {
  date: string
  driver_number: number
  speed: number
  throttle: number
  brake: number
  rpm: number
  n_gear: number
  drs: number
}

type TelemetryRow = {
  pos: number
  driverNumber: number
  code: string
  team: string
  teamColor: string
  delta: number
  gap: string
  interval: string
  best: string
  last: string
  compound: 'S' | 'M' | 'H' | 'I' | 'W'
  tyreAge: number
  sectors: Array<'purple' | 'green' | 'yellow' | 'neutral'>
  sample: OpenF1CarData
}

const storageKey = 'pitwall-web.sources.v3'
const layoutKey = 'pitwall-web.layout.v3'
const openF1SessionKey = 9165
const openF1Window = '2023 Singapore GP Race - OpenF1 replay'

const fallbackSample: OpenF1CarData = {
  date: '2023-09-17T12:30:00.117000+00:00',
  driver_number: 55,
  speed: 129,
  throttle: 80,
  brake: 0,
  rpm: 10041,
  n_gear: 3,
  drs: 0,
}

const timingSeed: Omit<TelemetryRow, 'sample'>[] = [
  {
    pos: 1,
    driverNumber: 55,
    code: 'SAI',
    team: 'Ferrari',
    teamColor: '#f91536',
    delta: 0,
    gap: 'LEADER',
    interval: '+0.000',
    best: '1:37.418',
    last: '1:39.204',
    compound: 'H',
    tyreAge: 17,
    sectors: ['green', 'green', 'neutral', 'green', 'yellow', 'neutral', 'green', 'neutral'],
  },
  {
    pos: 2,
    driverNumber: 4,
    code: 'NOR',
    team: 'McLaren',
    teamColor: '#f58020',
    delta: 1,
    gap: '+0.812',
    interval: '+0.812',
    best: '1:37.612',
    last: '1:39.417',
    compound: 'H',
    tyreAge: 17,
    sectors: ['green', 'neutral', 'green', 'neutral', 'yellow', 'green', 'neutral', 'green'],
  },
  {
    pos: 3,
    driverNumber: 44,
    code: 'HAM',
    team: 'Mercedes',
    teamColor: '#6cd3bf',
    delta: 2,
    gap: '+1.269',
    interval: '+0.457',
    best: '1:36.944',
    last: '1:38.989',
    compound: 'M',
    tyreAge: 4,
    sectors: ['purple', 'green', 'green', 'neutral', 'green', 'green', 'neutral', 'yellow'],
  },
  {
    pos: 4,
    driverNumber: 16,
    code: 'LEC',
    team: 'Ferrari',
    teamColor: '#f91536',
    delta: -1,
    gap: '+2.903',
    interval: '+1.634',
    best: '1:37.512',
    last: '1:39.766',
    compound: 'H',
    tyreAge: 17,
    sectors: ['neutral', 'yellow', 'green', 'neutral', 'neutral', 'green', 'yellow', 'neutral'],
  },
  {
    pos: 5,
    driverNumber: 1,
    code: 'VER',
    team: 'Red Bull',
    teamColor: '#3671c6',
    delta: 6,
    gap: '+5.221',
    interval: '+2.318',
    best: '1:36.575',
    last: '1:38.518',
    compound: 'M',
    tyreAge: 4,
    sectors: ['green', 'purple', 'green', 'green', 'neutral', 'green', 'green', 'neutral'],
  },
  {
    pos: 6,
    driverNumber: 63,
    code: 'RUS',
    team: 'Mercedes',
    teamColor: '#6cd3bf',
    delta: 0,
    gap: '+7.904',
    interval: '+2.683',
    best: '1:36.611',
    last: '1:38.790',
    compound: 'M',
    tyreAge: 4,
    sectors: ['green', 'green', 'neutral', 'green', 'green', 'yellow', 'neutral', 'green'],
  },
]

const defaultFeeds: FeedSource[] = [
  {
    id: 'race-feed',
    title: 'International Feed',
    group: openF1Window,
    kind: 'demo-race',
    url: '',
    color: '#ed1c24',
    active: true,
    locked: true,
  },
  {
    id: 'onboard-sai',
    title: 'SAI Onboard',
    group: 'Onboards',
    kind: 'demo-onboard',
    url: '',
    color: '#f91536',
    active: true,
    driver: 'SAI',
    car: '55',
    driverNumber: 55,
  },
  {
    id: 'onboard-ver',
    title: 'VER Onboard',
    group: 'Onboards',
    kind: 'demo-onboard',
    url: '',
    color: '#3671c6',
    active: true,
    driver: 'VER',
    car: '1',
    driverNumber: 1,
  },
  {
    id: 'live-timing',
    title: 'Telemetry Tower',
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

function buildFallbackRows(index: number): TelemetryRow[] {
  return timingSeed.map((driver, offset) => {
    const speed = 225 + ((index * 9 + offset * 13) % 76)
    const brake = (index + offset) % 8 === 0 ? 78 : 0
    const throttle = brake > 0 ? 0 : 74 + ((index + offset * 5) % 26)
    const rpm = 9100 + ((index * 431 + offset * 587) % 3300)
    return {
      ...driver,
      sample: {
        ...fallbackSample,
        driver_number: driver.driverNumber,
        speed,
        throttle,
        brake,
        rpm,
        n_gear: Math.min(8, Math.max(1, Math.round(speed / 42))),
        drs: speed > 255 && brake === 0 ? 12 : 0,
      },
    }
  })
}

function groupSamples(samples: OpenF1CarData[]) {
  return samples.reduce<Record<number, OpenF1CarData[]>>((acc, sample) => {
    acc[sample.driver_number] = acc[sample.driver_number] ?? []
    acc[sample.driver_number].push(sample)
    return acc
  }, {})
}

function useOpenF1Replay() {
  const [samples, setSamples] = useState<Record<number, OpenF1CarData[]>>({})
  const [status, setStatus] = useState<'loading' | 'live' | 'fallback'>('loading')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const endpoint =
      `https://api.openf1.org/v1/car_data?session_key=${openF1SessionKey}` +
      '&date>=2023-09-17T12:30:00&date<=2023-09-17T12:30:12'

    fetch(endpoint)
      .then((response) => {
        if (!response.ok) throw new Error(`OpenF1 ${response.status}`)
        return response.json() as Promise<OpenF1CarData[]>
      })
      .then((payload) => {
        if (cancelled) return
        const grouped = groupSamples(payload)
        setSamples(grouped)
        setStatus(Object.keys(grouped).length > 0 ? 'live' : 'fallback')
      })
      .catch(() => {
        if (!cancelled) setStatus('fallback')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 420)
    return () => window.clearInterval(id)
  }, [])

  const rows = useMemo<TelemetryRow[]>(() => {
    if (status !== 'live') return buildFallbackRows(tick)
    return timingSeed.map((driver) => {
      const driverSamples = samples[driver.driverNumber] ?? []
      const sample = driverSamples[tick % Math.max(driverSamples.length, 1)] ?? {
        ...fallbackSample,
        driver_number: driver.driverNumber,
      }
      return { ...driver, sample }
    })
  }, [samples, status, tick])

  return {
    rows,
    status,
    replayTime: rows[0]?.sample.date ?? fallbackSample.date,
  }
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
  const telemetry = useOpenF1Replay()

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
          <span>{openF1Window}</span>
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
            <span>{telemetry.status === 'live' ? 'OPENF1 REPLAY' : 'LOCAL FALLBACK'}</span>
            <strong>Lap 46 / 62</strong>
          </div>
          <div className="event-progress">
            <span style={{ width: '79%' }}></span>
          </div>
          <div className="event-grid">
            <span>SYNC</span>
            <strong>{delay >= 0 ? '+' : ''}{delay.toFixed(1)}s</strong>
            <span>WINDOWS</span>
            <strong>{activeSources.length}</strong>
            <span>TELEMETRY</span>
            <strong>{telemetry.rows.length}</strong>
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
              telemetryRows={telemetry.rows}
              telemetryStatus={telemetry.status}
              replayTime={telemetry.replayTime}
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
  telemetryRows,
  telemetryStatus,
  replayTime,
  playing,
  muted,
  focused,
  onFocus,
}: {
  source: FeedSource
  index: number
  telemetryRows: TelemetryRow[]
  telemetryStatus: 'loading' | 'live' | 'fallback'
  replayTime: string
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
          <RaceFeed rows={telemetryRows} replayTime={replayTime} />
        ) : source.kind === 'demo-onboard' ? (
          <OnboardFeed source={source} row={telemetryRows.find((item) => item.driverNumber === source.driverNumber) ?? telemetryRows[0]} />
        ) : source.kind === 'timing' ? (
          <TimingPanel rows={telemetryRows} status={telemetryStatus} />
        ) : source.kind === 'track-map' ? (
          <TrackMapPanel rows={telemetryRows} />
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

function RaceFeed({ rows, replayTime }: { rows: TelemetryRow[]; replayTime: string }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const lap = 46 + Math.floor((tick % 24) / 12)
  const leader = rows[0]
  const second = rows[1]

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
        <strong>REPLAY</strong>
        <span>{new Date(replayTime).toLocaleTimeString('en-US', { hour12: false })}</span>
      </div>
      <div className="lower-third">
        <div>
          <span>Leader</span>
          <strong>{leader?.code ?? 'SAI'}</strong>
        </div>
        <div>
          <span>Lap</span>
          <strong>{lap}/62</strong>
        </div>
        <div>
          <span>{second?.code ?? 'P2'} gap</span>
          <strong>{second?.gap ?? '+0.812'}</strong>
        </div>
      </div>
    </div>
  )
}

function OnboardFeed({ source, row }: { source: FeedSource; row?: TelemetryRow }) {
  const sample = row?.sample ?? fallbackSample
  const speed = Math.round(sample.speed)
  const gear = sample.n_gear
  const throttle = Math.max(0, Math.min(100, sample.throttle))
  const brake = Math.max(0, Math.min(100, sample.brake))
  const rpm = Math.round(sample.rpm)
  const drsOpen = sample.drs >= 8

  return (
    <div className="onboard-feed">
      <div className="cockpit-view">
        <span className="halo"></span>
        <span className="road"></span>
        <span className="apex-light"></span>
        <span className="wheel"></span>
      </div>
      <div className="driver-tag">
        <strong>{row?.code ?? source.driver ?? 'DRIVER'}</strong>
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
          <small>{rpm}</small>
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
        <label>
          <span>DRS</span>
          <i className={drsOpen ? 'drs-open' : ''} style={{ width: drsOpen ? '100%' : '18%' }}></i>
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

function TimingPanel({ rows, status }: { rows: TelemetryRow[]; status: 'loading' | 'live' | 'fallback' }) {
  return (
    <div className="timing-panel">
      <div className="telemetry-source">
        <span>{status === 'live' ? 'OpenF1 car_data replay' : status === 'loading' ? 'Loading OpenF1 car_data' : 'Fallback telemetry'}</span>
        <strong>speed throttle brake rpm gear drs</strong>
      </div>
      {rows.map((row) => (
        <TelemetryTowerRow row={row} key={row.driverNumber} />
      ))}
    </div>
  )
}

function TelemetryTowerRow({ row }: { row: TelemetryRow }) {
  const sample = row.sample
  const speed = Math.round(sample.speed)
  const rpm = Math.round(sample.rpm)
  const drsOpen = sample.drs >= 8
  const rpmPercent = Math.min(100, Math.max(0, (rpm / 13000) * 100))

  return (
    <article className="telemetry-row" style={{ '--team': row.teamColor, '--rpm': `${rpmPercent}%` } as CSSProperties}>
      <div className="position-cell">
        <strong>{row.pos}</strong>
        <span className={row.delta > 0 ? 'delta up' : row.delta < 0 ? 'delta down' : 'delta'}>{row.delta > 0 ? `+${row.delta}` : row.delta}</span>
      </div>
      <div className="driver-cell">
        <strong>{row.code}</strong>
        <span>{row.driverNumber}</span>
      </div>
      <div className={drsOpen ? 'drs-cell open' : 'drs-cell'}>
        <span>DRS</span>
        <strong>{drsOpen ? 'OPEN' : 'OFF'}</strong>
      </div>
      <div className="rpm-cell">
        <div className="mini-rpm">
          <strong>{sample.n_gear}</strong>
        </div>
        <span>{rpm}</span>
      </div>
      <div className="speed-cell">
        <strong>{speed}</strong>
        <span>km/h</span>
      </div>
      <div className="lap-cell">
        <span>BEST</span>
        <strong>{row.best}</strong>
        <span>LAST {row.last}</span>
      </div>
      <div className="gap-cell">
        <span>{row.gap}</span>
        <strong>{row.interval}</strong>
      </div>
      <div className="sector-cells">
        {row.sectors.map((sector, index) => (
          <i className={sector} key={`${row.driverNumber}-${index}`}></i>
        ))}
      </div>
      <div className={`tyre tyre-${row.compound.toLowerCase()}`}>
        <strong>{row.compound}</strong>
        <span>{row.tyreAge}</span>
      </div>
    </article>
  )
}

function TrackMapPanel({ rows }: { rows: TelemetryRow[] }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1200)
    return () => window.clearInterval(id)
  }, [])

  const cars = rows.slice(0, 4).map((row, index) => {
    const points = [
      { x: 28 + (tick % 8) * 2, y: 31 },
      { x: 61, y: 23 + (tick % 6) * 2 },
      { x: 74 - (tick % 5) * 2, y: 64 },
      { x: 39, y: 76 - (tick % 7) * 2 },
    ]
    return { id: String(row.driverNumber), color: row.teamColor, ...points[index] }
  })

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
    ['46', 'YELLOW', 'Sector 2 local yellow'],
    ['45', 'INFO', 'Car 55 reports rear degradation'],
    ['43', 'DRS', 'DRS enabled'],
    ['42', 'PIT', 'Car 44 pit exit clear'],
    ['40', 'RADIO', 'Car 4 told to hold DRS gap'],
    ['38', 'INFO', 'Singapore 2023 replay data'],
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
        <span>SAI</span>
        <span>NOR</span>
        <span>HAM</span>
      </div>
    </div>
  )
}

export default App
