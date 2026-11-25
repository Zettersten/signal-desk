import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { desktop } from './native'
import type { Paragraph } from './data'

export type Highlight = {
  id: string
  recordId: string
  recordTitle: string
  paragraphId: string
  start: number
  end: number
  quote: string
  note: string
  createdAt: string
}
export type Excerpt = Pick<Highlight, 'paragraphId' | 'start' | 'end' | 'quote'>
const prefix = 'signal.quote.'
const event = 'highlights-changed'
function browserList(): Highlight[] {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(prefix))
    .flatMap((key) => {
      try {
        const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Highlight | null
        return value ? [value] : []
      } catch {
        return []
      }
    })
}
async function list() {
  return desktop ? invoke<Highlight[]>('list_highlights') : browserList()
}
export async function saveHighlight(entry: Highlight) {
  if (desktop) return invoke('save_highlight', { entry })
  localStorage.setItem(prefix + entry.id, JSON.stringify(entry))
  window.dispatchEvent(new Event(event))
}
export function useHighlights() {
  const [entries, setEntries] = useState<Highlight[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    let stop: (() => void) | undefined
    let revision = 0
    const refresh = () => {
      const now = ++revision
      void list()
        .then((rows) => {
          if (alive && now === revision) {
            setEntries(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
            setError('')
          }
        })
        .catch(() => {
          if (alive && now === revision) setError('Highlights could not be loaded.')
        })
        .finally(() => {
          if (alive && now === revision) setLoading(false)
        })
    }
    if (desktop)
      void listen(event, refresh)
        .then((fn) => {
          if (alive) {
            stop = fn
            refresh()
          } else fn()
        })
        .catch(refresh)
    else {
      window.addEventListener('storage', refresh)
      window.addEventListener(event, refresh)
      refresh()
    }
    return () => {
      alive = false
      stop?.()
      window.removeEventListener('storage', refresh)
      window.removeEventListener(event, refresh)
    }
  }, [])
  return { entries, error, loading }
}

export function excerptFromOffsets(paragraph: Paragraph, start: number, end: number): Excerpt | null {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end > paragraph.text.length ||
    end <= start
  )
    return null
  const selected = paragraph.text.slice(start, end)
  const quote = selected.trim()
  if (!quote || quote.length > 2000) return null
  const offset = start + selected.indexOf(quote)
  return { paragraphId: paragraph.id, start: offset, end: offset + quote.length, quote }
}
export function paragraphSegments(paragraph: Paragraph, entries: Highlight[]) {
  const valid = entries.filter(
    (h) =>
      h.paragraphId === paragraph.id &&
      h.start >= 0 &&
      h.end <= paragraph.text.length &&
      h.start < h.end &&
      paragraph.text.slice(h.start, h.end) === h.quote,
  )
  const bounds = [...new Set([0, paragraph.text.length, ...valid.flatMap((h) => [h.start, h.end])])].sort(
    (a, b) => a - b,
  )
  return bounds
    .slice(0, -1)
    .map((start, i) => ({
      start,
      text: paragraph.text.slice(start, bounds[i + 1]),
      highlights: valid.filter((h) => h.start <= start && h.end >= bounds[i + 1]).map((h) => h.id),
    }))
}
