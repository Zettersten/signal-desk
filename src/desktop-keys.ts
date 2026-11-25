import type { KeyboardEvent } from 'react'

export function listFocusTarget(key: string, current: number, count: number): number | null {
  if (!count) return null
  switch (key) {
    case 'ArrowDown':
      return Math.min(current + 1, count - 1)
    case 'ArrowUp':
      return Math.max(current - 1, 0)
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

export function handleListNavigation(event: KeyboardEvent<HTMLElement>) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.matches('[data-list-row]')) return
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-list-row]')]
  const next = listFocusTarget(event.key, rows.indexOf(target), rows.length)
  if (next === null) return
  event.preventDefault()
  rows[next]?.focus()
}
