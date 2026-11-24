import { createRoot } from 'react-dom/client'
import { App } from './App'
import '@fontsource-variable/inter'
import './styles.css'

document.documentElement.dataset.surface = new URLSearchParams(location.search).has('tray')
  ? 'tray'
  : 'workspace'
createRoot(document.getElementById('root')!).render(<App />)
