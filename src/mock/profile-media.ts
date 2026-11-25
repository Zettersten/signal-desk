import type { Entity } from '../data'

const palettes: Record<string, [string, string]> = {
  mint: ['#123336', '#7ad5ba'],
  plum: ['#30233b', '#d8a7e6'],
  blue: ['#182e51', '#91baff'],
  sky: ['#183242', '#83cbe8'],
  gold: ['#3e2e23', '#eeb775'],
}
const shapes = [
  'M11 33h8l4-14 6 18 5-10h19',
  'M11 39 32 14l21 25M19 45l13-15 13 15',
  'M12 38c9-23 31-23 40 0M17 43c8-12 22-12 30 0M27 47h10',
  'M13 18h38M20 31h24M13 44h38M32 12v38',
  'M12 41 24 19l13 22 14-22M13 47h38',
  'M12 23h10l7 16 8-22 8 15h7',
  'M12 45 31 16l20 29H12Zm8-8h22',
  'M12 34h40M18 26c8-16 20-16 28 0M18 42c8 15 20 15 28 0',
  'M14 45 23 19h18l9 26M19 34h26',
  'M13 38 30 14l20 24M19 45h25M30 23v19',
  'M13 26l19-13 19 13-19 23-19-23Zm0 0h38M32 13v36',
  'M15 43c2-8 8-21 17-26s16 9 17 26M18 40h28',
  'M14 19h36M14 31h27M14 43h18M44 38l7 5-7 5',
  'M14 42V18l36 24V18M24 42h16',
  'M13 43 32 16l19 27M20 36h24',
  'M14 20h36v24H14zM22 29h20M22 36h13',
  'M13 44h38M18 38l14-19 14 19M27 32h10',
  'M12 42 22 18l11 21 10-21 9 24',
  'M14 39c0-14 8-23 18-23s18 9 18 23M15 44h34M32 16v28',
]
const escape = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const svg = (viewBox: string, content: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>`)}`

export function sampleMark(entity: Entity, index: number) {
  const [paper, ink] = palettes[entity.tone] ?? palettes.blue
  return svg(
    '0 0 64 64',
    `<rect width="64" height="64" rx="12" fill="${paper}"/><path d="${shapes[index]}" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  )
}

const subjects = [
  ['Maritime RF observations', 'M0 150Q50 90 105 150T210 150T315 150T420 150T525 150T630 150'],
  ['Historical RF portfolio', 'M25 172H112V142H192V170H273V109H353V151H433V95H514V172H615'],
  ['Hosted payload services', 'M60 158 157 119 238 165 332 100 420 152 515 90 595 130'],
  ['Space systems integration', 'M50 153h112l65-50h176l65 50h102M227 103v57m176-57v57'],
  ['Radar imagery', 'M40 175 174 76l65 99L365 77l72 98 129-99'],
  ['Spectrum analytics', 'M15 151h60l30-27 20 27 38-52 40 52 38-28 30 28 40-62 35 62h260'],
  ['Optical imagery and change', 'M48 150 147 101 245 150 342 101 438 150 538 101 615 138'],
  ['Radar tasking and access', 'M48 170Q130 61 216 170T385 170T555 170'],
  ['Space-data interoperability', 'M45 148h108l58-49h196l58 49h110M155 148l58 32h193l60-32'],
  ['Launch and space systems', 'M32 178Q133 177 241 124T564 74'],
  ['Time-sensitive imagery', 'M42 156h132l38-45 42 45h84l46-62 47 62h140'],
  ['Emissions monitoring', 'M50 163Q150 152 205 132t98-22 96 24 77 27 100-8'],
]

export function sampleProfileImage(entity: Entity, index: number) {
  const [paper, ink] = palettes[entity.tone] ?? palettes.blue
  const [subject, path] = subjects[index]
  const x = 90 + index * 41
  return {
    src: svg(
      '0 0 640 230',
      `<rect width="640" height="230" fill="${paper}"/><g stroke="${ink}" opacity=".19" fill="none"><path d="M0 90h640M0 130h640M0 170h640M0 210h640M40 76v134m80-134v134m80-134v134m80-134v134m80-134v134m80-134v134m80-134v134m80-134v134"/><ellipse cx="${x}" cy="140" rx="68" ry="42"/><ellipse cx="${x}" cy="140" rx="96" ry="61"/></g><g fill="${ink}" font-family="system-ui,sans-serif"><text x="29" y="34" font-size="20" font-weight="600">${escape(entity.name)}</text><text x="29" y="56" font-size="12">${escape(subject)}</text></g><path d="${path}" fill="none" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><circle cx="${x}" cy="176" r="5" fill="${ink}"/>`,
    ),
    alt: `Sample diagram of ${subject.toLowerCase()} for ${entity.name}`,
    caption: `Sample illustration: ${subject}. Not a company photograph or measured data.`,
  }
}
