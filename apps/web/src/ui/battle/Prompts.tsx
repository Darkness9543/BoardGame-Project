// Banners and prompts of the battle (UX S-5.7, 8.5, 9.3, 25, 26): the forecast panel of a locked preview, the
// mine prompt (A8-17, R34), the take-back cards (TB-4, TB-5), the reaction prompt with its preference (A2-30),
// the draw offer, presence and turn banners.

import { useEffect, useState, type ReactElement } from 'react'
import { MINE_DAMAGE, MINE_LARGE_BONUS, MINE_LARGE_MIN_SIZE, REACTION_PROMPT_TIMEOUT_S, TAKEBACK_TIMEOUT_S, abilityData, hasAbilityData, squareName, type PreferenceValue } from '@coinduel/engine'
import type { CommandState } from '../../store/command'
import { useCommandStore } from '../../store/commandStore'
import { mineForecast, type Forecast } from '../../store/forecast'
import type { MatchController, MatchSnapshot } from '../../store/matchController'
import { labelWithSquare, sentence } from '../../store/naming'
import { ownUnit } from '../../store/rules'
import { useSettings } from '../../store/settings'
import { toast } from '../../store/toasts'
import { Countdown, Kbd, Segmented } from '../components/common'
import { describeIntent, disclosureLines } from './describe'

export function ForecastPanel({ snap, state, forecast }: { readonly snap: MatchSnapshot; readonly state: CommandState; readonly forecast: Forecast | null }) {
  const send = useCommandStore((s) => s.send)
  if (state.t !== 'confirming') return null
  const view = snap.view
  const unit = ownUnit(view, state.unitId)
  const intent = state.intent
  const lethal = forecast?.hits.some((h) => h.lethal) ?? false
  const wins = forecast?.hits.some((h) => h.wins) ?? false
  const allies = forecast?.hits.filter((h) => h.ally).length ?? 0
  const title = (() => {
    switch (intent.kind) {
      case 'move': {
        const end = intent.path[intent.path.length - 1]
        return `Move to ${end === undefined ? '?' : squareName(end)} · ${intent.path.length} step${intent.path.length === 1 ? '' : 's'}`
      }
      case 'attack':
        return intent.target.kind === 'square' ? `Fire at ${squareName(intent.target.square)}` : 'Attack'
      case 'charge':
        return 'Charge'
      case 'defend':
        return 'Defend'
      case 'groupMarch':
        return `Group march ${intent.direction} (${intent.unitIds.length} units)`
      case 'useAbility':
        return forecast?.title ?? (hasAbilityData(intent.abilityId) ? abilityData(intent.abilityId).name : 'Use ability')
      case 'endTurn':
        return 'End turn'
    }
  })()
  const confirmLabel = wins ? 'Confirm & WIN' : allies > 0 ? `Confirm (hits ${allies} of yours)` : intent.kind === 'attack' && intent.target.kind === 'square' ? `Fire at ${squareName(intent.target.square)}` : 'Confirm'
  return (
    <div className="forecast-panel" role="dialog" aria-label="Preview" data-keys-pass>
      <header className="forecast-head">
        <span className="strong">{title}</span>
        {unit !== undefined && <span className="muted small">{labelWithSquare(snap.registry, view, unit.id)}</span>}
      </header>
      {intent.kind === 'attack' && intent.target.kind === 'square' && (
        <p className="small">A blind shot: it sets off a mine there if there is one and hits a hidden unit if there is one (Power {unit?.power ?? '?'} before its reductions). The AP is spent either way.</p>
      )}
      {intent.kind === 'defend' && <p className="small">Incoming damage is halved, rounded up, until your next turn starts. Acting again with this unit cancels it.</p>}
      {intent.kind === 'charge' && <p className="small">Moves, then attacks from the end square. If anything interrupts the move, there is no attack and the AP is spent.</p>}
      {intent.kind === 'groupMarch' && <p className="small">Each unit steps one square, front to back. An interruption stops only that unit.</p>}
      {forecast?.hits.map((hit) => (
        <div key={hit.targetId} className={`forecast-hit${hit.lethal ? ' hit-lethal' : ''}${hit.ally ? ' hit-ally' : ''}`}>
          <div className="row row-between">
            <span>{labelWithSquare(snap.registry, view, hit.targetId)}</span>
            <span className="strong">
              {forecast.uncertain ? '≈' : ''}−{hit.amount} · {hit.before} → {hit.after}
              {hit.wins ? ' · WIN' : hit.lethal ? ' · LETHAL' : ''}
            </span>
          </div>
          <table className="forecast-rows">
            <tbody>
              {hit.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.label}</td>
                  <td className="num">{i === 0 ? r.delta : r.delta >= 0 ? `+${r.delta}` : `${r.delta}`}</td>
                  <td className="num muted">= {r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {forecast?.heals.map((h) => (
        <div key={h.targetId} className="forecast-heal small">
          {labelWithSquare(snap.registry, view, h.targetId)}: +{h.amount} → {h.after}/{h.max}
        </div>
      ))}
      {forecast?.notes.map((n) => (
        <p key={n} className="small muted">
          {n}
        </p>
      ))}
      {forecast?.uncertain === true && <p className="small warn">≈ Fogged squares nearby could hide modifiers: the result may differ.</p>}
      {state.hazards.length > 0 && <p className="small warn">⚠ Walks into a known mine at {state.hazards.map(squareName).join(', ')}.</p>}
      {lethal && !wins && <p className="small strong">This defeats the target.</p>}
      <div className="row forecast-actions">
        <button type="button" className="btn btn-primary" data-autofocus onClick={() => send({ t: 'confirm' })}>
          {confirmLabel} <Kbd>⏎</Kbd>
        </button>
        <button type="button" className="btn" onClick={() => send({ t: 'cancel' })}>
          Back <Kbd>Esc</Kbd>
        </button>
      </div>
    </div>
  )
}

/** UX 8.7: a popover, Cancel has the default focus, "Move anyway" needs a click or M. */
export function HazardPrompt({ snap, state }: { readonly snap: MatchSnapshot; readonly state: CommandState }) {
  const send = useCommandStore((s) => s.send)
  const update = useSettings((s) => s.update)
  const [dontAsk, setDontAsk] = useState(false)
  if (state.t !== 'hazard') return null
  const view = snap.view
  const unit = ownUnit(view, state.unitId)
  const first = state.hazards[0]
  const own = first !== undefined && view.mines.some((m) => m.square.x === first.x && m.square.y === first.y && m.owner === view.seat)
  const hit = unit === undefined ? null : mineForecast(view, unit)
  const notes = [
    ...(unit !== undefined && unit.size >= MINE_LARGE_MIN_SIZE ? [`+${MINE_LARGE_BONUS} for size ${MINE_LARGE_MIN_SIZE}+`] : []),
    ...(hit?.rows.slice(1).map((r) => `${r.label} ${r.delta > 0 ? '+' : '−'}${Math.abs(r.delta)}`) ?? []),
  ]
  const commanderRule = unit?.isCommander === true
  return (
    <div className="popover hazard-prompt" role="alertdialog" aria-label="Walk into a mine?" data-keys-pass>
      <p className="strong">⚠ Walk into {own ? 'your mine' : 'a revealed enemy mine'}?</p>
      <p className="small">
        {sentence(unit === undefined ? 'this unit' : labelWithSquare(snap.registry, view, unit.id))} will set off the mine at {first === undefined ? '?' : squareName(first)}: {hit?.amount ?? MINE_DAMAGE} damage{notes.length > 0 ? ` (${notes.join(', ')})` : ''}
        {hit !== null && `, toughness ${hit.before} → ${hit.after}`}
        {hit?.lethal === true ? ' · LETHAL' : ''}. The move stops there.
      </p>
      {commanderRule ? (
        <p className="small muted">Your commander always asks (R34).</p>
      ) : (
        <label className="small">
          <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} /> Don't ask again (Options › Mine warning)
        </label>
      )}
      <div className="row">
        <button type="button" className="btn" data-autofocus autoFocus onClick={() => send({ t: 'hazardCancel' })}>
          Cancel <Kbd>Esc</Kbd>
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (dontAsk) update({ mineWarning: false })
            send({ t: 'hazardAccept' })
          }}
        >
          Move anyway <Kbd>M</Kbd>
        </button>
      </div>
    </div>
  )
}

/** TB-4/TB-5: the decider sees the action and what it revealed; buttons only, no shortcuts (UX 25.3). */
export function TakebackCard({ controller, snap }: { readonly controller: MatchController; readonly snap: MatchSnapshot }) {
  const view = snap.view
  const request = view.takeback.request
  if (request === null) return null
  const deadline = controller.session.takeback.deadline ?? (snap.takebackSeenAt ?? Date.now()) + TAKEBACK_TIMEOUT_S * 1000
  const opponent = request.requester === view.seat ? (view.seat === 'host' ? 'guest' : 'host') : request.requester
  if (request.requester === view.seat) {
    return (
      <div className="banner banner-info" role="status">
        Waiting for {snap.names[opponent]} to answer your take-back request: {describeIntent(request.action, snap.registry, view)}. <Countdown deadline={deadline} total={TAKEBACK_TIMEOUT_S} />
      </div>
    )
  }
  const lines = request.disclosure === null ? [] : disclosureLines(request.disclosure, snap.registry, view)
  const answer = (accept: boolean) => void controller.session.takeback.respond(accept).then((r) => (r.ok ? undefined : toast(r.message, 'warn')))
  return (
    <div className="banner banner-card takeback-card" role="alertdialog" aria-label="Take-back request">
      <p className="strong">↶ {snap.names[request.requester]} asks to take back their last action</p>
      <p>Their last action: {sentence(describeIntent(request.action, snap.registry, view))}.</p>
      {lines.map((line) => (
        <p key={line} className="small">
          {line}.
        </p>
      ))}
      {lines.length === 0 && <p className="small muted">It revealed nothing of your side.</p>}
      <div className="row">
        <button type="button" className="btn" onClick={() => answer(false)}>
          Decline
        </button>
        <button type="button" className="btn btn-primary" onClick={() => answer(true)}>
          Accept
        </button>
        <Countdown deadline={deadline} total={TAKEBACK_TIMEOUT_S} />
      </div>
    </div>
  )
}

/** A2-30 / UX 26: Queso's revive and the Cauldron ask the deciding player, 15 s then the default. */
export function ReactionPrompt({ controller, snap }: { readonly controller: MatchController; readonly snap: MatchSnapshot }) {
  const preference = useSettings((s) => s.settings.revivePreference)
  const decision = snap.reaction
  if (decision === null) return null
  const total = decision.timeoutSeconds > 0 ? decision.timeoutSeconds : REACTION_PROMPT_TIMEOUT_S
  const deadline = snap.reactionDeadline
  const answer = (choice: string) =>
    void controller.session.dispatch({ kind: 'respondDecision', decisionId: decision.id, choice }).then((r) => (r.ok ? undefined : toast(r.message, 'warn')))
  return (
    <div className="banner banner-card reaction-card" role="alertdialog" aria-label="Reaction">
      <p className="strong">{decision.prompt}</p>
      <div className="row">
        {decision.options.map((o) => (
          <button key={o.id} type="button" className={o.id === decision.defaultOption ? 'btn' : 'btn btn-primary'} onClick={() => answer(o.id)}>
            {o.label}
            {o.id === decision.defaultOption ? ' (default)' : ''}
          </button>
        ))}
        {deadline !== null && <Countdown deadline={deadline} total={total} />}
      </div>
      {decision.preferenceKey !== null && (
        <div className="row small">
          <span className="muted">Next time:</span>
          <Segmented<PreferenceValue>
            label="Reaction preference"
            value={preference}
            options={[
              { value: 'ask', label: 'Ask me' },
              { value: 'always', label: 'Always yes' },
              { value: 'never', label: 'Never' },
            ]}
            onChange={(value) => controller.setRevivePreference(value)}
          />
        </div>
      )}
    </div>
  )
}

export function StatusBanners({ controller, snap }: { readonly controller: MatchController; readonly snap: MatchSnapshot }) {
  const view = snap.view
  const other = view.seat === 'host' ? 'guest' : 'host'
  const offer = view.drawOffer
  const banners: ReactElement[] = []
  const problem = controller.session.problem?.message ?? null
  if (problem !== null) {
    banners.push(
      <div key="problem" className="banner banner-bad">
        {problem}
      </div>,
    )
  }
  if (snap.connection === 'lost' || snap.connection === 'connecting') {
    banners.push(
      <div key="conn" className="banner banner-bad">
        Connection lost · reconnecting… The board stays visible; actions wait until you're back.
      </div>,
    )
  } else if (snap.connection === 'unstable') {
    banners.push(
      <div key="conn" className="banner banner-warn">
        The connection is slow…
      </div>,
    )
  }
  if (snap.opponent.activity === 'away' && view.phase === 'battle') {
    banners.push(
      <div key="away" className="banner banner-warn">
        {snap.names[other]} is disconnected · waiting for them to come back.
      </div>,
    )
  }
  if (view.opponentDeciding) {
    banners.push(
      <div key="deciding" className="banner banner-info pulse">
        {snap.names[other]} is deciding…
      </div>,
    )
  }
  if (offer !== null && view.phase === 'battle') {
    banners.push(
      offer === view.seat ? (
        <div key="draw" className="banner banner-info">
          You offered a draw · it lapses at the end of the turn.
        </div>
      ) : (
        <div key="draw" className="banner banner-card">
          {snap.names[offer]} offers a draw.{' '}
          <button type="button" className="btn btn-small" onClick={() => void controller.session.dispatch({ kind: 'declineDraw' })}>
            Decline
          </button>{' '}
          <button type="button" className="btn btn-small btn-primary" onClick={() => void controller.session.dispatch({ kind: 'acceptDraw' })}>
            Accept the draw
          </button>
        </div>
      ),
    )
  }
  if (snap.replaying) {
    banners.push(
      <div key="replay" className="banner banner-info">
        Replaying what you saw of {snap.names[other]}'s turn ·{' '}
        <button type="button" className="btn btn-small" onClick={() => controller.skipPlayback()}>
          Skip
        </button>
      </div>,
    )
  }
  return <div className="banners">{banners}</div>
}


/** PX BT-03: a short "Your turn" banner; clicks pass through. */
export function TurnBanner({ snap }: { readonly snap: MatchSnapshot }) {
  const banner = snap.banner
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (banner === null || Date.now() - banner.at > 3000) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 1600)
    return () => clearTimeout(timer)
  }, [banner])
  if (!visible || banner === null) return null
  return (
    <div className={`turn-banner ${banner.mine ? 'turn-banner-mine' : ''}`} aria-live="assertive">
      {banner.text}
    </div>
  )
}
