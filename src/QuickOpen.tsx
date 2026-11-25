import { useMemo, useState } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import type { Catalog } from './data'
import { listFocusTarget } from './desktop-keys'
import { Modal } from './ui'

export type QuickItem = {
  kind: 'Record' | 'Competitor' | 'Publisher'
  id: string
  title: string
  subtitle: string
}
export function quickItems(catalog: Catalog, query: string, recent: string[]): QuickItem[] {
  const q = query.trim().toLowerCase()
  const records: QuickItem[] = catalog.records.map((r) => ({
    kind: 'Record',
    id: r.id,
    title: r.title,
    subtitle: `${r.company} / ${r.publisher}`,
  }))
  const byId = new Map(records.map((record) => [record.id, record]))
  if (!q)
    return [...new Set(recent)]
      .flatMap((id) => byId.get(id) ?? [])
      .concat(records.filter((r) => !recent.includes(r.id)))
      .slice(0, 8)
  const entities: QuickItem[] = [
    ...catalog.competitors.map((c) => ({
      kind: 'Competitor' as const,
      id: c.id,
      title: c.name,
      subtitle: c.capabilities.map((cap) => cap.category).join(', '),
    })),
    ...catalog.publishers.map((p) => ({
      kind: 'Publisher' as const,
      id: p.id,
      title: p.name,
      subtitle: p.website,
    })),
  ]
  return [...entities, ...records]
    .filter((i) => `${i.title} ${i.subtitle}`.toLowerCase().includes(q))
    .sort(
      (a, b) => Number(!a.title.toLowerCase().startsWith(q)) - Number(!b.title.toLowerCase().startsWith(q)),
    )
    .slice(0, 8)
}

export function QuickOpen({
  catalog,
  recent,
  close,
  open,
}: {
  catalog: Catalog
  recent: string[]
  close: () => void
  open: (item: QuickItem) => void
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const items = useMemo(() => quickItems(catalog, query, recent), [catalog, query, recent])
  const active = Math.min(cursor, Math.max(0, items.length - 1))
  return (
    <Modal title="Quick Open" subtitle="Find a signal, competitor or publisher." close={close}>
      <div className="quick-search">
        <Search size={16} />
        <input
          autoFocus
          role="combobox"
          aria-label="Quick Open search"
          aria-expanded={true}
          aria-controls="quick-results"
          aria-autocomplete="list"
          aria-activedescendant={items.length ? `quick-${active}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCursor(0)
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'Enter' && items[active]) {
              e.preventDefault()
              open(items[active])
              return
            }
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
            const next = listFocusTarget(e.key, active, items.length)
            if (next !== null) {
              e.preventDefault()
              setCursor(next)
            }
          }}
        />
      </div>
      <div id="quick-results" className="quick-results" role="listbox" aria-label="Quick Open results">
        {items.map((item, index) => (
          <div
            id={`quick-${index}`}
            key={`${item.kind}-${item.id}`}
            className="quick-result"
            role="option"
            aria-selected={index === active}
            onMouseEnter={() => setCursor(index)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => open(item)}
          >
            <div>
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
            </div>
            <span>{item.kind}</span>
            <ArrowUpRight size={14} />
          </div>
        ))}
      </div>
      {!items.length && (
        <p className="library-empty" role="status">
          No matches.
        </p>
      )}
      <p className="quick-hint">↑ ↓ to move · Return to open · Esc to close</p>
    </Modal>
  )
}
