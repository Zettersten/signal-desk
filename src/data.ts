export const categories = [
  'RF Analytics',
  'Spectrum & GNSS',
  'Earth Observation',
  'Maritime Analytics',
  'Space Domain Awareness',
  'Space Infrastructure',
  'Market & Policy',
] as const
export type Category = (typeof categories)[number]
export type Paragraph = { id: string; text: string }
export type Signal = {
  id: string
  competitorId: string
  publisherId: string
  company: string
  publisher: string
  title: string
  summary: string
  paragraphs: Paragraph[]
  publishedAt: string
  category: Category
  importance: number
  time: string
  mark: string
  tone: string
  url?: string
  sample: boolean
}
export type Entity = {
  id: string
  name: string
  mark: string
  tone: string
  logo?: string
  logoKind?: 'sample' | 'official'
  website?: string
}
export type Capability = {
  name: string
  category: Category
  status: 'Core offering' | 'Adjacent offering' | 'Watch'
  description: string
}
export type Competitor = Entity & {
  overview: string
  foundedYear?: string
  incorporated?: { date: string; detail?: string; source?: string; sample?: boolean }
  image: { src: string; alt: string; caption: string }
  capabilities: Capability[]
  financials: { label: string; value?: string; period?: string; detail: string }[]
  activity: ProfileActivity[]
}
export type ProfileActivity = { date: string; title: string; details: string; recordId?: string }
export type Publisher = Entity & { website: string }
export type Catalog = {
  records: Signal[]
  competitors: Competitor[]
  publishers: Publisher[]
  mode: 'sample' | 'live'
}
export type Order = 'Latest first' | 'Highest importance' | 'Company A–Z'
export function sortSignals(records: Signal[], order: Order) {
  return [...records].sort((a, b) =>
    order === 'Highest importance'
      ? b.importance - a.importance
      : order === 'Company A–Z'
        ? a.company.localeCompare(b.company)
        : Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  )
}
