import { invoke } from '@tauri-apps/api/core'
import { desktop, type Brief } from './native'
import type { Signal } from './data'
export type Format = 'PDF' | 'Word' | 'PowerPoint'
export function signalBrief(records: Signal[]): Brief {
  return {
    title: records.length === 1 ? records[0].title : 'Competitive signals',
    text: `Sample intelligence — not verified reporting.\n\n${records.map((r) => `${r.company} | ${r.publisher} | ${r.category} | ${r.importance}% importance\n${r.title}\n${r.summary}${r.url ? `\n${r.url}` : ''}`).join('\n\n')}`,
  }
}
async function saveFile(name: string, blob: Blob) {
  if (desktop) {
    return invoke<boolean>('save_artifact', {
      name,
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
    })
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}
export async function buildArtifact(brief: Brief, format: Format) {
  const name =
    brief.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'signal-desk'
  if (format === 'PDF') {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'pt', format: 'letter' })
    const printable = (s: string) =>
      s
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—]/g, '-')
        .replace(/[^\x20-\x7e\n\xA0-\xFF]/g, '?')
    let y = 64
    const line = (text: string, size: number, bold = false) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal')
      pdf.setFontSize(size)
      for (const part of pdf.splitTextToSize(printable(text), 500) as string[]) {
        if (y >= 728) {
          pdf.addPage()
          y = 64
        }
        pdf.text(part, 56, y)
        y += size * 1.45
      }
    }
    line('Signal Desk / HawkEye 360', 10, true)
    y += 16
    line(brief.title, 23, true)
    y += 12
    for (const paragraph of brief.text.split('\n')) line(paragraph, 11)
    for (let p = 1; p <= pdf.getNumberOfPages(); p++) {
      pdf.setPage(p)
      pdf.setFontSize(9)
      pdf.text(`Signal Desk  /  ${p}`, 56, 755)
    }
    return { name: `${name}.pdf`, blob: pdf.output('blob') }
  }
  if (format === 'Word') {
    const { Document, Packer, Paragraph, HeadingLevel } = await import('docx')
    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: 'Signal Desk / HawkEye 360' }),
            new Paragraph({ text: brief.title, heading: HeadingLevel.TITLE }),
            ...brief.text.split('\n').map((text) => new Paragraph({ text, spacing: { after: 100 } })),
          ],
        },
      ],
    })
    return { name: `${name}.docx`, blob: await Packer.toBlob(document) }
  }
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  const chunks = brief.text
    .split('\n\n')
    .flatMap((s) => s.match(/[\s\S]{1,750}(?:\s|$)|[\s\S]{1,750}/g) ?? [])
  for (const [index, chunk] of chunks.entries()) {
    const slide = pptx.addSlide()
    slide.background = { color: '181F2C' }
    slide.addText('Signal Desk / HawkEye 360', {
      x: 0.7,
      y: 0.45,
      w: 12,
      h: 0.3,
      color: 'A9CAFF',
      fontSize: 12,
    })
    slide.addText(brief.title, {
      x: 0.7,
      y: 0.9,
      w: 12,
      h: 1,
      color: 'FFFFFF',
      fontSize: 24,
      bold: true,
      fit: 'shrink',
    })
    slide.addText(chunk.trim(), {
      x: 0.7,
      y: 2.1,
      w: 11.8,
      h: 4.4,
      fontSize: 18,
      color: 'D6DEE8',
      valign: 'top',
      fit: 'shrink',
    })
    slide.addText(`${index + 1} / ${chunks.length}`, {
      x: 0.7,
      y: 6.85,
      w: 12,
      h: 0.3,
      color: 'A9CAFF',
      fontSize: 11,
    })
  }
  return { name: `${name}.pptx`, blob: (await pptx.write({ outputType: 'blob' })) as Blob }
}
export async function exportBrief(brief: Brief, format: Format) {
  const { name, blob } = await buildArtifact(brief, format)
  return saveFile(name, blob)
}
