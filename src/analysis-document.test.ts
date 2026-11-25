import { describe, expect, it } from 'vitest'
import { createAnalysisDocument, documentBlocks } from './analysis-document'
import { buildArtifact } from './export'
import { fixtures } from './mock/fixtures'

describe('HawkEye analysis document', () => {
  it('embeds the brand and selection chart in a portable Markdown file', async () => {
    const doc = createAnalysisDocument({ title: 'RF outlook', text: '## Findings\n- Compare offers.' }, [
      fixtures[0],
    ])
    const blocks = documentBlocks(doc.markdown)
    expect(blocks.filter((block) => block.kind === 'image').map((block) => block.text)).toEqual([
      'HawkEye 360 mark',
      'Selected signals by domain',
    ])
    expect(blocks).toContainEqual({ kind: 'heading', depth: 2, text: 'Findings' })
    expect(doc.markdown).toContain('Contains sample evidence')
    const artifact = await buildArtifact(doc, 'Markdown')
    expect(artifact.name).toBe('rf-outlook.md')
    expect(await artifact.blob.text()).toBe(doc.markdown)
  })

  it('drops provider-supplied HTML and remote images from generated Markdown', () => {
    const doc = createAnalysisDocument(
      {
        title: 'Report',
        text: '<script>bad()</script>\n\n![Remote](https://example.com/track.png)\n\n[Example](https://example.com)',
      },
      [fixtures[0]],
    )
    expect(doc.markdown).not.toContain('<script>')
    expect(doc.markdown).not.toContain('https://example.com')
    expect(documentBlocks(doc.markdown).filter((block) => block.kind === 'image')).toHaveLength(2)
  })
})
