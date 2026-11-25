import type { IntelligenceSource } from './catalog'
import type { Catalog, Competitor, ProfileActivity } from './data'

type Snapshot = Pick<
  Competitor,
  | 'name'
  | 'overview'
  | 'website'
  | 'foundedYear'
  | 'incorporated'
  | 'capabilities'
  | 'financials'
  | 'logo'
  | 'logoKind'
  | 'image'
>
type Entry = { snapshot: Snapshot; changes: ProfileActivity[] }
type History = Record<string, Entry>
export interface ProfileHistoryStore {
  read(mode: Catalog['mode']): History
  write(mode: Catalog['mode'], value: History): void
}

export function localProfileHistory(storage: Pick<Storage, 'getItem' | 'setItem'>): ProfileHistoryStore {
  const key = (mode: Catalog['mode']) => `signal.profile-history.v1.${mode}`
  return {
    read(mode) {
      const stored = storage.getItem(key(mode))
      if (!stored) return {}
      try {
        const parsed = JSON.parse(stored) as History | null
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        return Object.fromEntries(
          Object.entries(parsed).filter(
            ([, entry]) =>
              entry?.snapshot &&
              Array.isArray(entry.snapshot.financials) &&
              Array.isArray(entry.snapshot.capabilities) &&
              Array.isArray(entry.changes),
          ),
        )
      } catch {
        return {}
      }
    },
    write(mode, history) {
      storage.setItem(key(mode), JSON.stringify(history))
    },
  }
}

function snapshot({
  name,
  overview,
  website,
  foundedYear,
  incorporated,
  capabilities,
  financials,
  logo,
  logoKind,
  image,
}: Competitor): Snapshot {
  return {
    name,
    overview,
    website,
    foundedYear,
    incorporated,
    capabilities,
    financials,
    logo,
    logoKind,
    image,
  }
}

// Array ordering and object property ordering are not profile changes.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map(canonical).sort())
  if (value && typeof value === 'object')
    return JSON.stringify(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    )
  return JSON.stringify(value) ?? ''
}

function listChanges<T>(before: T[], after: T[], name: (item: T) => string, value: (item: T) => string) {
  const old = new Map(before.map((item) => [name(item), item]))
  const next = new Map(after.map((item) => [name(item), item]))
  const details: string[] = []
  for (const [label, item] of next) {
    const previous = old.get(label)
    if (!previous) details.push(`${label} added (${value(item)}).`)
    else if (canonical(previous) !== canonical(item)) {
      const from = value(previous),
        to = value(item)
      details.push(from === to ? `${label} details revised.` : `${label}: ${from} → ${to}.`)
    }
  }
  for (const label of old.keys()) if (!next.has(label)) details.push(`${label} removed.`)
  if (details.length > 6) return `${details.slice(0, 6).join(' ')} ${details.length - 6} more changes.`
  return details.join(' ')
}

function describeChanges(before: Snapshot, after: Snapshot) {
  const events: Omit<ProfileActivity, 'date'>[] = []
  const add = (title: string, details: string) => {
    if (details) events.push({ title, details })
  }
  add(
    'Capabilities changed',
    listChanges(
      before.capabilities,
      after.capabilities,
      (item) => item.name,
      (item) => `${item.category} / ${item.status}`,
    ),
  )
  add(
    'Financials changed',
    listChanges(
      before.financials,
      after.financials,
      (item) => item.label,
      (item) => [item.value ?? 'Not available', item.period].filter(Boolean).join(' / '),
    ),
  )
  const fields = [
    ['name', 'Name'],
    ['overview', 'Overview'],
    ['website', 'Website'],
    ['foundedYear', 'Founding year'],
    ['incorporated', 'Incorporation'],
    ['logo', 'Logo'],
    ['logoKind', 'Logo attribution'],
    ['image', 'Profile image'],
  ] as const
  const changed = fields
    .filter(([key]) => canonical(before[key]) !== canonical(after[key]))
    .map(([, label]) => label)
  if (changed.length) add('Profile details changed', `${changed.join(', ')} updated.`)
  return events
}

export function observeProfiles(catalog: Catalog, store: ProfileHistoryStore, date: string): Catalog {
  const saved = store.read(catalog.mode)
  const history: History = { ...saved }
  let dirty = false
  const competitors = catalog.competitors.map((profile) => {
    const previous = Object.hasOwn(history, profile.id) ? history[profile.id] : undefined
    const next = structuredClone(snapshot(profile))
    const changes = previous
      ? describeChanges(previous.snapshot, next).map((event) => ({ ...event, date }))
      : []
    if (!previous || changes.length) {
      dirty = true
      Object.defineProperty(history, profile.id, {
        value: { snapshot: next, changes: [...changes, ...(previous?.changes ?? [])].slice(0, 100) },
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
    return { ...profile, activity: [...(history[profile.id]?.changes ?? []), ...profile.activity] }
  })
  if (dirty) store.write(catalog.mode, history)
  return { ...catalog, competitors }
}

export function trackedIntelligenceSource(
  source: IntelligenceSource,
  store: ProfileHistoryStore,
  onStorageError: () => void,
  now = () => new Date(),
): IntelligenceSource {
  return {
    ...source,
    async loadCatalog(signal) {
      const catalog = await source.loadCatalog(signal)
      if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
      try {
        return observeProfiles(catalog, store, now().toISOString())
      } catch {
        onStorageError()
        return catalog
      }
    },
  }
}
