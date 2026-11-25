import { invoke, isTauri } from '@tauri-apps/api/core'
import type { Signal } from './data'

export const desktop = isTauri()
export function closeDesktopWindow() {
  return invoke('close_desktop_window')
}
export function setReaderTitle(title: string) {
  document.title = `${title} — Signal Desk`
  if (desktop)
    void invoke('set_reader_title', {
      title: [...title.replace(/[\x00-\x1f\x7f-\x9f]/g, ' ')].slice(0, 180).join(''),
    }).catch(() => undefined)
}
export async function copyText(text: string) {
  if (!desktop) return navigator.clipboard.writeText(text)
  const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
  await writeText(text)
}
export async function openWorkspace(view?: string) {
  if (desktop) return invoke('open_workspace', { view })
  location.href = view ? `/?view=${encodeURIComponent(view)}` : '/'
}
export type DetailKind = 'record' | 'highlight'
export async function openDetail(kind: DetailKind, id: string, highlightId?: string) {
  if (desktop) return invoke('open_detail', { kind, id, highlightId })
  const query = new URLSearchParams({ [kind]: id })
  if (highlightId) query.set('quote', highlightId)
  window.open(`/?${query}`, `_blank`, 'noopener')
}
export async function openExternal(url: string) {
  if (desktop) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else window.open(url, '_blank', 'noopener,noreferrer')
}
export async function openWebsite(address: string) {
  const url = new URL(address)
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Only HTTPS source URLs are supported.')
  if (desktop) return invoke('open_source_site', { address: url.href })
  window.open(url.href, '_blank', 'noopener,noreferrer')
}
export type Brief = { title: string; text: string }
export type BriefInput = { records: Signal[]; objective: string; audience: string; mode: string }
export type Provider = { endpoint: string; model: string; token: string }
export function runResearch(input: BriefInput, provider: Provider) {
  return invoke<Brief>('run_research', { request: { ...input, ...provider } })
}
