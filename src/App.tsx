import React, { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Clock3,
  Download,
  Ellipsis,
  ExternalLink,
  Folder,
  FolderPlus,
  Globe2,
  Inbox,
  Mail,
  PanelLeft,
  Plus,
  Radar,
  RefreshCw,
  Satellite,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  SquareArrowOutUpRight,
  X,
} from 'lucide-react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { categories, mock, sortSignals, type Order, type Signal } from './data'
import {
  copyText,
  desktop,
  openExternal,
  openWorkspace,
  runResearch,
  type Brief,
  type Provider,
} from './native'
import { exportBrief, signalBrief, type Format } from './export'
import { Menu, Modal, OrbitPlate, RowMenu, type Action } from './ui'

const params = new URLSearchParams(location.search)
const compact = params.has('tray')
const searchShortcut = navigator.platform.includes('Mac') ? '⌘ K' : 'Ctrl K'
type Notes = Record<
  string,
  { saved?: boolean; read?: boolean; folders?: string[]; tags?: string[]; highlight?: string }
>
type Panel = 'settings' | 'analysis' | 'folder' | 'share' | 'help' | null
const domainIcons = [Radar, Globe2, Activity, Satellite]
const formats: Format[] = ['PDF', 'Word', 'PowerPoint']
function useLocal<T>(key: string, initial: T) {
  const read = () => {
    try {
      return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? initial
    } catch {
      return initial
    }
  }
  const [value, setValue] = useState(read)
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === key) setValue(read())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [key])
  return [
    value,
    (update: T | ((old: T) => T)) => {
      const next = typeof update === 'function' ? (update as (old: T) => T)(read()) : update
      localStorage.setItem(key, JSON.stringify(next))
      setValue(next)
    },
  ] as const
}
const fmtTime = (time: string) => {
  const [h, m] = time.split(':')
  return `${Number(h) % 12 || 12}:${m} ${Number(h) < 12 ? 'AM' : 'PM'}`
}
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
const Mark = ({ row }: { row: Signal }) => (
  <span className={`mark ${row.tone}`} aria-hidden="true">
    {row.mark}
  </span>
)
const Importance = ({ row }: { row: Signal }) => (
  <span className={`importance ${row.importance >= 85 ? 'high' : ''}`}>
    <Activity size={12} />
    {row.importance}%<span className="sr-only"> importance</span>
  </span>
)

export function App() {
  const [notes, setNotes] = useLocal<Notes>('signal.notes', {})
  const [folders, setFolders] = useLocal<string[]>('signal.folders', ['Market watch'])
  const [savedBrief, setSavedBrief] = useLocal<Brief | null>('signal.brief', null)
  const [providerSettings, setProviderSettings] = useLocal('signal.provider', {
    endpoint: '',
    model: '',
    slack: '',
  })
  const [token, setToken] = useState('')
  const [records, setRecords] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [feedError, setFeedError] = useState('')
  const [nav, setNav] = useState('All signals')
  const [quick, setQuick] = useState('All signals')
  const [order, setOrder] = useState<Order>('Latest first')
  const [query, setQuery] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [detailId, setDetailId] = useState<string | null>(params.get('signal'))
  const [panel, setPanel] = useState<Panel>(null)
  const [folderTarget, setFolderTarget] = useState<string | null>(null)
  const [folderName, setFolderName] = useState('')
  const [shareBrief, setShareBrief] = useState<Brief | null>(null)
  const [objective, setObjective] = useState('')
  const [audience, setAudience] = useState('Strategy leadership')
  const [mode, setMode] = useState('Strategic brief')
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [brief, setBrief] = useState<Brief | null>(null)
  const [toast, setToast] = useState('')
  const [railOpen, setRailOpen] = useState(false)
  const search = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<number>(0)
  const tell = (message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 3500)
  }
  const changeNote = (id: string, fn: (previous: Notes[string]) => Notes[string]) =>
    setNotes((prev) => ({ ...prev, [id]: fn(prev[id] ?? {}) }))
  const reload = async () => {
    setLoading(true)
    setFeedError('')
    try {
      const res = await mock.fetch('/v1/signals')
      if (!res.ok) throw new Error('Feed unavailable')
      setRecords((await res.json()).records)
    } catch {
      setFeedError('The sample feed couldn’t load. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void reload()
  }, [])
  useEffect(() => {
    if (!desktop || compact) return
    let stop: undefined | (() => void)
    let cancelled = false
    void listen<string>('workspace-signal', (event) => setDetailId(event.payload)).then((fn) => {
      if (cancelled) fn()
      else stop = fn
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        search.current?.focus()
      }
      if (compact && desktop && e.key === 'Escape') void invoke('hide_inbox')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const rows = sortSignals(
    records.filter((row) => {
      const note = notes[row.id]
      const inNav =
        nav === 'All signals' ||
        (nav === 'Read later' && note?.saved) ||
        nav === row.category ||
        (nav.startsWith('folder:') && note?.folders?.includes(nav.slice(7)))
      return (
        inNav &&
        (quick !== 'High importance' || row.importance >= 85) &&
        (quick !== 'Unread' || !note?.read) &&
        `${row.title} ${row.company} ${row.publisher} ${row.summary} ${note?.tags?.join(' ') ?? ''}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      )
    }),
    order,
  )
  const chosen = selecting ? records.filter((r) => selected.includes(r.id)) : []
  const detail = records.find((r) => r.id === detailId)
  const toggle = (id: string) =>
    setSelected((old) => (old.includes(id) ? old.filter((key) => key !== id) : [...old, id]))
  const bookmark = (id: string) => {
    changeNote(id, (old) => ({ ...old, saved: !old.saved }))
    tell(notes[id]?.saved ? 'Removed from Read later' : 'Saved to Read later')
  }
  const readRow = (id: string) => {
    changeNote(id, (old) => ({ ...old, read: true }))
    setDetailId(id)
  }
  const chooseNav = (name: string) => {
    setNav(name)
    setQuick('All signals')
    setQuery('')
    setRailOpen(false)
  }
  const save = (doc: Brief, format: Format) => {
    void exportBrief(doc, format)
      .then((saved) => {
        if (saved) tell(`${format} exported`)
      })
      .catch(() => tell(`Couldn’t export ${format}. Try a different location.`))
  }
  const share = (doc: Brief) => {
    setShareBrief(doc)
    setPanel('share')
  }
  const newFolder = (id: string | null) => {
    setFolderTarget(id)
    setFolderName('')
    setFormError('')
    setPanel('folder')
  }
  const setFolder = (id: string, name: string) => {
    const exists = notes[id]?.folders?.includes(name)
    changeNote(id, (old) => ({
      ...old,
      folders: exists ? old.folders?.filter((f) => f !== name) : [...(old.folders ?? []), name],
    }))
    tell(exists ? `Removed from ${name}` : `Added to ${name}`)
  }
  const rowActions = (row: Signal): Action[] => [
    {
      label: notes[row.id]?.saved ? 'Remove bookmark' : 'Save to Read later',
      icon: <Bookmark size={15} />,
      run: () => bookmark(row.id),
    },
    ...folders.map((name) => ({
      label: `${notes[row.id]?.folders?.includes(name) ? 'Remove from' : 'Add to'} ${name}`,
      icon: <Folder size={15} />,
      run: () => setFolder(row.id, name),
    })),
    { label: 'Create folder…', icon: <FolderPlus size={15} />, run: () => newFolder(row.id) },
    {
      label: 'Select for analysis',
      icon: <Sparkles size={15} />,
      run: () => {
        setSelecting(true)
        setSelected((old) => (old.includes(row.id) ? old : [...old, row.id]))
        setDetailId(null)
      },
    },
    { label: 'Export PDF', icon: <Download size={15} />, run: () => save(signalBrief([row]), 'PDF') },
    { label: 'Share signal…', icon: <Share2 size={15} />, run: () => share(signalBrief([row])) },
  ]
  function startAnalysis(existing?: Brief | null) {
    setBrief(existing ?? null)
    setFormError('')
    setPanel('analysis')
  }
  const createBrief = async () => {
    setFormError('')
    setBusy(true)
    try {
      const input = { records: chosen, objective: objective.trim(), audience, mode }
      let result: Brief
      if (live) {
        const provider: Provider = {
          endpoint: providerSettings.endpoint,
          model: providerSettings.model,
          token,
        }
        if (!desktop || !provider.endpoint || !provider.model || !provider.token)
          throw new Error('Open the desktop app and enter the endpoint, model and session token in Settings.')
        result = await runResearch(input, provider)
      } else {
        const res = await mock.fetch('/v1/briefs', { method: 'POST', body: JSON.stringify(input) })
        if (!res.ok) throw new Error('The sample brief could not be generated.')
        result = await res.json()
      }
      setBrief(result)
      setSavedBrief(result)
    } catch (e) {
      setFormError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const copy = async (text: string, confirmation = 'Copied to clipboard') => {
    try {
      await copyText(text)
      tell(confirmation)
      return true
    } catch {
      tell('Clipboard unavailable. Select and copy the text manually.')
      return false
    }
  }
  const sendShare = async (channel: 'Outlook' | 'Slack') => {
    if (!shareBrief) return
    const body = `${shareBrief.title}\n\n${shareBrief.text}`
    try {
      if (channel === 'Slack') {
        if (!(await copy(body, 'Copied. Paste into your Slack channel to share.'))) return
        const url = new URL(providerSettings.slack || 'https://app.slack.com/client')
        if (
          url.protocol !== 'https:' ||
          !(url.hostname === 'slack.com' || url.hostname.endsWith('.slack.com'))
        )
          throw new Error('Use an HTTPS slack.com workspace URL.')
        await openExternal(url.href)
      } else {
        const long = body.length > 1200
        if (long && !(await copy(body, 'Full text copied. Paste it into the Outlook draft.'))) return
        const url = new URL('https://outlook.office.com/mail/deeplink/compose')
        url.searchParams.set('subject', shareBrief.title)
        url.searchParams.set(
          'body',
          long ? 'Paste the prepared Signal Desk brief from your clipboard.' : body,
        )
        await openExternal(url.href)
      }
    } catch (e) {
      tell(errorText(e))
    }
  }

  if (compact)
    return (
      <section className="mini">
        <header>
          <span className="brand-icon">
            <Radar size={20} />
          </span>
          <div>
            <strong>Signal Desk</strong>
            <span>Competitive inbox</span>
          </div>
          <button
            className="icon"
            title="Open workspace"
            aria-label="Open workspace"
            onClick={() => void openWorkspace()}
          >
            <SquareArrowOutUpRight size={16} />
          </button>
        </header>
        <div className="mini-heading">
          Latest signals <span>Sample feed</span>
        </div>
        <div className="mini-list">
          {loading && <p className="mini-empty">Loading signals…</p>}
          {feedError && (
            <button className="button" onClick={() => void reload()}>
              Retry feed
            </button>
          )}
          {records.slice(0, 10).map((row) => (
            <button
              className="mini-row"
              key={row.id}
              onClick={() => {
                changeNote(row.id, (old) => ({ ...old, read: true }))
                void openWorkspace(row.id)
              }}
            >
              <Mark row={row} />
              <span className="mini-copy">
                <small>
                  {row.publisher} <span>{fmtTime(row.time)}</span>
                </small>
                <strong>{row.title}</strong>
              </span>
              <Importance row={row} />
            </button>
          ))}
        </div>
        <footer>
          <button className="button" onClick={() => void openWorkspace()}>
            More signals <ArrowRight size={15} />
          </button>
        </footer>
      </section>
    )

  const sidebarItem = (name: string, icon: React.ReactNode, count?: number, label = name) => (
    <button key={name} className={`nav-item ${nav === name ? 'active' : ''}`} onClick={() => chooseNav(name)}>
      {icon}
      <span>{label}</span>
      {!!count && <small>{count}</small>}
    </button>
  )
  const title = nav.startsWith('folder:') ? nav.slice(7) : nav === 'All signals' ? 'Intelligence feed' : nav
  const exports = (doc: Brief): Action[] =>
    formats.map((format) => ({
      label: `Export ${format}`,
      icon: <Download size={14} />,
      run: () => save(doc, format),
    }))
  const closePanel = () => {
    if (!busy) setPanel(null)
  }
  return (
    <div className="shell">
      <aside className={`rail ${railOpen ? 'rail-open' : ''}`}>
        <div className="brand" data-tauri-drag-region>
          <span className="brand-icon">
            <Radar size={23} />
          </span>
          <div>
            <strong>Signal Desk</strong>
            <span>HawkEye 360</span>
          </div>
        </div>
        <nav aria-label="Workspace navigation">
          <div className="nav-group">
            <div className="nav-label">Workspace</div>
            {sidebarItem('All signals', <Inbox />, records.length)}
            {sidebarItem('Read later', <Bookmark />, records.filter((r) => notes[r.id]?.saved).length)}
            <button
              className={`nav-item ${selecting ? 'active' : ''}`}
              onClick={() => {
                chooseNav('All signals')
                setSelecting(true)
              }}
            >
              <Sparkles />
              <span>Strategic analysis</span>
            </button>
          </div>
          <div className="nav-group">
            <div className="nav-label">Domains</div>
            {categories.map((category, i) => {
              const Icon = domainIcons[i]
              return sidebarItem(category, <Icon />)
            })}
          </div>
          <div className="nav-group">
            <div className="nav-label">
              Folders{' '}
              <button
                className="icon"
                title="New folder"
                aria-label="New folder"
                onClick={() => newFolder(null)}
              >
                <Plus size={15} />
              </button>
            </div>
            {folders.map((folder) =>
              sidebarItem(
                `folder:${folder}`,
                <Folder />,
                records.filter((r) => notes[r.id]?.folders?.includes(folder)).length,
                folder,
              ),
            )}
          </div>
        </nav>
        <div className="rail-bottom">
          <button className="nav-item" onClick={() => setPanel('settings')}>
            <Settings />
            <span>Settings</span>
          </button>
          <button className="nav-item" onClick={() => setPanel('help')}>
            <CircleHelp />
            <span>About Signal Desk</span>
          </button>
          <div className="profile">
            <span>HE</span>
            <div>
              <strong>HawkEye 360</strong>
              <small>Strategy workspace</small>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar" data-tauri-drag-region>
          <div className="crumb">
            <button
              className="icon rail-toggle"
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
              onClick={() => setRailOpen(!railOpen)}
            >
              <PanelLeft size={16} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <button
              className="icon"
              title="Refresh signals"
              aria-label="Refresh signals"
              onClick={() => {
                void reload()
                tell('Refreshing sample feed')
              }}
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="icon"
              title="Digest notifications"
              aria-label="Digest notifications"
              onClick={() => setPanel('settings')}
            >
              <Bell size={17} />
            </button>
            <span className="sample-label">Sample feed</span>
          </div>
        </header>
        <div className="content">
          <div className="page-title">
            <div>
              <h1>{selecting ? 'Strategic analysis' : title}</h1>
              <p>
                {selecting
                  ? 'Select evidence to build a decision-ready brief.'
                  : nav === 'All signals'
                    ? 'Competitive signals across the commercial space landscape.'
                    : 'Browse and organize the signals in this view.'}
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                if (selecting) startAnalysis()
                else {
                  setSelecting(true)
                  chooseNav('All signals')
                }
              }}
              disabled={selecting && chosen.length < 2}
            >
              <Sparkles size={16} />
              {selecting ? 'Build brief' : 'New analysis'}
            </button>
          </div>
          {nav === 'All signals' && !selecting && (
            <section className="digest">
              <OrbitPlate />
              <div className="digest-body">
                <div className="digest-title">
                  <span className="digest-icon">
                    <RadioWave />
                  </span>
                  <h2>Morning digest</h2>
                </div>
                <p>A snapshot of the signals shaping your market.</p>
                <div className="digest-facts">
                  <span>
                    <strong>{records.length}</strong> signals
                  </span>
                  <span>
                    <strong>{records.filter((r) => r.importance >= 85).length}</strong> high importance
                  </span>
                  <span>
                    <Clock3 size={13} /> 8:00 AM digest
                  </span>
                </div>
              </div>
              <button
                className="button digest-button"
                onClick={() => {
                  setQuick('High importance')
                  document.getElementById('signal-list')?.scrollIntoView({ block: 'nearest' })
                }}
              >
                Review priority signals <ArrowUpRight size={15} />
              </button>
            </section>
          )}
          <section id="signal-list" className="queue" aria-label="Signals">
            <div className="queue-controls">
              <div className="tabs" role="group" aria-label="Filter signals">
                {['All signals', 'High importance', 'Unread'].map((tab) => (
                  <button
                    key={tab}
                    className={quick === tab ? 'current' : ''}
                    aria-pressed={quick === tab}
                    onClick={() => setQuick(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="tools">
                <label className="search">
                  <Search size={15} />
                  <input
                    ref={search}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search signals…"
                    aria-label="Search signals"
                  />
                  {query ? (
                    <button className="icon" aria-label="Clear search" onClick={() => setQuery('')}>
                      <X size={13} />
                    </button>
                  ) : (
                    <kbd>{searchShortcut}</kbd>
                  )}
                </label>
                <Menu
                  trigger={
                    <button className="button compact-button" title="Filter signals">
                      <SlidersHorizontal size={15} />
                      <span>Filter</span>
                    </button>
                  }
                  actions={[
                    ...['All signals', 'High importance', 'Unread'].map((item) => ({
                      label: item,
                      run: () => setQuick(item),
                    })),
                    ...categories.map((item) => ({ label: item, run: () => chooseNav(item) })),
                  ]}
                />
                <Menu
                  trigger={
                    <button
                      className="button compact-button"
                      title="Order signals"
                      aria-label="Order signals"
                    >
                      <ArrowDownUp size={15} />
                    </button>
                  }
                  actions={(['Latest first', 'Highest importance', 'Company A–Z'] as Order[]).map((item) => ({
                    label: item,
                    icon: order === item ? <Check size={14} /> : undefined,
                    run: () => setOrder(item),
                  }))}
                />
                <Menu
                  trigger={
                    <button
                      className="button compact-button"
                      title="Export signals"
                      aria-label="Export signals"
                      disabled={!rows.length && !chosen.length}
                    >
                      <Download size={15} />
                      <span>Export</span>
                      <ChevronDown size={12} />
                    </button>
                  }
                  actions={exports(signalBrief(chosen.length ? chosen : rows))}
                />
              </div>
            </div>
            {selecting && (
              <div className="selection">
                <span>
                  <strong>{chosen.length} selected</strong>{' '}
                  {chosen.length < 2 ? '/ Select at least 2' : '/ Ready for analysis'}
                </span>
                <button
                  className="button"
                  onClick={() => setSelected((old) => [...new Set([...old, ...rows.map((r) => r.id)])])}
                >
                  Select visible
                </button>
                <button
                  className="button"
                  disabled={!chosen.length}
                  onClick={() => share(signalBrief(chosen))}
                >
                  <Share2 size={14} /> Share
                </button>
                {savedBrief && (
                  <button className="button" onClick={() => startAnalysis(savedBrief)}>
                    Last brief
                  </button>
                )}
                <button
                  className="icon"
                  aria-label="Exit selection"
                  onClick={() => {
                    setSelecting(false)
                    setSelected([])
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="queue-label">
              <span>
                {rows.length} {rows.length === 1 ? 'signal' : 'signals'}
              </span>
              <button className="text-button" onClick={() => setSelecting(!selecting)}>
                {selecting ? 'Hide selection' : 'Select'}
              </button>
            </div>
            {loading && !records.length && (
              <div className="empty" role="status">
                Loading signals…
              </div>
            )}
            {feedError && (
              <div className="empty">
                <p>{feedError}</p>
                <button className="button" onClick={() => void reload()}>
                  Retry feed
                </button>
              </div>
            )}
            {!rows.length && !loading && !feedError && (
              <div className="empty">
                <Inbox size={24} />
                <p>No matching signals.</p>
                <button className="button" onClick={() => chooseNav('All signals')}>
                  Show all signals
                </button>
              </div>
            )}
            {rows.map((row) => (
              <RowMenu key={row.id} actions={rowActions(row)}>
                <article className={`signal-row ${selected.includes(row.id) && selecting ? 'selected' : ''}`}>
                  {selecting && (
                    <input
                      className="select-box"
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.title}`}
                    />
                  )}
                  <button
                    className="signal-main"
                    onClick={() => (selecting ? toggle(row.id) : readRow(row.id))}
                  >
                    <Mark row={row} />
                    <span className="signal-copy">
                      <span className="meta">
                        <strong>{row.publisher}</strong>
                        <span className="meta-separator" />
                        <span>{row.company}</span>
                        <span className="category">{row.category}</span>
                      </span>
                      <span className="signal-title">{row.title}</span>
                      <span className="summary">{row.summary}</span>
                    </span>
                  </button>
                  <div className="score">
                    <Importance row={row} />
                    <time>{fmtTime(row.time)}</time>
                  </div>
                  <div className="row-actions">
                    <button
                      className={`icon ${notes[row.id]?.saved ? 'bookmarked' : ''}`}
                      title={notes[row.id]?.saved ? 'Remove bookmark' : 'Save to Read later'}
                      aria-label={`Bookmark ${row.title}`}
                      aria-pressed={!!notes[row.id]?.saved}
                      onClick={() => bookmark(row.id)}
                    >
                      <Bookmark size={16} />
                    </button>
                    <Menu
                      trigger={
                        <button className="icon" aria-label={`Actions for ${row.title}`}>
                          <Ellipsis size={17} />
                        </button>
                      }
                      actions={rowActions(row)}
                    />
                  </div>
                </article>
              </RowMenu>
            ))}
          </section>
          <footer className="workspace-footer">
            <span>Sample intelligence for evaluation</span>
            <span>Digests at 8:00 AM, 11:00 AM and 4:00 PM local time</span>
          </footer>
        </div>
      </main>
      {detail && !panel && (
        <Modal
          title={detail.title}
          subtitle={`${detail.publisher} / ${detail.company} / Sample record`}
          close={() => setDetailId(null)}
        >
          <SignalDetail
            key={detail.id}
            record={detail}
            note={notes[detail.id]}
            update={(patch) => changeNote(detail.id, (old) => ({ ...old, ...patch }))}
            bookmark={() => bookmark(detail.id)}
            actions={rowActions(detail)}
          />
        </Modal>
      )}
      {panel === 'folder' && (
        <Modal title="New folder" subtitle="Keep related signals together." close={closePanel}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const name = folderName.trim()
              if (!name || folders.some((f) => f.toLowerCase() === name.toLowerCase())) {
                setFormError('Enter a unique folder name.')
                return
              }
              setFolders([...folders, name])
              if (folderTarget) setFolder(folderTarget, name)
              else chooseNav(`folder:${name}`)
              setPanel(null)
            }}
          >
            <label>
              Folder name
              <input
                autoFocus
                maxLength={48}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
            </label>
            {formError && (
              <p role="alert" className="error">
                {formError}
              </p>
            )}
            <div className="dialog-actions">
              <button className="button primary">Create folder</button>
            </div>
          </form>
        </Modal>
      )}
      {panel === 'settings' && (
        <Modal title="Settings" subtitle="Local workspace preferences and connections." close={closePanel}>
          <h3>Digest notifications</h3>
          <p className="dialog-description">
            8:00 AM, 11:00 AM and 4:00 PM in your system time zone while Signal Desk is running.
          </p>
          <button
            className="button"
            disabled={!desktop}
            onClick={() =>
              void invoke('test_notification')
                .then(() => tell('Test notification requested'))
                .catch((e) => tell(errorText(e)))
            }
          >
            <Bell size={15} /> Test notification
          </button>
          {desktop && <LaunchAtLogin />}
          <h3>OpenCode inference</h3>
          <p className="dialog-description">
            Use an approved OpenAI-compatible endpoint. The token is held in memory until the app exits.
          </p>
          <label>
            Endpoint
            <input
              type="url"
              placeholder="https://provider.example/v1"
              value={providerSettings.endpoint}
              onChange={(e) => setProviderSettings({ ...providerSettings, endpoint: e.target.value })}
            />
          </label>
          <label>
            Model
            <input
              placeholder="Provider model ID"
              value={providerSettings.model}
              onChange={(e) => setProviderSettings({ ...providerSettings, model: e.target.value })}
            />
          </label>
          <label>
            API token
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <h3>Sharing</h3>
          <label>
            Slack workspace URL
            <input
              type="url"
              placeholder="https://your-workspace.slack.com"
              value={providerSettings.slack}
              onChange={(e) => setProviderSettings({ ...providerSettings, slack: e.target.value })}
            />
          </label>
          <div className="dialog-actions">
            <button className="button primary" onClick={closePanel}>
              Done
            </button>
          </div>
        </Modal>
      )}
      {panel === 'help' && (
        <Modal
          title="About Signal Desk"
          subtitle="Competitive intelligence workspace for HawkEye 360."
          close={closePanel}
        >
          <p className="detail-summary">
            This evaluation build uses fictional sample stories, even where competitor and publisher names are
            real. Do not cite these records as verified events.
          </p>
          <p className="detail-summary">
            Right-click a signal to organize it, or use Strategic analysis to select evidence and build a
            brief. Search titles, summaries, publishers, companies and your tags with Ctrl+K or ⌘K.
          </p>
          {!desktop && (
            <a className="button" href="/?tray=1">
              Preview tray inbox <ExternalLink size={14} />
            </a>
          )}
        </Modal>
      )}
      {panel === 'analysis' && (
        <Modal
          title={brief?.title ?? 'Build an analysis'}
          subtitle={
            brief
              ? 'Review the draft before exporting or sharing.'
              : `${chosen.length} evidence records selected`
          }
          close={closePanel}
        >
          {brief ? (
            <>
              <pre className="brief-text">{brief.text}</pre>
              <div className="dialog-actions">
                <button className="button" onClick={() => share(brief)}>
                  <Share2 size={15} /> Share
                </button>
                <Menu
                  trigger={
                    <button className="button primary">
                      <Download size={15} /> Export <ChevronDown size={13} />
                    </button>
                  }
                  actions={exports(brief)}
                />
              </div>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void createBrief()
              }}
            >
              <label>
                What decision should this inform?
                <textarea
                  required
                  rows={4}
                  maxLength={3000}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Compare commercial positioning and identify questions for our next customer discovery session."
                />
              </label>
              <label>
                Audience
                <select value={audience} onChange={(e) => setAudience(e.target.value)}>
                  {[
                    'Strategy leadership',
                    'Business development',
                    'Executive team',
                    'Product and partnerships',
                  ].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label>
                Framing
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  {['Strategic brief', 'Summarize', 'Explain'].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={live}
                  disabled={!desktop}
                  onChange={(e) => setLive(e.target.checked)}
                />{' '}
                Use OpenCode with my configured provider
              </label>
              {live && (
                <p className="dialog-description">
                  Selected sample records and your objective will be sent to the configured inference
                  provider. Do not enter sensitive information.
                </p>
              )}
              {formError && (
                <p className="error" role="alert">
                  {formError}
                </p>
              )}
              <div className="dialog-actions">
                <button className="button primary" disabled={busy || !objective.trim() || chosen.length < 2}>
                  <Sparkles size={15} />
                  {busy ? 'Building brief…' : live ? 'Run with OpenCode' : 'Generate sample brief'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
      {panel === 'share' && shareBrief && (
        <Modal
          title="Share"
          subtitle="Review your content before sending it from your workspace."
          close={closePanel}
        >
          <pre className="brief-text">
            {shareBrief.title}
            {'\n\n'}
            {shareBrief.text}
          </pre>
          <div className="dialog-actions share-actions">
            <button className="button" onClick={() => void copy(`${shareBrief.title}\n\n${shareBrief.text}`)}>
              <Clipboard size={15} /> Copy text
            </button>
            <button className="button" onClick={() => void sendShare('Slack')}>
              <Share2 size={15} /> Open Slack
            </button>
            <button className="button primary" onClick={() => void sendShare('Outlook')}>
              <Mail size={15} /> Outlook draft
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div role="status" className="toast">
          <Activity size={16} />
          {toast}
        </div>
      )}
    </div>
  )
}
function SignalDetail({
  record,
  note,
  update,
  bookmark,
  actions,
}: {
  record: Signal
  note?: Notes[string]
  update: (note: Notes[string]) => void
  bookmark: () => void
  actions: Action[]
}) {
  const [highlight, setHighlight] = useState(note?.highlight ?? '')
  const summary = useRef<HTMLParagraphElement>(null)
  const capture = () => {
    const selection = window.getSelection()
    const text =
      selection &&
      summary.current?.contains(selection.anchorNode) &&
      summary.current?.contains(selection.focusNode)
        ? selection.toString().trim()
        : record.summary
    if (text) {
      setHighlight(text)
      update({ highlight: text })
    }
  }
  const at = highlight && record.summary.indexOf(highlight)
  return (
    <>
      <p className="detail-summary" ref={summary}>
        {typeof at === 'number' && at >= 0 ? (
          <>
            {record.summary.slice(0, at)}
            <mark>{highlight}</mark>
            {record.summary.slice(at + highlight.length)}
          </>
        ) : (
          record.summary
        )}
      </p>
      <div className="detail-meta">
        <Importance row={record} />
        <span className="category">{record.category}</span>
        <button className="text-button" onMouseDown={(event) => event.preventDefault()} onClick={capture}>
          Highlight excerpt
        </button>
      </div>
      <label>
        Tags{' '}
        <input
          maxLength={300}
          placeholder="Comma-separated tags"
          defaultValue={note?.tags?.join(', ')}
          onChange={(e) =>
            update({
              tags: [
                ...new Set(
                  e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                ),
              ],
            })
          }
        />
      </label>
      <label>
        Highlight or note{' '}
        <textarea
          rows={3}
          maxLength={3000}
          placeholder="Capture a quote or a takeaway…"
          value={highlight}
          onChange={(e) => {
            setHighlight(e.target.value)
            update({ highlight: e.target.value })
          }}
        />
      </label>
      <div className="dialog-actions">
        <button className="button" onClick={bookmark}>
          <Bookmark size={15} />
          {note?.saved ? 'Saved' : 'Read later'}
        </button>
        <Menu
          trigger={
            <button className="button">
              <Ellipsis size={15} /> More
            </button>
          }
          actions={actions}
        />
      </div>
    </>
  )
}
function RadioWave() {
  return <Radar size={18} />
}
function LaunchAtLogin() {
  const [enabled, setEnabled] = useState(false)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    void import('@tauri-apps/plugin-autostart')
      .then((p) => p.isEnabled())
      .then(setEnabled)
      .catch(() => setError('Launch at login is unavailable.'))
      .finally(() => setPending(false))
  }, [])
  const change = async (next: boolean) => {
    setPending(true)
    setError('')
    try {
      const plugin = await import('@tauri-apps/plugin-autostart')
      await (next ? plugin.enable() : plugin.disable())
      setEnabled(await plugin.isEnabled())
    } catch {
      setError('Couldn’t update launch at login. Check system settings.')
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <label className="check-label">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={(e) => void change(e.target.checked)}
        />{' '}
        Launch at sign-in
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
