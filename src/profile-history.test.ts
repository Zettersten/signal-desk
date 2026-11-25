import { describe, expect, it } from 'vitest'
import { httpIntelligenceSource } from './catalog'
import { MockHttpClient } from './mock/fixtures'
import { localProfileHistory, observeProfiles, trackedIntelligenceSource } from './profile-history'

const initial = httpIntelligenceSource(new MockHttpClient(1))
const revised = httpIntelligenceSource(new MockHttpClient(2))
const day1 = '2026-11-24T08:00:00.000Z'
const day2 = '2026-11-25T08:00:00.000Z'

function storage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}

describe('mock profile completeness', () => {
  it('ships distinct visuals and a complete set of labeled profile fields', async () => {
    const catalog = await initial.loadCatalog()
    expect(catalog.competitors).toHaveLength(12)
    expect(catalog.publishers).toHaveLength(7)
    const entities = [...catalog.competitors, ...catalog.publishers]
    expect(new Set(entities.map((e) => e.logo)).size).toBe(entities.length)
    for (const entity of entities) {
      expect(entity.logo).toBeTruthy()
      expect(entity.website).toMatch(/^https:\/\//)
      expect(entity.logoKind).toBe(entity.logo?.startsWith('data:image/svg+xml,') ? 'sample' : 'official')
    }
    expect(new Set(catalog.competitors.map((c) => c.image.src)).size).toBe(catalog.competitors.length)
    for (const profile of catalog.competitors) {
      expect(profile.overview).toBeTruthy()
      expect(profile.image.alt).toContain(profile.name)
      expect(profile.image.caption).toContain('Sample illustration')
      expect(profile.incorporated?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      if (profile.incorporated?.source) expect(profile.incorporated.sample).not.toBe(true)
      else expect(profile.incorporated?.sample).toBe(true)
      expect(profile.capabilities.length).toBeGreaterThan(0)
      expect(profile.financials.map((f) => f.label)).toEqual([
        'Market value',
        'Earnings',
        'Revenue',
        'Funding',
      ])
      expect(
        profile.financials.every((f) => f.value && f.period && f.detail.startsWith('Illustrative')),
      ).toBe(true)
      expect(catalog.records.some((r) => r.competitorId === profile.id)).toBe(true)
    }
  })
})

describe('persisted profile history', () => {
  it('records a capability position change and an edited profile without changing the evidence list', async () => {
    const store = localProfileHistory(storage())
    const base = await initial.loadCatalog()
    observeProfiles(base, store, day1)
    const next = structuredClone(base)
    next.competitors[0].capabilities[0].status = 'Watch'
    next.competitors[0].overview += ' Profile reviewed.'
    const result = observeProfiles(next, store, day2)
    expect(result.records).toEqual(base.records)
    expect(result.competitors[0].activity.slice(0, 2)).toEqual([
      {
        date: day2,
        title: 'Capabilities changed',
        details: 'Space-based RF geolocation: RF Analytics / Core offering → RF Analytics / Watch.',
      },
      { date: day2, title: 'Profile details changed', details: 'Overview updated.' },
    ])
  })

  it('records a refresh change, reloads it from storage, and does not duplicate it', async () => {
    const adapter = storage()
    let source = initial
    let date = day1
    const refresh = trackedIntelligenceSource(
      { loadCatalog: (signal) => source.loadCatalog(signal), createBrief: initial.createBrief },
      localProfileHistory(adapter),
      () => {
        throw Error('Storage failed')
      },
      () => new Date(date),
    )
    const events = (catalog: Awaited<ReturnType<typeof refresh.loadCatalog>>) =>
      catalog.competitors
        .find((c) => c.id === 'unseenlabs')!
        .activity.filter((event) => event.title === 'Financials changed')
    expect(events(await refresh.loadCatalog())).toEqual([])
    source = revised
    date = day2
    expect(events(await refresh.loadCatalog())).toEqual([
      {
        date: day2,
        title: 'Financials changed',
        details: 'Market value: USD 330M / Example snapshot → USD 365M / Example snapshot.',
      },
    ])
    const reopened = trackedIntelligenceSource(revised, localProfileHistory(adapter), () => {
      throw Error('Storage failed')
    })
    expect(events(await reopened.loadCatalog())).toHaveLength(1)
  })

  it('ignores ordering and upstream activity changes and isolates live and sample histories', async () => {
    const store = localProfileHistory(storage())
    const base = await initial.loadCatalog()
    observeProfiles(base, store, day1)
    const reordered = structuredClone(base)
    reordered.competitors[0].capabilities.reverse()
    reordered.competitors[0].activity = []
    expect(observeProfiles(reordered, store, day2).competitors[0].activity).toHaveLength(0)
    const next = await revised.loadCatalog()
    expect(
      observeProfiles({ ...next, mode: 'live' }, store, day2).competitors[0].activity.some(
        (a) => a.title === 'Financials changed',
      ),
    ).toBe(false)
    expect(
      observeProfiles(next, store, day2).competitors[0].activity.some(
        (a) => a.title === 'Financials changed',
      ),
    ).toBe(true)
  })
})
