// S08 result (PX 8): the outcome and why, the fog lifted, both armies (R33), what each unit type did (R39),
// the achievements this match unlocked (AC-03), and what next: rematch, copy the log, keep the opponent's army.

import { useState } from 'react'
import { ROSTER_IDS, SEATS, unitDef, type ArmyList, type Seat, type UnitTypeId, type UnitTypeTally } from '@coinduel/engine'
import type { NetSession } from '../../net'
import { ACHIEVEMENTS } from '../../store/achievements'
import { newSavedArmy, useArmies } from '../../store/armies'
import { logAsText, resultText } from '../../store/logText'
import type { MatchController, MatchSnapshot } from '../../store/matchController'
import { useSessionStore } from '../../store/sessionStore'
import { toast } from '../../store/toasts'
import { leaveMatch, rematch } from '../actions'
import { ArmyListing } from '../components/ArmiesPanel'
import { CopyButton } from '../components/common'
import { Icon } from '../components/Icon'

const TYPES: readonly UnitTypeId[] = [...ROSTER_IDS, 'commander', 'noAcb']

function TallyTable({ tallies }: { readonly tallies: Readonly<Partial<Record<UnitTypeId, UnitTypeTally>>> }) {
  const rows = TYPES.filter((t) => tallies[t] !== undefined)
  if (rows.length === 0) return <p className="muted small">No damage was dealt.</p>
  return (
    <table className="tally-table">
      <thead>
        <tr>
          <th>Unit</th>
          <th className="num">Dealt</th>
          <th className="num">Taken</th>
          <th className="num">Kills</th>
          <th className="num">Lost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => {
          const v = tallies[t] as UnitTypeTally
          return (
            <tr key={t}>
              <td>{unitDef(t).name}</td>
              <td className="num">{v.damageDealt}</td>
              <td className="num">{v.damageTaken}</td>
              <td className="num">{v.kills}</td>
              <td className="num">{v.losses}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function Result({ controller, snap, onClose }: { readonly controller: MatchController; readonly snap: MatchSnapshot; readonly onClose: () => void }) {
  const view = snap.view
  const save = useArmies((s) => s.save)
  const mode = useSessionStore((s) => s.mode)
  const [busy, setBusy] = useState(false)
  const result = view.result
  if (result === null) return null
  const me = view.seat
  const other: Seat = me === 'host' ? 'guest' : 'host'
  const text = resultText(result, me)
  const summary = snap.summary
  const armies: Readonly<Record<Seat, ArmyList | null>> = summary?.armies ?? view.armies ?? { host: null, guest: null }
  const theirs = armies[other]
  const tone = result.winner === null ? 'draw' : result.winner === me ? 'win' : 'loss'
  return (
    <div className="result-backdrop">
      <section className={`result result-${tone}`} role="dialog" aria-label="Result">
        <header className="result-head">
          <Icon name={tone === 'win' ? 'laurels-trophy' : tone === 'draw' ? 'scales' : 'tattered-banner'} size={56} />
          <div>
            <h1 className="display title-xl">{text.headline}</h1>
            <p className="result-reason">
              {text.reason} · round {Math.ceil(result.turnNumber / 2)}
            </p>
          </div>
        </header>
        {snap.unlocked.length > 0 && (
          <div className="result-achievements">
            <h2 className="section-title">Achievements unlocked</h2>
            <ul className="achievement-chips">
              {snap.unlocked.map((id) => {
                const a = ACHIEVEMENTS.find((x) => x.id === id)
                return a === undefined ? null : (
                  <li key={id} className="achievement-chip" title={a.description}>
                    <Icon name="laurels-trophy" size={16} /> {a.name}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        <div className="result-armies">
          {SEATS.map((seat) => {
            const army = armies[seat]
            return (
              <div key={seat} className="result-side">
                {army !== null && <ArmyListing army={army} title={seat === me ? 'Your army' : `${snap.names[seat]}'s army`} mine={seat === me} />}
                {summary !== null && <TallyTable tallies={summary.unitTypes[seat]} />}
              </div>
            )
          })}
        </div>
        <div className="row result-actions">
          {mode !== null && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || controller.session.mode === 'guest'}
              title={controller.session.mode === 'guest' ? 'The host starts a rematch' : 'A new match with the same players and settings'}
              onClick={() => {
                setBusy(true)
                void rematch().then(() => setBusy(false))
              }}
            >
              Rematch
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            View the board
          </button>
          <CopyButton text={logAsText(snap.log)} label="Copy the log" />
          {theirs !== null && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                save(newSavedArmy(theirs, `${snap.names[other]}'s army`, view.settings.budget, Date.now()))
                toast("Saved the opponent's army to your armies", 'good')
              }}
            >
              Save their army
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={leaveMatch}>
            Main menu
          </button>
        </div>
        {controller.session.mode !== 'local' && <FairnessCheck session={controller.session} />}
        <p className="muted small">The fog has lifted: the board shows everything that was hidden.{controller.options.sandbox ? ' Sandbox games never count for achievements.' : ''}</p>
      </section>
    </div>
  )
}

/** R37 / S28: after an online match either player can replay it and check every commitment and hash it was shown. */
function FairnessCheck({ session }: { readonly session: NetSession }) {
  const fairness = session.fairness
  const [verdict, setVerdict] = useState(fairness.verdict)
  return (
    <div className="result-fairness">
      <h2 className="section-title">Fairness check</h2>
      {fairness.notes.map((note) => (
        <p key={note} className="small warn">
          ⚠ {note}
        </p>
      ))}
      {verdict === null ? (
        <button type="button" className="btn btn-small" disabled={!fairness.auditReady} onClick={() => setVerdict(fairness.verify())}>
          {fairness.auditReady ? 'Replay the match and check it' : "Waiting for the host's record of the match…"}
        </button>
      ) : verdict.ok ? (
        <p className="ok small">
          ✓ The match replays exactly: {verdict.checks} checks over {verdict.entries} logged moves.
        </p>
      ) : (
        <ul className="problems">
          {verdict.problems.map((p) => (
            <li key={p} className="problem problem-error">
              ⛔ {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
