import { createRoot } from 'react-dom/client'
import { App } from './App'
import { netProvider } from './net'
import { useSettings } from './store/settings'
import { setSessionProvider } from './store/sessionProvider'
import { appStore } from './store/storage'
import { applyTheme } from './ui/theme'
import './styles/base.css'
import './styles/components.css'
import './styles/screens.css'
import './styles/battle.css'
import './styles/board.css'

// Online play: peer-to-peer over Trystero (loaded lazily on the first hosted or joined game).
setSessionProvider(netProvider({ storage: appStore(), build: __BUILD_ID__ }))
applyTheme(document.documentElement, { clarity: useSettings.getState().settings.clarityMode })

const root = document.getElementById('root')
if (root === null) throw new Error('Missing #root')

// No <StrictMode>: its development-only effect replay detaches and re-attaches every drei <Html> overlay (stat
// plates, forecast chips) right after they mount and recreates their inner React root, which blanks each box for a
// few frames on every hover. Production builds never replay effects, so this only changes the dev server's feel.
createRoot(root).render(<App />)
