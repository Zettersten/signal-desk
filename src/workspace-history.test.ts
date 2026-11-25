import { describe, expect, it } from 'vitest'
import { navigateHistory, workspaceHistory } from './workspace-history'
import { nextZoom } from './desktop-zoom'
import { quickItems } from './QuickOpen'
import { httpIntelligenceSource } from './catalog'
import { MockHttpClient } from './mock/fixtures'

describe('desktop workspace', () => {
  it('moves back and forward and drops the forward branch on a new visit', () => {
    const start = workspaceHistory('All signals')
    const opened = navigateHistory(navigateHistory(start, { visit: 'Competitors' }), {
      visit: 'competitor:unseenlabs',
    })
    const back = navigateHistory(opened, 'back')
    expect(back.current).toBe('Competitors')
    expect(navigateHistory(back, 'forward')).toEqual(opened)
    expect(navigateHistory(back, { visit: 'Highlights' }).forward).toEqual([])
    expect(navigateHistory(start, 'back')).toBe(start)
  })
  it('bounds text zoom and restores actual size', () => {
    expect(nextZoom(150, 'in')).toBe(150)
    expect(nextZoom(80, 'out')).toBe(80)
    expect(nextZoom(110, 'reset')).toBe(100)
    expect(nextZoom(100, 'in')).toBe(110)
  })
  it('suggests recent records and finds records, companies and publishers', async () => {
    const catalog = await httpIntelligenceSource(new MockHttpClient()).loadCatalog()
    expect(quickItems(catalog, '', ['missing', 's2', 's2'])[0].id).toBe('s2')
    expect(quickItems(catalog, 'Unseenlabs', [])[0].kind).toBe('Competitor')
    expect(quickItems(catalog, 'SpaceNews', [])[0].kind).toBe('Publisher')
    expect(quickItems(catalog, 'licensing options', [])[0].kind).toBe('Record')
  })
})
