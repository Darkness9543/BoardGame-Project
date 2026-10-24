// #/lobby/<room> and #/play/<room>: one match through its phases. A refresh resumes the room (NET-04).

import { useEffect, useState } from 'react'
import { profileName } from '../../store/profile'
import { sessionProvider } from '../../store/sessionProvider'
import { useSessionStore } from '../../store/sessionStore'
import { Battle } from '../battle/Battle'
import { useMatch } from '../hooks/useMatch'
import { navigate, useRoute } from '../router'
import { Deployment } from './Deployment'
import { Lobby } from './Lobby'

/** The phase switch, shared by online matches and the sandbox. */
export function MatchBody() {
  const match = useMatch()
  if (match === null) return null
  const session = match.controller.session
  const problem = session.problem?.message ?? null
  if (!session.synced) {
    return (
      <main className="screen screen-center">
        <div className="card join-card">
          <p className="pulse">Connecting to your friend's game…</p>
          {problem !== null && <p className="field-error">{problem}</p>}
          <a className="btn" href="#/">
            Main menu
          </a>
        </div>
      </main>
    )
  }
  switch (match.snap.view.phase) {
    case 'lobby':
      return <Lobby />
    case 'deployment':
      return <Deployment />
    case 'battle':
    case 'ended':
      return <Battle />
  }
}

export function MatchScreen({ roomId }: { readonly roomId: string }) {
  const route = useRoute()
  const attachedRoom = useSessionStore((s) => s.roomId)
  const mode = useSessionStore((s) => s.mode)
  const match = useMatch()
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (attachedRoom === roomId && mode === 'online') return
    let live = true
    void sessionProvider()
      .resume(roomId, profileName())
      .then((session) => {
        if (!live) return
        if (session === null) setMissing(true)
        else useSessionStore.getState().attachOnline(roomId, session)
      })
      .catch(() => {
        if (live) setMissing(true)
      })
    return () => {
      live = false
    }
  }, [roomId, attachedRoom, mode])

  const phase = match?.snap.view.phase ?? null
  useEffect(() => {
    if (phase === null || attachedRoom !== roomId) return
    if (phase === 'lobby' && route.name === 'play') navigate({ name: 'lobby', roomId }, { replace: true })
    if (phase !== 'lobby' && route.name === 'lobby') navigate({ name: 'play', roomId }, { replace: true })
  }, [phase, route.name, roomId, attachedRoom])

  if (missing && attachedRoom !== roomId) {
    return (
      <main className="screen screen-center">
        <div className="card">
          <h1 className="display">This game isn't open here</h1>
          <p className="muted">It was hosted or joined in another browser, or it has been closed. Ask your friend for a fresh invite link.</p>
          <a className="btn btn-primary" href="#/">
            Main menu
          </a>
        </div>
      </main>
    )
  }
  if (match === null || attachedRoom !== roomId) {
    return (
      <main className="screen screen-center">
        <p className="pulse">Opening the game…</p>
      </main>
    )
  }
  return <MatchBody />
}
