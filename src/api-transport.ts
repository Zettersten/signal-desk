import { categories, type Catalog } from './data'
import type { HttpTransport } from './catalog'

export function apiTransport(
  baseUrl: string,
  request: typeof fetch = globalThis.fetch.bind(globalThis),
  accessToken: () => string | undefined = () => undefined,
): HttpTransport {
  const base = new URL(baseUrl)
  if (
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash ||
    (base.protocol !== 'https:' &&
      !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))
  ) throw new Error('Use an HTTPS API origin, or loopback HTTP for local development.')
  let cached: { catalog: Catalog; etag: string; token: string | undefined } | undefined
  return {
    async fetch(path, init = {}) {
      if (!['/v1/catalog', '/v1/briefs'].includes(path)) throw new Error('Unknown intelligence API path.')
      const token = accessToken()
      if (cached?.token !== token) cached = undefined
      const headers = new Headers(init.headers)
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (path === '/v1/catalog' && cached) headers.set('If-None-Match', cached.etag)
      const response = await request(new URL(path, base), {
        ...init,
        headers,
        credentials: 'omit',
        redirect: 'error',
        signal: init.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(65_000)])
          : AbortSignal.timeout(65_000),
      })
      if (response.status === 304 && cached) return Response.json(cached.catalog)
      if (!response.ok || path !== '/v1/catalog') return response
      const catalog = (await response.json()) as Catalog
      validateCatalog(catalog)
      for (const company of catalog.competitors) {
        if (company.image.src.startsWith('/')) company.image.src = new URL(company.image.src, base).href
        if (company.logo?.startsWith('/')) company.logo = new URL(company.logo, base).href
      }
      for (const publisher of catalog.publishers)
        if (publisher.logo?.startsWith('/')) publisher.logo = new URL(publisher.logo, base).href
      const etag = response.headers.get('ETag')
      cached = etag ? { catalog, etag, token } : undefined
      return Response.json(catalog)
    },
  }
}

function validateCatalog(catalog: Catalog) {
  if (
    !catalog ||
    !['sample', 'live'].includes(catalog.mode) ||
    !Array.isArray(catalog.records) ||
    !Array.isArray(catalog.competitors) ||
    !Array.isArray(catalog.publishers) ||
    catalog.competitors.some(c => !c.image?.src || !Array.isArray(c.financials) || !Array.isArray(c.capabilities) || !Array.isArray(c.activity)) ||
    catalog.records.some(r =>
      !r.id ||
      !categories.includes(r.category) ||
      !Array.isArray(r.paragraphs) ||
      !Number.isFinite(r.importance) ||
      r.importance < 0 || r.importance > 100 ||
      !catalog.competitors.some(c => c.id === r.competitorId) ||
      !catalog.publishers.some(p => p.id === r.publisherId),
    )
  ) throw new Error('The intelligence API returned an incompatible catalog.')
}
