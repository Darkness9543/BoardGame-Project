// S02 main menu (PX 3): Play (creates a lobby with its invite link), join with a pasted link, armies,
// achievements, options; the sandbox and the renderer check are the developer entries.

import { useState } from 'react'
import { ENGINE_VERSION, RULES_VERSION } from '@coinduel/engine'
import { NAME_MAX, nameProblem, useProfile } from '../../store/profile'
import { useSessionStore } from '../../store/sessionStore'
import { hostGame, openInvite } from '../actions'
import { Icon } from '../components/Icon'

function ProfileName() {
  const profile = useProfile((s) => s.profile)
  const setName = useProfile((s) => s.setName)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile?.name ?? '')
  const problem = nameProblem(draft)
  if (!editing) {
    return (
      <button type="button" className="profile-chip" onClick={() => setEditing(true)} title="Change your display name">
        <Icon name="laurel-crown" size={18} /> {profile?.name ?? 'Player'} <span className="muted">✎</span>
      </button>
    )
  }
  return (
    <form
      className="profile-edit"
      onSubmit={(e) => {
        e.preventDefault()
        if (problem !== null) return
        setName(draft)
        setEditing(false)
      }}
    >
      <input autoFocus maxLength={NAME_MAX} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Display name" aria-invalid={problem !== null} />
      <button className="btn btn-small" type="submit" disabled={problem !== null}>
        Save
      </button>
      <button className="btn btn-small btn-ghost" type="button" onClick={() => setEditing(false)}>
        Cancel
      </button>
      {problem !== null && <span className="field-error">{problem}</span>}
    </form>
  )
}

export function MainMenu() {
  const [busy, setBusy] = useState(false)
  const [invite, setInvite] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const roomId = useSessionStore((s) => (s.mode === 'online' ? s.roomId : null))
  const phase = useSessionStore((s) => (s.mode === 'online' ? (s.controller?.snapshot.view.phase ?? null) : null))
  return (
    <main className="screen menu">
      <header className="menu-header">
        <ProfileName />
        <span className="muted small">
          Engine {ENGINE_VERSION} · rules v{RULES_VERSION}
        </span>
      </header>
      <section className="menu-hero">
        <Icon name="crown-coin" size={84} className="brand-mark" />
        <h1 className="display title-xl">Coin Duel</h1>
        <p className="muted tagline">Seven coins, two clans, one commander to protect. A duel in the fog.</p>
      </section>
      {roomId !== null && (
        <div className="banner banner-info">
          A game is in progress{phase === null ? '' : ` (${phase})`}.{' '}
          <a className="btn btn-small" href={phase === 'lobby' ? `#/lobby/${roomId}` : `#/play/${roomId}`}>
            Rejoin
          </a>
        </div>
      )}
      <nav className="menu-actions" aria-label="Main menu">
        <button
          type="button"
          className="btn btn-primary btn-hero"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void hostGame().finally(() => setBusy(false))
          }}
        >
          <Icon name="crossed-swords" size={26} /> {busy ? 'Creating the lobby…' : 'Play'}
          <span className="btn-sub">Create a lobby and invite a friend</span>
        </button>
        <form
          className="join-form"
          onSubmit={(e) => {
            e.preventDefault()
            setInviteError(openInvite(invite) ? null : 'Paste the whole invite link your friend sent you')
          }}
        >
          <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Paste an invite link to join" aria-label="Invite link" />
          <button className="btn" type="submit" disabled={invite.trim() === ''}>
            Join
          </button>
          {inviteError !== null && <span className="field-error">{inviteError}</span>}
        </form>
        <div className="menu-grid">
          <a className="menu-tile" href="#/armies">
            <Icon name="knight-banner" size={30} />
            <span className="menu-tile-title">Army compositions</span>
            <span className="muted small">Build, edit, import and share</span>
          </a>
          <a className="menu-tile" href="#/achievements">
            <Icon name="laurels-trophy" size={30} />
            <span className="menu-tile-title">Achievements</span>
            <span className="muted small">Progress and match history</span>
          </a>
          <a className="menu-tile" href="#/options">
            <Icon name="spanner" size={30} />
            <span className="menu-tile-title">Options</span>
            <span className="muted small">Confirmations, warnings, display</span>
          </a>
        </div>
      </nav>
      <footer className="menu-footer">
        <a href="#/dev/sandbox">Sandbox (play both sides)</a>
        <a href="#/dev/render">Board renderer check</a>
        <a href="assets/ATTRIBUTION.md" target="_blank" rel="noreferrer">
          Credits and licences
        </a>
      </footer>
    </main>
  )
}
