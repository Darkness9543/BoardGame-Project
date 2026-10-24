// S01: choose a display name (PX G-05). No account; the name and a random id stay in this browser.

import { useState } from 'react'
import { NAME_MAX, nameProblem, suggestName, useProfile } from '../../store/profile'
import { Icon } from '../components/Icon'

export function FirstRun({ invited }: { readonly invited: boolean }) {
  const setName = useProfile((s) => s.setName)
  const [name, setDraft] = useState(() => suggestName())
  const problem = nameProblem(name)
  return (
    <main className="screen screen-center first-run">
      <div className="card first-run-card">
        <Icon name="crown-coin" size={64} className="brand-mark" />
        <h1 className="display">{invited ? "You've been invited to a duel" : 'Coin Duel'}</h1>
        <p className="muted">Choose the name your opponent will see. Your armies and achievements are kept in this browser.</p>
        <form
          className="first-run-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (problem === null) setName(name)
          }}
        >
          <label className="field">
            <span className="field-label">Display name</span>
            <span className="field-row">
              <input autoFocus maxLength={NAME_MAX} value={name} onChange={(e) => setDraft(e.target.value)} aria-invalid={problem !== null} />
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(suggestName())} title="Suggest another name">
                ↻ Re-roll
              </button>
            </span>
            {problem !== null && <span className="field-error">{problem}</span>}
          </label>
          <button type="submit" className="btn btn-primary btn-large" disabled={problem !== null}>
            {invited ? 'Continue to the lobby' : 'Continue'}
          </button>
        </form>
      </div>
    </main>
  )
}
