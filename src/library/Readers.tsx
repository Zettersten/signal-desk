import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, Clipboard, Highlighter, Quote } from 'lucide-react'
import { listen } from '@tauri-apps/api/event'
import { exportBrief, signalBrief } from '../export'
import { useIntelligence } from '../catalog'
import type { Catalog, Signal } from '../data'
import {
  excerptFromOffsets,
  paragraphSegments,
  saveHighlight,
  useHighlights,
  type Excerpt,
  type Highlight,
} from '../highlights'
import { useLocal, type RecordNotes } from '../local'
import { copyText, desktop, openDetail, openWorkspace, setReaderTitle } from '../native'
import { WebsiteButton } from './Profiles'

export function Scrapbook() {
  const { entries, error, loading } = useHighlights()
  const [query, setQuery] = useState('')
  const [openError, setOpenError] = useState(false)
  const shown = entries.filter((h) =>
    `${h.quote} ${h.note} ${h.recordTitle}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  return (
    <div className="library-content scrapbook">
      <header className="library-heading">
        <span className="library-symbol">
          <Quote />
        </span>
        <div>
          <h1>Highlights</h1>
          <p>A scrapbook of quoted evidence and your notes.</p>
        </div>
      </header>
      <label className="library-search directory-search">
        <input
          type="search"
          aria-label="Search highlights"
          placeholder="Search quotes, notes and records"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {(error || openError) && (
        <p role="alert" className="error">
          {error || 'Could not open the highlight window.'}
        </p>
      )}
      {loading && <p role="status">Loading highlights…</p>}
      {!loading && !error && !shown.length && (
        <p className="library-empty">
          {entries.length
            ? 'No highlights match your search.'
            : 'Select text in any record and choose Save highlight to start your scrapbook.'}
        </p>
      )}
      <ul className="scrapbook-list">
        {shown.map((h) => (
          <li key={h.id}>
            <button
              onClick={() => {
                setOpenError(false)
                void openDetail('highlight', h.id).catch(() => setOpenError(true))
              }}
            >
              <Quote size={17} />
              <span>
                <strong>{h.quote}</strong>
                <small>
                  {h.recordTitle} / {h.createdAt.slice(0, 10)}
                </small>
                {h.note && <span className="scrap-note">{h.note}</span>}
              </span>
              <ArrowUpRight size={15} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RecordWindow({ id, quoteId }: { id: string; quoteId?: string }) {
  const source = useIntelligence()
  const [catalog, setCatalog] = useState<Catalog>()
  const [error, setError] = useState('')
  const [target, setTarget] = useState(quoteId)
  const record = catalog?.records.find((r) => r.id === id)
  useEffect(() => {
    const abort = new AbortController()
    void source
      .loadCatalog(abort.signal)
      .then((data) => {
        if (!abort.signal.aborted) setCatalog(data)
      })
      .catch(() => {
        if (!abort.signal.aborted) setError('Could not load this record. Close the window and try again.')
      })
    return () => abort.abort()
  }, [source])
  useEffect(() => {
    if (!desktop) return
    let active = true
    let unlisten: (() => void) | undefined
    void listen<string>('record-quote', (e) => {
      setTarget(e.payload)
      document.getElementById(`quote-${e.payload}`)?.scrollIntoView({ block: 'center' })
    })
      .then((stop) => {
        if (active) unlisten = stop
        else stop()
      })
      .catch(() => undefined)
    return () => {
      active = false
      unlisten?.()
    }
  }, [])
  return (
    <main className="reader-window">
      {error ? (
        <p className="library-empty" role="alert">
          {error}
        </p>
      ) : record ? (
        <Article record={record} target={target} />
      ) : (
        <p className="library-empty" role="status">
          {catalog ? 'This record is not in the catalog.' : 'Loading record…'}
        </p>
      )}
    </main>
  )
}

function Article({ record, target }: { record: Signal; target?: string }) {
  const { entries, error, loading } = useHighlights()
  const saved = entries.filter((h) => h.recordId === record.id)
  const [notes, setNotes] = useLocal<RecordNotes>('signal.notes', {})
  const [selected, setSelected] = useState<Excerpt | null>(null)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const prose = useRef<HTMLDivElement>(null)
  const lastJump = useRef<string | undefined>(undefined)
  const note = notes[record.id]
  useEffect(() => {
    setReaderTitle(record.title)
  }, [record.title])
  useEffect(() => {
    if (target && lastJump.current !== target) {
      const mark = document.getElementById(`quote-${target}`)
      if (mark) {
        mark.scrollIntoView({ block: 'center' })
        lastJump.current = target
      }
    }
  }, [target, entries])
  useEffect(() => {
    const readSelection = () => {
      const selection = document.getSelection()
      if (!selection?.rangeCount || selection.isCollapsed) {
        setSelected(null)
        return
      }
      const range = selection.getRangeAt(0)
      const paragraph = range.startContainer.parentElement?.closest<HTMLElement>('[data-paragraph]')
      if (!paragraph || !paragraph.contains(range.endContainer) || !prose.current?.contains(paragraph)) {
        setSelected(null)
        return
      }
      const item = record.paragraphs.find((p) => p.id === paragraph.dataset.paragraph)
      if (!item) return
      const before = document.createRange()
      before.selectNodeContents(paragraph)
      before.setEnd(range.startContainer, range.startOffset)
      const start = before.toString().length
      setSelected(excerptFromOffsets(item, start, start + range.toString().length))
    }
    document.addEventListener('selectionchange', readSelection)
    return () => document.removeEventListener('selectionchange', readSelection)
  }, [record])
  async function capture() {
    if (!selected || saving) return
    const existing = saved.find(
      (h) =>
        h.paragraphId === selected.paragraphId &&
        h.start === selected.start &&
        h.end === selected.end &&
        h.quote === selected.quote,
    )
    if (existing) {
      setFeedback('This quote is already in Highlights.')
      return
    }
    setSaving(true)
    try {
      await saveHighlight({
        ...selected,
        id: crypto.randomUUID(),
        recordId: record.id,
        recordTitle: record.title,
        note: '',
        createdAt: new Date().toISOString(),
      })
      document.getSelection()?.removeAllRanges()
      setSelected(null)
      setFeedback('Saved to Highlights.')
    } catch {
      setFeedback('Could not save this highlight. Try again.')
    } finally {
      setSaving(false)
    }
  }
  const doAction = (action: Promise<unknown>, message: string) =>
    void action.catch(() => setFeedback(message))
  return (
    <>
      <div className="reader-tools">
        <span>Record</span>
        <button
          className="button"
          aria-pressed={!!note?.saved}
          onClick={() =>
            setNotes((old) => ({ ...old, [record.id]: { ...old[record.id], saved: !old[record.id]?.saved } }))
          }
        >
          <Bookmark size={15} />
          {note?.saved ? 'Bookmarked' : 'Bookmark'}
        </button>
        <button
          className="button"
          onClick={() => doAction(exportBrief(signalBrief([record]), 'PDF'), 'Could not export this record.')}
          aria-label="Export record as PDF"
        >
          PDF
        </button>
        <button
          className="button primary"
          disabled={!selected || saving}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void capture()}
        >
          <Highlighter size={15} />
          {saving ? 'Saving…' : 'Save highlight'}
        </button>
      </div>
      <article className="reader-paper">
        <header>
          <div className="article-meta">
            <span className="category">{record.category}</span>
            {record.sample && <span>Sample record</span>}
          </div>
          <h1>{record.title}</h1>
          <div className="article-byline">
            <button
              className="library-link"
              onClick={() =>
                doAction(
                  openWorkspace(`publisher:${record.publisherId}`),
                  'Could not open publisher profile.',
                )
              }
            >
              {record.publisher} <ArrowUpRight size={13} />
            </button>
            <time dateTime={record.publishedAt}>{record.publishedAt.slice(0, 10)}</time>
            <span>{record.importance}% importance</span>
          </div>
        </header>
        <div className="article-body" ref={prose}>
          {record.paragraphs.map((paragraph) => {
            const seen = new Set<string>()
            return (
              <p key={paragraph.id} data-paragraph={paragraph.id}>
                {paragraphSegments(paragraph, saved).map((segment) => {
                  const anchors = segment.highlights.filter((id) => !seen.has(id))
                  anchors.forEach((id) => seen.add(id))
                  return segment.highlights.length ? (
                    <mark
                      key={segment.start}
                      className={target && segment.highlights.includes(target) ? 'target-quote' : ''}
                    >
                      {anchors.map((id) => (
                        <span key={id} id={`quote-${id}`} className="quote-anchor" />
                      ))}
                      {segment.text}
                    </mark>
                  ) : (
                    <span key={segment.start}>{segment.text}</span>
                  )
                })}
              </p>
            )
          })}
        </div>
        <p className="reader-tip">Select text within one paragraph to save a quote.</p>
        {target &&
          !loading &&
          !record.paragraphs.some((paragraph) =>
            paragraphSegments(paragraph, saved).some((segment) => segment.highlights.includes(target)),
          ) && (
            <p className="reader-tip" role="status">
              The saved passage could not be matched to this version of the article. The original quote is
              still in Highlights.
            </p>
          )}
        {(feedback || error) && (
          <p className="reader-tip" role="status">
            {feedback || error}
          </p>
        )}
        <div className="article-links">
          <button
            className="button"
            onClick={() =>
              doAction(
                openWorkspace(`competitor:${record.competitorId}`),
                'Could not open competitor profile.',
              )
            }
          >
            {record.company} <ArrowUpRight size={14} />
          </button>
          <button
            className="button"
            onClick={() => doAction(openWorkspace('Highlights'), 'Could not open Highlights.')}
          >
            Highlights <ArrowUpRight size={14} />
          </button>
          {record.url && <WebsiteButton url={record.url} text="Original source" />}
        </div>
        <label className="reader-field">
          Record tags
          <input
            defaultValue={note?.tags?.join(', ')}
            maxLength={300}
            placeholder="Comma-separated tags"
            onChange={(e) => {
              const tags = [
                ...new Set(
                  e.currentTarget.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                ),
              ]
              setNotes((old) => ({ ...old, [record.id]: { ...old[record.id], tags } }))
            }}
          />
        </label>
        {note?.highlight && (
          <details className="legacy-note">
            <summary>Note saved in an earlier version</summary>
            <p>{note.highlight}</p>
          </details>
        )}
      </article>
    </>
  )
}

export function HighlightWindow({ id }: { id: string }) {
  const { entries, error, loading } = useHighlights()
  const entry = entries.find((h) => h.id === id)
  return (
    <main className="reader-window highlight-window">
      {entry ? (
        <HighlightEditor key={id} entry={entry} />
      ) : (
        <p className="library-empty" role="status">
          {error || (loading ? 'Loading highlight…' : 'This highlight is not in your scrapbook.')}
        </p>
      )}
    </main>
  )
}

function HighlightEditor({ entry }: { entry: Highlight }) {
  useEffect(() => {
    setReaderTitle(`Highlight: ${entry.recordTitle}`)
  }, [entry.recordTitle])
  const [note, setNote] = useState(entry.note)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <article className="reader-paper">
      <h1>Highlight</h1>
      <blockquote>{entry.quote}</blockquote>
      <p className="reader-tip">
        {entry.recordTitle} / {entry.createdAt.slice(0, 10)}
      </p>
      <div className="article-links">
        <button
          className="button"
          onClick={() =>
            void copyText(entry.quote)
              .then(() => setStatus('Quote copied.'))
              .catch(() => setStatus('Could not copy the quote.'))
          }
        >
          <Clipboard size={15} /> Copy quote
        </button>
        <button
          className="button"
          onClick={() =>
            void openDetail('record', entry.recordId, entry.id).catch(() =>
              setStatus('Could not open the source record.'),
            )
          }
        >
          Open source record <ArrowUpRight size={14} />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setBusy(true)
          void saveHighlight({ ...entry, note })
            .then(() => setStatus('Note saved.'))
            .catch(() => setStatus('Could not save the note.'))
            .finally(() => setBusy(false))
        }}
      >
        <label className="reader-field">
          Notes
          <textarea
            rows={5}
            maxLength={3000}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setStatus('')
            }}
            placeholder="What does this quote support?"
          />
        </label>
        <button className="button primary" disabled={busy || note === entry.note}>
          {busy ? 'Saving…' : 'Save note'}
        </button>
      </form>
      {status && (
        <p className="reader-tip" role="status">
          {status}
        </p>
      )}
    </article>
  )
}
