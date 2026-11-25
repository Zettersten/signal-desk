import { createContext, useContext } from 'react'
import type { Catalog } from './data'
import type { Brief, BriefInput } from './native'

export interface IntelligenceSource {
  loadCatalog(signal?: AbortSignal): Promise<Catalog>
  createBrief(input: BriefInput): Promise<Brief>
}
export interface HttpTransport {
  fetch(path: string, init?: RequestInit): Promise<Response>
}
export function httpIntelligenceSource(transport: HttpTransport): IntelligenceSource {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await transport.fetch(path, init)
    if (!res.ok) {
      const problem = await res.json().catch(() => null) as { title?: string; detail?: string } | null
      throw new Error(problem?.detail || problem?.title || `Request failed (${res.status})`)
    }
    return res.json() as Promise<T>
  }
  return {
    loadCatalog: (signal) => request('/v1/catalog', { signal }),
    createBrief: (input) =>
      request('/v1/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
  }
}
export const IntelligenceContext = createContext<IntelligenceSource | null>(null)
export function useIntelligence() {
  const source = useContext(IntelligenceContext)
  if (!source) throw new Error('No intelligence source configured')
  return source
}
