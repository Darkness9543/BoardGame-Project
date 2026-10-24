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
import { actionButtons, costParts, hoveredButton, sameAction, type ActionButton } from './actionButtons'

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
  const basic = buttons.filter((b) => b.group === 'basic')
  const abilities = buttons.filter((b) => b.group === 'ability')
  const own = unit.own
  const actionsLeft = own === null ? 0 : Math.max(0, own.actionAllowance - own.turn.actionsUsed)
  // The command dock (docs/ui-direction/action-bar.html, option A): a tile per action with its icon, name, cost and
  // key; a disabled tile stays in place and says why; the armed action is framed; the side panel's ActionCard shows
  // the full text of whatever is hovered or armed, so nothing here needs a tooltip.
  const tile = (b: ActionButton) => {
    const note = !b.enabled && b.reason !== null ? b.reason : b.status !== null && b.status !== 'Ready' ? b.status : null
    return (
      <button
        key={b.action.kind === 'ability' ? b.action.abilityId : b.action.kind}
        type="button"
        data-action-button
        className={`dock-tile${sameAction(current, b.action) ? ' dock-on' : ''}${b.followUp ? ' dock-next' : ''}${b.enabled ? '' : ' dock-off'}${b.group === 'ability' ? ' dock-ability' : ''}`}
        aria-disabled={!b.enabled}
        aria-label={`${b.label}, ${b.cost} AP, key ${b.key}${b.enabled ? '' : `, ${b.reason ?? 'not available'}`}`}
        onClick={(e) => {
          e.currentTarget.blur() // Enter and Space then confirm the preview instead of clicking this again
          send({ t: 'action', action: b.action })
        }}
        onPointerEnter={() => setHoveredAction({ unitId: unit.id, action: b.action })}
        onPointerLeave={() => setHoveredAction(null)}
        onFocus={() => setHoveredAction({ unitId: unit.id, action: b.action })}
        onBlur={() => setHoveredAction(null)}
      >
        <span className="dock-key">
          <Kbd>{b.key}</Kbd>
        </span>
        <span className="dock-cost">
          {costParts(b).base} AP{b.surcharge > 0 && <span className="surcharge"> +{b.surcharge}</span>}
        </span>
        <Icon name={b.icon} size={26} />
        <span className="dock-label">{b.label}</span>
        {note !== null && <span className="dock-why">{note}</span>}
      </button>
    )
  }
  return (
    <div className="action-bar">
      <div className="dock-unit">
        <Coin look={{ type: unit.type, tier: unit.tier, mine: true, commander: view.commanders[view.seat], clarity, power: unit.power, toughness: unit.toughness, maxToughness: unit.maxToughness }} size={44} />
        <div className="dock-unit-text">
          <span className="action-unit-name">{unitLabel(snap.registry, view, unit.id)}</span>
          <span className="dock-unit-stats">
            {unit.power} power · {unit.toughness}/{unit.maxToughness} toughness · {actionsLeft} of {own?.actionAllowance ?? 0} actions left
          </span>
        </div>
      </div>
      <div className="dock-groups" role="toolbar" aria-label="Actions">
        <div className="dock-group">{basic.map(tile)}</div>
        {abilities.length > 0 && <div className="dock-sep" aria-hidden="true" />}
        {abilities.length > 0 && <div className="dock-group">{abilities.map(tile)}</div>}
      </div>
      <button type="button" className="btn btn-small" onClick={() => send({ t: 'cycleUnit', delta: 1 })} title="Next unit that can still act (Tab)">
        Next <Kbd>Tab</Kbd> <span className="tag">{ready.length}</span>
      </button>
    </div>
  )
}

/** The side panel's card for the action hovered on the dock or armed on the board: name, cost, status and what it does. */
export function ActionCard({ snap, state }: { readonly snap: MatchSnapshot; readonly state: CommandState }) {
  const hovered = useUiState((s) => s.hoveredAction)
  const view = snap.view
  const unit = ownUnit(view, commandUnitId(state))
  if (unit === undefined) return null
  const armed = activeAction(state)
  const button = hoveredButton(view, unit.id, hovered) ?? (armed === null ? null : (actionButtons(view, unit).find((b) => sameAction(armed, b.action)) ?? null))
  if (button === null) return null
  return (
    <section className="action-card" aria-live="polite" aria-label={`${button.label} action`}>
      <header className="action-card-head">
        <Icon name={button.icon} size={22} />
        <span className="action-card-name">{button.label}</span>
        <span className="action-cost">
          {costParts(button).base} AP{button.surcharge > 0 && <span className="surcharge"> +{button.surcharge}</span>}
        </span>
        <Kbd>{button.key}</Kbd>
      </header>
      <p className="small">{button.description}</p>
      {!button.enabled && button.reason !== null && <p className="small action-card-why">Not available: {button.reason}</p>}
      {button.enabled && button.status !== null && <p className="small muted">{button.status}</p>}
    </section>
  )
}
