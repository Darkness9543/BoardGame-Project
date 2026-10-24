// The action bar (UX S-5.4, PX BT-06, R26, R27), the AP widget (S-11) and End Turn (S-12): every button shows its
// effective cost and key, and says why it is disabled in words the player can see.

import { useEffect, useState } from 'react'
import type { PlayerView } from '@coinduel/engine'
import { activeAction, commandUnitId, type CommandState, type Gate } from '../../store/command'
import { useCommandStore } from '../../store/commandStore'
import type { MatchController, MatchSnapshot } from '../../store/matchController'
import { unitLabel } from '../../store/naming'
import { ownUnit, readyUnits } from '../../store/rules'
import { useSettings } from '../../store/settings'
import { toast } from '../../store/toasts'
import { useUiState } from '../../store/uiState'
import { Coin } from '../components/Coin'
import { Kbd } from '../components/common'
import { Icon } from '../components/Icon'
import { actionButtons, costParts, hoveredButton, sameAction } from './actionButtons'

/** The AP of the action being aimed or confirmed, so the pool shows what it would leave (S-11). */
function pendingCost(view: PlayerView, state: CommandState): number | null {
  const action = activeAction(state)
  if (action === null || state.t === 'idle' || state.t === 'inspect') return null
  const unit = ownUnit(view, state.unitId)
  return unit === undefined ? null : (actionButtons(view, unit).find((b) => sameAction(b.action, action))?.cost ?? null)
}

export function ApWidget({ snap }: { readonly snap: MatchSnapshot }) {
  const view = snap.view
  const state = useCommandStore((s) => s.state)
  const hoveredAction = useUiState((s) => s.hoveredAction)
  const hovered = hoveredButton(view, commandUnitId(state), hoveredAction)
  const preview = (hovered?.enabled === true ? hovered.cost : null) ?? pendingCost(view, state)
  const me = view.seat
  const total = Math.max(snap.turnStartAp[me], view.myAp, 1)
  const shown = Math.min(total, 30)
  const after = preview === null ? null : view.myAp - preview
  return (
    <div className="ap-widget" title={`AP left this turn. Unspent AP is lost at the end of the turn.${view.myApDebt > 0 ? ` ${view.myApDebt} AP is owed from a Cauldron return and comes off your next pool.` : ''}`}>
      <div className={`ap-pips${shown > 20 ? ' ap-pips-dense' : ''}`} aria-hidden="true">
        {[...Array(shown).keys()].map((i) => {
          const filled = i < view.myAp
          const spent = after !== null && filled && i >= Math.max(0, after)
          return <span key={i} className={`ap-pip${filled ? ' ap-pip-on' : ''}${spent ? ' ap-pip-preview' : ''}`} />
        })}
      </div>
      <span className="ap-number">
        <Icon name="lightning-helix" size={16} /> {view.myAp}
        <span className="muted"> / {total}</span>
        {after !== null && <span className={after < 0 ? 'bad' : 'ap-after'}> → {after < 0 ? `short by ${-after}` : `${after} left`}</span>}
        {view.myApDebt > 0 && <span className="debt"> −{view.myApDebt} owed</span>}
      </span>
    </div>
  )
}

const END_ARM_MS = 4000

export function EndTurnButton({ controller, snap, gate }: { readonly controller: MatchController; readonly snap: MatchSnapshot; readonly gate: Gate }) {
  const view = snap.view
  const mode = useSettings((s) => s.settings.endTurnConfirm)
  const [armedAt, setArmedAt] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const ready = readyUnits(view).length
  useEffect(() => {
    if (armedAt === null) return
    const timer = setTimeout(() => setArmedAt(null), END_ARM_MS)
    return () => clearTimeout(timer)
  }, [armedAt])
  useEffect(() => setArmedAt(null), [view.turn?.number])
  const myTurn = view.turn?.activeSeat === view.seat && view.phase === 'battle'
  if (!myTurn) {
    const other = view.seat === 'host' ? 'guest' : 'host'
    return (
      <button type="button" className="btn btn-end" disabled>
        {view.phase === 'ended' ? 'Game over' : `${snap.names[other]}'s turn`}
      </button>
    )
  }
  const needsConfirm = mode === 'always' || (mode === 'whenCanAct' && ready > 0)
  const end = () => {
    setSending(true)
    setArmedAt(null)
    void controller.session.dispatch({ kind: 'endTurn' }).then((r) => {
      setSending(false)
      if (!r.ok) toast(r.message, 'warn')
    })
  }
  const click = () => {
    if (!gate.open) {
      toast(gate.reason ?? 'You cannot end the turn now', 'warn')
      return
    }
    if (!needsConfirm) return end()
    if (armedAt === null) return setArmedAt(Date.now())
    if (Date.now() - armedAt < 250) return
    end()
  }
  const label = sending
    ? 'Ending…'
    : armedAt !== null
      ? view.myAp > 0
        ? `Confirm: ${view.myAp} AP will be lost`
        : 'Confirm end turn'
      : ready > 0
        ? `End turn · ${view.myAp} AP left`
        : 'End turn'
  return (
    <button type="button" data-end-turn className={`btn btn-end ${armedAt !== null ? 'btn-armed' : ready === 0 ? 'btn-primary btn-glow' : ''}`} onClick={click} disabled={sending} title="Ctrl+Enter">
      {label} <Kbd>Ctrl ⏎</Kbd>
    </button>
  )
}

export function TakebackButton({ controller, snap }: { readonly controller: MatchController; readonly snap: MatchSnapshot }) {
  const view = snap.view
  const [composing, setComposing] = useState(false)
  if (!view.settings.takebacks) return null
  const tb = view.takeback
  const left = tb.remaining === null ? '∞' : String(tb.remaining)
  const reason = tb.request !== null ? 'A take-back request is open' : tb.remaining === 0 ? 'No take-backs left' : 'Nothing you can take back now'
  return (
    <span className="takeback-wrap">
      <button
        type="button"
        data-takeback
        className="btn btn-small"
        aria-disabled={!tb.canRequest}
        title={tb.canRequest ? 'Ask your opponent to undo your last action (Ctrl+Z)' : reason}
        onClick={() => (tb.canRequest ? setComposing(true) : toast(reason, 'info'))}
      >
        <Icon name="anticlockwise-rotation" size={14} /> Take back
      </button>
      {composing && (
        <span className="popover takeback-compose" role="dialog" aria-label="Request a take-back">
          <span className="small">Ask {snap.names[view.seat === 'host' ? 'guest' : 'host']} to undo your last action? They see what it revealed and decide. Take-backs left: {left}.</span>
          <span className="row">
            <button
              type="button"
              className="btn btn-small btn-primary"
              onClick={() => {
                setComposing(false)
                void controller.session.takeback.request().then((r) => {
                  if (!r.ok) toast(r.message, 'warn')
                })
              }}
            >
              Send request
            </button>
            <button type="button" className="btn btn-small" onClick={() => setComposing(false)}>
              Cancel
            </button>
          </span>
        </span>
      )}
    </span>
  )
}

export function ActionBar({ snap, state, gate }: { readonly snap: MatchSnapshot; readonly state: CommandState; readonly gate: Gate }) {
  const send = useCommandStore((s) => s.send)
  const setHoveredAction = useUiState((s) => s.setHoveredAction)
  const clarity = useSettings((s) => s.settings.clarityMode)
  const view = snap.view
  const unitId = state.t === 'idle' || state.t === 'inspect' ? null : state.unitId
  const unit = ownUnit(view, unitId)
  const ready = readyUnits(view)
  const current = activeAction(state)
  if (unit === undefined) {
    return (
      <div className="action-bar action-bar-empty">
        <span className="muted">{gate.open ? 'Select one of your units.' : (gate.reason ?? '')}</span>
        {gate.open && (
          <button type="button" className="btn" onClick={() => send({ t: 'cycleUnit', delta: 1 })} disabled={ready.length === 0}>
            Next ready unit <Kbd>Tab</Kbd> <span className="tag">{ready.length}</span>
          </button>
        )}
      </div>
    )
  }
  const buttons = actionButtons(view, unit)
  return (
    <div className="action-bar">
      <div className="action-unit">
        <Coin look={{ type: unit.type, tier: unit.tier, mine: true, commander: view.commanders[view.seat], clarity, power: unit.power, toughness: unit.toughness, maxToughness: unit.maxToughness }} size={40} />
        <span className="action-unit-name">{unitLabel(snap.registry, view, unit.id)}</span>
      </div>
      <div className="actions" role="toolbar" aria-label="Actions">
        {buttons.map((b) => (
          <button
            key={b.action.kind === 'ability' ? b.action.abilityId : b.action.kind}
            type="button"
            data-action-button
            className={`action-btn${sameAction(current, b.action) ? ' action-on' : ''}${b.followUp ? ' action-next' : ''}${b.enabled ? '' : ' action-off'}`}
            aria-disabled={!b.enabled}
            title={b.enabled ? `${b.label} · ${b.cost} AP (${b.key})` : (b.reason ?? 'Not available')}
            onClick={(e) => {
              e.currentTarget.blur() // Enter and Space then confirm the preview instead of clicking this again
              send({ t: 'action', action: b.action })
            }}
            onPointerEnter={() => setHoveredAction({ unitId: unit.id, action: b.action })}
            onPointerLeave={() => setHoveredAction(null)}
            onFocus={() => setHoveredAction({ unitId: unit.id, action: b.action })}
            onBlur={() => setHoveredAction(null)}
          >
            <Icon name={b.icon} size={18} />
            <span className="action-label">{b.label}</span>
            <span className="action-cost">
              {costParts(b).base} AP{b.surcharge > 0 && <span className="surcharge"> +{b.surcharge}</span>}
            </span>
            <Kbd>{b.key}</Kbd>
            {!b.enabled && b.reason !== null && <span className="sr-only">: {b.reason}</span>}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-small" onClick={() => send({ t: 'cycleUnit', delta: 1 })} title="Next unit that can still act (Tab)">
        Next <Kbd>Tab</Kbd> <span className="tag">{ready.length}</span>
      </button>
    </div>
  )
}
