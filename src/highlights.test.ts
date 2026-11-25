import { describe, expect, it } from 'vitest'
import { excerptFromOffsets, paragraphSegments, type Highlight } from './highlights'

describe('record quotations', () => {
  const paragraph = { id: 'lead', text: '  RF and SAR analytics. RF again.  ' }
  const make = (start: number, end: number, id: string): Highlight => ({
    ...excerptFromOffsets(paragraph, start, end)!,
    id,
    recordId: 's1',
    recordTitle: 'Record',
    note: '',
    createdAt: '2026-11-24T00:00:00Z',
  })
  it('anchors the exact occurrence and does not include surrounding whitespace', () => {
    expect(excerptFromOffsets(paragraph, 0, 5)).toEqual({
      paragraphId: 'lead',
      start: 2,
      end: 4,
      quote: 'RF',
    })
    expect(
      excerptFromOffsets(paragraph, paragraph.text.lastIndexOf('RF'), paragraph.text.lastIndexOf('RF') + 2)
        ?.start,
    ).toBeGreaterThan(4)
    expect(excerptFromOffsets(paragraph, 1, 2)).toBeNull()
    expect(excerptFromOffsets(paragraph, -1, 2)).toBeNull()
  })
  it('renders overlapping quotes without duplicating text or painting changed text', () => {
    const a = make(2, 12, 'a'),
      b = make(9, 16, 'b')
    const parts = paragraphSegments(paragraph, [a, b, { ...a, id: 'stale', quote: 'Changed' }])
    expect(parts.map((p) => p.text).join('')).toBe(paragraph.text)
    expect(parts.find((p) => p.start === 9)?.highlights).toEqual(['a', 'b'])
    expect(parts.flatMap((p) => p.highlights)).not.toContain('stale')
  })
})
