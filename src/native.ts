import { invoke, isTauri } from '@tauri-apps/api/core'
import type { Signal } from './data'

export const desktop = isTauri()
export async function copyText(text: string) {
  if (!desktop) return navigator.clipboard.writeText(text)
  const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
  await writeText(text)
}
export async function openWorkspace(id?: string) {
  if (desktop) return invoke('open_workspace', { id })
  location.href = id ? `/?signal=${encodeURIComponent(id)}` : '/'
}
export async function openExternal(url: string) {
  if (desktop) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else window.open(url, '_blank', 'noopener,noreferrer')
}
export type Brief = { title: string; text: string }
export type BriefInput = { records: Signal[]; objective: string; audience: string; mode: string }
export type Provider = { endpoint: string; model: string; token: string }
export function runResearch(input: BriefInput, provider: Provider) {
  return invoke<Brief>('run_research', { request: { ...input, ...provider } })
}
