import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { installDesktopZoom } from './desktop-zoom'
import { closeDesktopWindow, desktop } from './native'
import { App } from './App'
import { httpIntelligenceSource, IntelligenceContext } from './catalog'
import { MockHttpClient } from './mock/fixtures'
import { apiTransport } from './api-transport'
import { localProfileHistory, trackedIntelligenceSource } from './profile-history'
import { HighlightWindow, RecordWindow } from './library/Readers'
import '@fontsource-variable/inter'
import './styles.css'
import './library/library.css'

const params = new URLSearchParams(location.search)
const record = params.get('record') || params.get('signal')
const highlight = params.get('highlight')
if (desktop) {
  if (!params.has('tray')) installDesktopZoom(Boolean(record || highlight))
  document.documentElement.dataset.desktop = 'true'
  document.documentElement.dataset.platform = navigator.platform.includes('Mac') ? 'mac' : 'other'
  const windowHandle = getCurrentWindow()
  let themeEvent = false
  void windowHandle
    .onThemeChanged(({ payload }) => {
      themeEvent = true
      document.documentElement.dataset.theme = payload
    })
    .then((stop) => addEventListener('pagehide', stop, { once: true }))
    .catch(() => undefined)
  void windowHandle
    .theme()
    .then((theme) => {
      if (!themeEvent && theme) document.documentElement.dataset.theme = theme
    })
    .catch(() => undefined)
  if (record || highlight)
    addEventListener('keydown', (e) => {
      if (!e.defaultPrevented && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        void closeDesktopWindow().catch(() => undefined)
      }
    })
}
document.documentElement.dataset.surface =
  record || highlight ? 'reader' : params.has('tray') ? 'tray' : 'workspace'
// The browser preview can load a second deterministic sample revision to demonstrate refresh history.
const revision = import.meta.env.DEV && params.get('sampleRevision') === '2' ? 2 : 1
const apiUrl = import.meta.env.VITE_SIGNAL_DESK_API_URL as string | undefined
const transport = httpIntelligenceSource(apiUrl ? apiTransport(apiUrl) : new MockHttpClient(revision))
const source =
  record || highlight || params.has('tray') || apiUrl
    ? transport
    : trackedIntelligenceSource(
        transport,
        localProfileHistory({
          getItem: (key) => localStorage.getItem(key),
          setItem: (key, value) => localStorage.setItem(key, value),
        }),
        () => window.dispatchEvent(new Event('profile-history-unavailable')),
      )
createRoot(document.getElementById('root')!).render(
  <IntelligenceContext.Provider value={source}>
    {record ? (
      <RecordWindow id={record} quoteId={params.get('quote') ?? undefined} />
    ) : highlight ? (
      <HighlightWindow id={highlight} />
    ) : (
      <App />
    )}
  </IntelligenceContext.Provider>,
)
