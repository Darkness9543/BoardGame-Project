import { lazy, Suspense, useEffect } from 'react'
import { useProfile } from './store/profile'
import { prefersReducedMotion, useSettings } from './store/settings'
import { Toasts } from './ui/components/common'
import { useRoute, type Route } from './ui/router'
import { Achievements } from './ui/screens/Achievements'
import { ArmyBuilderScreen } from './ui/screens/ArmyBuilder'
import { ArmyList } from './ui/screens/ArmyList'
import { FirstRun } from './ui/screens/FirstRun'
import { Join } from './ui/screens/Join'
import { MainMenu } from './ui/screens/MainMenu'
import { MatchScreen } from './ui/screens/MatchScreen'
import { NotFound } from './ui/screens/NotFound'
import { Options } from './ui/screens/Options'
import { Sandbox } from './ui/screens/Sandbox'
import { applyTheme } from './ui/theme'

/** The 3D board's dev page (#/dev/render), its own chunk. */
const RenderDemo = lazy(() => import('./render/RenderDemo'))

function Screen({ route }: { readonly route: Route }) {
  switch (route.name) {
    case 'menu':
      return <MainMenu />
    case 'armies':
      return <ArmyList />
    case 'army':
      return <ArmyBuilderScreen id={route.id} />
    case 'achievements':
      return <Achievements />
    case 'options':
      return <Options />
    case 'lobby':
    case 'play':
      return <MatchScreen roomId={route.roomId} />
    case 'join':
      return <Join roomId={route.roomId} secret={route.secret} />
    case 'sandbox':
      return <Sandbox />
    case 'render':
      return (
        <Suspense fallback={<p className="pulse">Loading the board check…</p>}>
          <RenderDemo />
        </Suspense>
      )
    case 'notFound':
      return <NotFound path={route.path} />
  }
}

export function App() {
  const route = useRoute()
  const profile = useProfile((s) => s.profile)
  const clarity = useSettings((s) => s.settings.clarityMode)
  const motion = useSettings((s) => s.settings.motion)
  useEffect(() => applyTheme(document.documentElement, { clarity }), [clarity])
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', prefersReducedMotion(motion))
  }, [motion])
  const needsProfile = profile === null && route.name !== 'render'
  return (
    <div className="app">
      {needsProfile ? <FirstRun invited={route.name === 'join'} /> : <Screen route={route} />}
      <Toasts />
    </div>
  )
}
