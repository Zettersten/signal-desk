export type Category = 'RF Analytics' | 'Earth Observation' | 'Market & Policy' | 'Space Infrastructure'
export type Signal = {
  id: string
  company: string
  publisher: string
  title: string
  summary: string
  category: Category
  importance: number
  time: string
  mark: string
  tone: string
  url?: string
}
export const categories: Category[] = [
  'RF Analytics',
  'Earth Observation',
  'Market & Policy',
  'Space Infrastructure',
]
export const fixtures: Signal[] = [
  {
    id: 's1',
    company: 'Unseenlabs',
    publisher: 'SpaceNews',
    title: 'Unseenlabs expands next-generation RF constellation',
    summary:
      'A planned multi-satellite deployment points to improved revisit rates and a broader commercial maritime monitoring offering.',
    category: 'RF Analytics',
    importance: 96,
    time: '08:42',
    mark: 'U',
    tone: 'mint',
  },
  {
    id: 's2',
    company: 'Kleos Space',
    publisher: 'Via Satellite',
    title: 'Kleos Space assets draw renewed acquisition interest',
    summary:
      'Emerging buyer interest in the RF geolocation portfolio could reshape the competitive landscape for regional providers.',
    category: 'RF Analytics',
    importance: 89,
    time: '08:15',
    mark: 'K',
    tone: 'plum',
  },
  {
    id: 's3',
    company: 'Spire Global',
    publisher: 'Space Intel Report',
    title: 'Spire Global advances its maritime data partnerships',
    summary:
      'A new distribution model brings satellite-derived maritime data closer to enterprise analytics workflows.',
    category: 'Earth Observation',
    importance: 84,
    time: '07:58',
    mark: 'S',
    tone: 'blue',
  },
  {
    id: 's4',
    company: 'UK Space Agency',
    publisher: 'UK Space Agency',
    title: 'UK opens consultation on commercial space data procurement',
    summary:
      'The consultation explores how public agencies can evaluate and procure commercial Earth observation and analytics services.',
    category: 'Market & Policy',
    importance: 81,
    time: '07:34',
    mark: 'UK',
    tone: 'gold',
  },
  {
    id: 's5',
    company: 'ICEYE',
    publisher: 'Satellite Today',
    title: 'ICEYE broadens access to on-demand SAR monitoring',
    summary:
      'An updated commercial offering emphasizes faster tasking and easier integration for enterprise customers.',
    category: 'Earth Observation',
    importance: 77,
    time: '07:12',
    mark: 'I',
    tone: 'sky',
  },
  {
    id: 's6',
    company: 'Aurora Insight',
    publisher: 'Geo Week News',
    title: 'Spectrum analytics providers test new commercial delivery models',
    summary:
      'Subscription-based pricing and standardized outputs feature in a new round of customer discovery.',
    category: 'RF Analytics',
    importance: 76,
    time: '06:48',
    mark: 'A',
    tone: 'plum',
  },
  {
    id: 's7',
    company: 'Planet Labs',
    publisher: 'SpaceNews',
    title: 'Planet explores sector-specific monitoring bundles',
    summary:
      'New product packaging pairs recurring imagery with analytics for infrastructure and sustainability teams.',
    category: 'Earth Observation',
    importance: 71,
    time: '06:31',
    mark: 'P',
    tone: 'mint',
  },
  {
    id: 's8',
    company: 'Umbra',
    publisher: 'Via Satellite',
    title: 'Umbra evaluates new imagery distribution partnerships',
    summary:
      'Partner-led distribution could make space-derived analytics available to a wider set of customers.',
    category: 'Earth Observation',
    importance: 69,
    time: '06:19',
    mark: 'U',
    tone: 'sky',
  },
  {
    id: 's9',
    company: 'ESA',
    publisher: 'ESA',
    title: 'European industry group proposes interoperable space data standards',
    summary: 'The proposal outlines common metadata and licensing conventions for commercial data providers.',
    category: 'Market & Policy',
    importance: 63,
    time: '06:02',
    mark: 'E',
    tone: 'gold',
  },
  {
    id: 's10',
    company: 'Rocket Lab',
    publisher: 'SpaceNews',
    title: 'Smallsat launch availability remains a procurement consideration',
    summary:
      'Satellite operators continue to weigh dedicated and shared launch options against constellation replenishment timelines.',
    category: 'Space Infrastructure',
    importance: 61,
    time: '05:55',
    mark: 'R',
    tone: 'plum',
  },
  {
    id: 's11',
    company: 'BlackSky',
    publisher: 'Geo Week News',
    title: 'BlackSky explores lower-friction analytics onboarding',
    summary: 'Product teams are evaluating new methods for customer trials and enterprise integration.',
    category: 'Earth Observation',
    importance: 59,
    time: '05:30',
    mark: 'B',
    tone: 'blue',
  },
  {
    id: 's12',
    company: 'GHGSat',
    publisher: 'Satellite Today',
    title: 'GHGSat highlights demand for independent emissions data',
    summary:
      'Industry buyers continue to evaluate satellite-derived measurements alongside existing reporting workflows.',
    category: 'Earth Observation',
    importance: 55,
    time: '05:25',
    mark: 'G',
    tone: 'mint',
  },
]

export class MockHttpClient {
  async fetch(path: string, init?: RequestInit): Promise<Response> {
    await new Promise((resolve) => setTimeout(resolve, 180))
    if (init?.signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
    if (path === '/v1/signals') return Response.json({ records: fixtures, mode: 'sample' })
    if (path === '/v1/briefs' && init?.method === 'POST') {
      const {
        records,
        objective,
        audience,
        mode = 'Strategic brief',
      } = JSON.parse(String(init.body)) as {
        records: Signal[]
        objective: string
        audience: string
        mode?: string
      }
      if (!records?.length || !objective?.trim())
        return Response.json({ error: 'Select evidence and enter an objective.' }, { status: 400 })
      const domains = [...new Set(records.map((record) => record.category))].join(', ')
      const evidence = records
        .map((record, i) => `[${i + 1}] ${record.title} — ${record.publisher} (sample). ${record.summary}`)
        .join('\n\n')
      const lead =
        mode === 'Explain'
          ? 'How to read these signals'
          : mode === 'Summarize'
            ? 'Summary'
            : 'Strategic implications'
      return Response.json({
        title:
          mode === 'Strategic brief'
            ? 'Competitive landscape brief'
            : mode === 'Explain'
              ? 'Signal explainer'
              : 'Evidence summary',
        text: `Sample analysis — illustrative, not live research.\n\nObjective\n${objective}\n\nAudience\n${audience}\n\n${lead}\nThe ${records.length} selected signals cover ${domains}. Compare how each affects customer evaluation criteria, commercial positioning and route to market for HawkEye 360. The supplied records do not establish causality or validate any claims.\n\nEvidence\n${evidence}\n\nNext steps\nVerify announcements at the primary source. Separate stated intent from delivered capability and identify which assumptions need validation before a business decision.`,
      })
    }
    return Response.json({ error: 'Unknown sample endpoint' }, { status: 404 })
  }
}
export const mock = new MockHttpClient()
export type Order = 'Latest first' | 'Highest importance' | 'Company A–Z'
export function sortSignals(records: Signal[], order: Order) {
  return [...records].sort((a, b) =>
    order === 'Highest importance'
      ? b.importance - a.importance
      : order === 'Company A–Z'
        ? a.company.localeCompare(b.company)
        : b.time.localeCompare(a.time),
  )
}
