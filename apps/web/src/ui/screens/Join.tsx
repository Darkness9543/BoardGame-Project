// #/join/<room>/<secret>: an invite link opens the lobby directly as guest (PX MM-01).

import { useEffect, useState } from 'react'
import { parseInviteText, roomCode } from '../../net'
import { profileName } from '../../store/profile'
import { sessionProvider } from '../../store/sessionProvider'
import { useSessionStore } from '../../store/sessionStore'
import { navigate } from '../router'

export function Join({ roomId, secret }: { readonly roomId: string; readonly secret: string }) {
  const invite = parseInviteText(`${roomId}/${secret}`)
  const [error, setError] = useState<string | null>(invite === null ? 'This invite link is not valid: ask your friend to send it again' : null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (invite === null) return
    let live = true
    setError(null)
    sessionProvider()
      .join({ roomId: invite.roomId, secret: invite.secret, name: profileName() })
      .then((session) => {
        if (!live) return
        useSessionStore.getState().attachOnline(invite.roomId, session)
        navigate(session.phase === 'lobby' ? { name: 'lobby', roomId: invite.roomId } : { name: 'play', roomId: invite.roomId }, { replace: true })
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : 'Could not join the game')
      })
    return () => {
      live = false
    }
  }, [invite?.roomId, invite?.secret, attempt])
  return (
    <main className="screen screen-center">
      <div className="card join-card">
        <h1 className="display">Joining a duel</h1>
        <p className="muted">
          Room <code>{roomCode(invite?.roomId ?? roomId)}</code>
        </p>
        {error === null ? (
          <p className="pulse">Connecting to your friend's game…</p>
        ) : (
          <>
            <p className="field-error">{error}</p>
            <div className="row">
              {invite !== null && (
                <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </button>
              )}
              <a className="btn" href="#/">
                Main menu
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
