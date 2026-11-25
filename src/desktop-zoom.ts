import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export function nextZoom(current: number, direction: string) {
  if (direction === 'reset') return 100
  if (direction !== 'in' && direction !== 'out') return current
  return Math.max(80, Math.min(150, current + (direction === 'in' ? 10 : -10)))
}

export function installDesktopZoom(reader: boolean) {
  const key = reader ? 'signal.zoom.reader' : 'signal.zoom.workspace'
  let zoom = 100
  try {
    const stored = Number(localStorage.getItem(key))
    if (Number.isInteger(stored) && stored >= 80 && stored <= 150) zoom = stored
  } catch {
    /* No stored preference. */
  }
  const apply = () => void invoke('set_desktop_zoom', { percent: zoom }).catch(() => undefined)
  apply()
  void listen<string>('desktop-zoom', ({ payload }) => {
    zoom = nextZoom(zoom, payload)
    apply()
    try {
      localStorage.setItem(key, String(zoom))
    } catch {
      /* Keep the live zoom. */
    }
  })
    .then((stop) => addEventListener('pagehide', stop, { once: true }))
    .catch(() => undefined)
}
