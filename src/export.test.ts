import { describe, expect, it } from 'vitest'
import { buildArtifact, type Format } from './export'

describe('offline export', () => {
  const cases = [
    ['PDF', '.pdf', '%PDF'],
    ['Word', '.docx', 'PK'],
    ['PowerPoint', '.pptx', 'PK'],
  ] as const satisfies readonly [Format, string, string][]

  it.each(cases)('builds a %s file', async (format, extension, magic) => {
    const file = await buildArtifact(
      { title: 'Competitive brief', text: 'Evidence\n\nAn example for evaluation.' },
      format,
    )
    expect(file.name).toBe(`competitive-brief${extension}`)
    expect(file.blob.size).toBeGreaterThan(200)
    const header = new Uint8Array(await file.blob.slice(0, magic.length).arrayBuffer())
    expect(String.fromCharCode(...header)).toBe(magic)
  })
})
