import { marked } from 'marked'
import brand from '../assets/hawkeye-icon.png?inline'
import type { Signal } from './data'
import type { Brief } from './native'

export type AnalysisDocument = Brief & { markdown: string; design: 'hawkeye-analysis-v1' }
export const analysisBrand = { name: 'HawkEye 360', logo: brand, orange: '#F05A28', navy: '#005A87' } as const
const xml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const literal = (value: string) => value.replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}\[\]()<>#!|~]/g, '\\$&')

function evidenceGraphic(records: Signal[]) {
  const categories = new Map<string, number>()
  for (const record of records) categories.set(record.category, (categories.get(record.category) ?? 0) + 1)
  const rows = [...categories].sort(([a], [b]) => a.localeCompare(b))
  const height = 72 + rows.length * 39
  const bars = rows
    .map(([category, count], i) => {
      const y = 70 + i * 39
      const width = Math.max(8, (count / records.length) * 355)
      return `<text x="24" y="${y + 5}" font-size="15" fill="#153047">${xml(category)}</text><rect x="250" y="${y - 9}" width="355" height="13" rx="3" fill="#dfeaf0"/><rect x="250" y="${y - 9}" width="${width}" height="13" rx="3" fill="${analysisBrand.navy}"/><text x="628" y="${y + 5}" font-size="15" text-anchor="end" fill="#153047">${count}</text>`
    })
    .join('')
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="652" height="${height}" viewBox="0 0 652 ${height}"><rect width="652" height="${height}" rx="9" fill="#f2f7fa"/><rect x="24" y="22" width="4" height="19" fill="${analysisBrand.orange}"/><g font-family="Arial,sans-serif"><text x="38" y="38" font-size="20" font-weight="bold" fill="#153047">Selected signals by domain</text>${bars}</g></svg>`)}`
}

export function createAnalysisDocument(draft: Brief, records: Signal[]): AnalysisDocument {
  const content = documentBlocks(draft.text).filter((block) => block.kind !== 'image')
  const body = content
    .map((block) => {
      const text = literal(block.text)
      if (block.kind === 'heading') return `${'#'.repeat(Math.max(2, block.depth ?? 2))} ${text}`
      if (block.kind === 'item') return `- ${text}`
      if (block.kind === 'quote') return `> ${text}`
      return text
    })
    .join('\n\n')
  const evidence = records
    .map(
      (r) =>
        `- **${literal(r.title)}** — ${literal(r.company)} / ${literal(r.publisher)} / ${literal(r.category)}`,
    )
    .join('\n')
  const markdown =
    [
      `![HawkEye 360 mark](${brand})`,
      `**HawkEye 360 / Signal Desk**`,
      `# ${literal(draft.title)}`,
      ...(records.some((r) => r.sample) ? ['> Contains sample evidence. Not verified reporting.'] : []),
      `![Selected signals by domain](${evidenceGraphic(records)})`,
      body,
      '## Selected signal records',
      evidence,
    ]
      .filter(Boolean)
      .join('\n\n') + '\n'
  return {
    title: draft.title,
    text: `${content.map((block) => block.text).join('\n\n')}\n\nSelected signal records\n${records.map((r) => `- ${r.title} — ${r.publisher}`).join('\n')}`,
    markdown,
    design: 'hawkeye-analysis-v1',
  }
}

export function isAnalysisDocument(brief: Brief): brief is AnalysisDocument {
  return (
    'design' in brief &&
    brief.design === 'hawkeye-analysis-v1' &&
    'markdown' in brief &&
    typeof brief.markdown === 'string'
  )
}

export type DocumentBlock = {
  kind: 'heading' | 'paragraph' | 'quote' | 'item' | 'image'
  text: string
  depth?: number
  src?: string
}
export function documentBlocks(markdown: string): DocumentBlock[] {
  // No HTML execution, remote image fetches or model-supplied links in a document preview.
  function renderTokens(tokens: ReturnType<typeof marked.lexer>[number][]): DocumentBlock[] {
    return tokens.flatMap((token): DocumentBlock[] => {
      if (token.type === 'heading')
        return [{ kind: 'heading', depth: token.depth, text: inlineText(token.tokens ?? []) }]
      if (token.type === 'blockquote')
        return renderTokens(token.tokens ?? [])
          .filter((block) => block.kind !== 'image')
          .map((block) => ({ ...block, kind: 'quote' }))
      if (token.type === 'list')
        return token.items.map((item: { text: string }) => ({
          kind: 'item',
          text: inlineText(marked.Lexer.lexInline(item.text)),
        }))
      if (token.type !== 'paragraph' && token.type !== 'text' && token.type !== 'code') return []
      const children = 'tokens' in token ? (token.tokens ?? []) : []
      const image = children.length === 1 && children[0].type === 'image' ? children[0] : undefined
      if (
        image &&
        (image.href === brand ||
          (/^data:image\/svg\+xml,%3Csvg/i.test(image.href) && image.text === 'Selected signals by domain'))
      ) {
        return [{ kind: 'image', text: image.text, src: image.href }]
      }
      const text = children.length ? inlineText(children) : token.text
      return text?.trim() ? [{ kind: 'paragraph', text }] : []
    })
  }
  return renderTokens(marked.lexer(markdown))
}

function inlineText(tokens: ReturnType<typeof marked.Lexer.lexInline>): string {
  return tokens
    .map((token) =>
      token.type === 'html'
        ? ''
        : token.type === 'br'
          ? '\n'
          : 'tokens' in token && token.tokens
            ? inlineText(token.tokens)
            : 'text' in token
              ? (token.text ?? '')
              : '',
    )
    .join('')
}
