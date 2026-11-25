import { describe, it, expect } from 'vitest'
import { categories, sortSignals } from './data'
import { fixtures, mock } from './mock/fixtures'
import { httpIntelligenceSource } from './catalog'
import { signalBrief } from './export'

describe('sample competitor index', () => {
  it('serves at least ten records with unique IDs and bounded importance', async () => {
    const { records, mode, competitors, publishers } = await httpIntelligenceSource(mock).loadCatalog()
    expect(mode).toBe('sample')
    expect(records.length).toBeGreaterThanOrEqual(10)
    expect(new Set(records.map((record: { id: string }) => record.id)).size).toBe(records.length)
    expect(fixtures.every((record) => record.importance >= 0 && record.importance <= 100)).toBe(true)
    for (const record of records) {
      expect(competitors.find((profile) => profile.id === record.competitorId)?.name).toBe(record.company)
      expect(publishers.find((profile) => profile.id === record.publisherId)?.name).toBe(record.publisher)
      expect(categories).toContain(record.category)
      expect(record.paragraphs.length).toBeGreaterThan(1)
    }
  })
  it('sorts without mutating the source', () => {
    expect(sortSignals(fixtures, 'Highest importance')[0].importance).toBe(96)
    expect(sortSignals(fixtures, 'Company A–Z')[0].company).toBe('Airbus')
    expect(fixtures[0].id).toBe('s1')
  })
  it('grounds briefs in the selected evidence and labels them as samples', async () => {
    const response = await mock.fetch('/v1/briefs', {
      method: 'POST',
      body: JSON.stringify({
        records: fixtures.slice(1, 3),
        objective: 'Compare go-to-market approaches',
        audience: 'Strategy leadership',
      }),
    })
    const doc = await response.json()
    expect(doc.text).toContain('Sample analysis')
    expect(doc.text).toContain(fixtures[2].title)
    expect(doc.text).not.toContain(fixtures[0].title)
    expect(signalBrief(fixtures.slice(0, 1)).text).toContain('96% importance')
  })
  it('rejects unknown routes and invalid briefs', async () => {
    expect((await mock.fetch('/v1/nope')).status).toBe(404)
    expect((await mock.fetch('/v1/briefs', { method: 'POST', body: '{}' })).status).toBe(400)
  })
})
