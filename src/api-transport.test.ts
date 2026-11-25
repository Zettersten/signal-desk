import { describe, expect, it, vi } from 'vitest'
import { apiTransport } from './api-transport'
import { httpIntelligenceSource } from './catalog'
import { mock } from './mock/fixtures'

describe('Signal Desk API transport', () => {
  it('uses the configured origin, reuses ETags, and handles 304', async () => {
    const catalog = await (await mock.fetch('/v1/catalog')).json()
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(catalog, { headers: { ETag: '"v1"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
    const source = httpIntelligenceSource(apiTransport('http://localhost:5188', fetcher))
    const first = await source.loadCatalog()
    const second = await source.loadCatalog()
    expect(first).toEqual(second)
    expect(String(fetcher.mock.calls[0][0])).toBe('http://localhost:5188/v1/catalog')
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('If-None-Match')).toBe('"v1"')
  })

  it('surfaces provider errors rather than returning sample data', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { title: 'Live AI is disabled.' }, { status: 503 },
    ))
    const source = httpIntelligenceSource(apiTransport('http://localhost:5188', fetcher))
    await expect(source.createBrief({ records: [], objective: 'Test', audience: 'Executive team', mode: 'Explain' }))
      .rejects.toThrow('Live AI is disabled.')
  })

  it('rejects insecure hosted origins and credential-bearing URLs', () => {
    expect(() => apiTransport('http://example.com')).toThrow()
    expect(() => apiTransport('https://user:password@example.com')).toThrow()
  })

  it('resolves API media URLs and rejects missing linked profiles', async () => {
    const catalog = await (await mock.fetch('/v1/catalog')).json()
    catalog.competitors[0].image.src = '/media/profile-placeholder.svg'
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(catalog))
    const source = httpIntelligenceSource(apiTransport('http://localhost:5188', fetcher))
    expect((await source.loadCatalog()).competitors[0].image.src).toBe('http://localhost:5188/media/profile-placeholder.svg')
    fetcher.mockResolvedValueOnce(Response.json({ ...catalog, publishers: [] }))
    await expect(source.loadCatalog()).rejects.toThrow('incompatible catalog')
  })
})
