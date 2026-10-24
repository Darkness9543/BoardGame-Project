// S05 lobby (PX 5, UX 21-22): the invite card, both seats (R16: commanders and Baba Yaga's variant are shown as
// soon as they're chosen), the army picker with an in-lobby builder (AB-15), Ready, and the host's settings,
// which un-ready both players when changed (LB-02).

import { useState } from 'react'
import {
  SCENARIOS,
  TIME_BANK,
  TURN_TIMER,
  checkArmy,
  commanderDef,
  validateIntent,
  type ArmyList,
  type MatchSettings,
  type PlayerView,
  type Seat,
} from '@coinduel/engine'
import { STARTER_ARMIES, defaultArmyName, newSavedArmy, sameArmy, useArmies } from '../../store/armies'
import { useSettings } from '../../store/settings'
import { toast } from '../../store/toasts'
import { leaveMatch } from '../actions'
import { ArmyBuilder } from '../army/ArmyBuilder'
import type { BuilderDraft } from '../army/builderModel'
import { apCurveText } from '../battle/describe'
import { CopyButton, Segmented, Toggle } from '../components/common'
import { Icon } from '../components/Icon'
import { useMatch } from '../hooks/useMatch'
import { COMMANDER_PORTRAITS } from '../theme'

const TIMER_PRESETS = [
  { value: 'off', label: 'Off', turn: null, bank: null },
  { value: 'quick', label: 'Quick 45 s + 30 s', turn: 45, bank: 30 },
  { value: 'standard', label: `Standard ${TURN_TIMER ?? 90} s + ${TIME_BANK} s`, turn: TURN_TIMER, bank: TIME_BANK },
  { value: 'relaxed', label: 'Relaxed 3 min + 2 min', turn: 180, bank: 120 },
] as const

type TimerPreset = (typeof TIMER_PRESETS)[number]['value'] | 'custom'

function timerPreset(settings: MatchSettings): TimerPreset {
  return TIMER_PRESETS.find((p) => p.turn === settings.turnTimerSeconds && p.bank === settings.timeBankSeconds)?.value ?? 'custom'
}

function SeatCard({ view, seat, name, me, presence }: { readonly view: PlayerView; readonly seat: Seat; readonly name: string; readonly me: boolean; readonly presence: string }) {
  const commander = view.commanders[seat]
  const variant = view.commanderVariants[seat]
  const def = commander === null ? null : commanderDef(commander)
  const chosen = view.lobby.armyChosen[seat]
  const ready = view.lobby.ready[seat]
  return (
    <div className={`seat-card ${ready ? 'seat-ready' : ''}`}>
      <div className="seat-head">
        <span className={`dot dot-${presence}`} aria-hidden="true" />
        <h3>
          {name} {me && <span className="muted small">(you)</span>}
        </h3>
        <span className="tag">{seat === 'host' ? 'Host' : 'Guest'}</span>
      </div>
      {def === null ? (
        <p className="muted">{chosen ? 'Army chosen' : me ? 'Choose an army below' : 'Choosing an army…'}</p>
      ) : (
        <div className="seat-commander" title={def.text}>
          <Icon name={COMMANDER_PORTRAITS[def.id]} size={30} />
          <div>
            <span className="strong">{def.name}</span> <span className="muted small">“{def.title}”</span>
            {variant !== null && <div className="small">Variant: {def.variants.find((v) => v.id === variant)?.name ?? variant}</div>}
          </div>
        </div>
      )}
      <p className={ready ? 'ok strong' : 'muted'}>{ready ? 'Ready ✓' : chosen ? 'Not ready' : ''}</p>
    </div>
  )
}

function SettingsPanel({ view, onPatch }: { readonly view: PlayerView; readonly onPatch: (patch: Partial<MatchSettings>) => void }) {
  const s = view.settings
  const host = view.seat === 'host'
  const [budget, setBudget] = useState(String(s.budget))
  const preset = timerPreset(s)
  return (
    <section className="card lobby-settings" aria-label="Match settings">
      <h2 className="section-title">Match settings {host ? '' : <span className="muted small">(the host decides)</span>}</h2>
      <div className="setting-row">
        <span className="setting-label">Scenario</span>
        <Segmented
          label="Scenario"
          value={s.scenarioId}
          disabled={!host}
          options={SCENARIOS.map((sc) => ({ value: sc.id, label: `${sc.name}${sc.blockers.length > 0 ? ` (${sc.blockers.length} blockers)` : ''}` }))}
          onChange={(scenarioId) => onPatch({ scenarioId })}
        />
      </div>
      <div className="setting-row">
        <span className="setting-label">Budget</span>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            const n = Number.parseInt(budget, 10)
            if (Number.isInteger(n) && n > 0) onPatch({ budget: n })
            else setBudget(String(s.budget))
          }}
        >
          <input className="input-number" inputMode="numeric" value={host ? budget : String(s.budget)} disabled={!host} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))} aria-label="Budget" />
          {host && String(s.budget) !== budget && (
            <button className="btn btn-small" type="submit">
              Apply
            </button>
          )}
        </form>
      </div>
      <div className="setting-row">
        <span className="setting-label">Buildings</span>
        <Toggle label="The Keep" checked={s.keepEnabled} disabled={!host} onChange={(keepEnabled) => onPatch({ keepEnabled })} />
        <Toggle label="The Market" checked={s.marketEnabled} disabled={!host} onChange={(marketEnabled) => onPatch({ marketEnabled })} />
      </div>
      <div className="setting-row">
        <span className="setting-label">Take-backs</span>
        <Segmented
          label="Take-backs per game"
          value={!s.takebacks ? 'off' : s.takebacksPerGame === null ? 'unlimited' : String(s.takebacksPerGame)}
          disabled={!host}
          options={[
            { value: 'unlimited', label: 'Unlimited' },
            { value: '3', label: '3 each' },
            { value: '1', label: '1 each' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={(v) => onPatch(v === 'off' ? { takebacks: false } : { takebacks: true, takebacksPerGame: v === 'unlimited' ? null : Number(v) })}
        />
      </div>
      <div className="setting-row">
        <span className="setting-label" title="R29: when both the turn time and the bank run out, the turn ends (never the game)">
          Turn timer
        </span>
        <Segmented
          label="Turn timer"
          value={preset === 'custom' ? 'standard' : preset}
          disabled={!host}
          options={TIMER_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
          onChange={(v) => {
            const p = TIMER_PRESETS.find((x) => x.value === v)
            if (p !== undefined) onPatch({ turnTimerSeconds: p.turn, timeBankSeconds: p.bank })
          }}
        />
        {preset === 'custom' && <span className="muted small">Custom: {s.turnTimerSeconds} s + {s.timeBankSeconds} s bank</span>}
      </div>
      <div className="setting-row">
        <span className="setting-label">First player</span>
        <Segmented
          label="First player"
          value="coin"
          disabled={!host}
          options={[
            { value: 'coin', label: 'Coin flip' },
            { value: 'host', label: 'Host', disabled: true, title: 'A2-04: the rules engine always flips the coin (commit-reveal)' },
            { value: 'guest', label: 'Guest', disabled: true, title: 'A2-04: the rules engine always flips the coin (commit-reveal)' },
          ]}
          onChange={() => undefined}
        />
        <span className="muted small">The first player plays South.</span>
      </div>
      <div className="setting-row setting-row-text">
        <span className="setting-label">AP per turn</span>
        <span className="small">{apCurveText()}</span>
      </div>
    </section>
  )
}

function ArmyPicker({ view, onUse, onBuild }: { readonly view: PlayerView; readonly onUse: (army: ArmyList, savedId: string | null) => void; readonly onBuild: (draft: BuilderDraft | null) => void }) {
  const armies = useArmies((s) => s.armies)
  const entries = [
    ...armies.map((a) => ({ key: a.id, name: a.name, army: a.army, savedId: a.id as string | null, starter: false })),
    ...STARTER_ARMIES.map((s) => ({ key: s.id, name: s.name, army: s.army, savedId: null, starter: true })),
  ]
  return (
    <section className="card army-picker" aria-label="Choose your army">
      <div className="row row-between">
        <h2 className="section-title">Your army</h2>
        <div className="row">
          {view.myArmy !== null && (
            <button type="button" className="btn btn-small" onClick={() => onBuild({ name: 'Edited army', army: view.myArmy as ArmyList })}>
              Edit current
            </button>
          )}
          <button type="button" className="btn btn-small btn-primary" onClick={() => onBuild(null)}>
            + Build a new army
          </button>
        </div>
      </div>
      <ul className="picker-list">
        {entries.map((e) => {
          const check = checkArmy(e.army, view.settings)
          const current = view.myArmy !== null && sameArmy(view.myArmy, e.army)
          const def = commanderDef(e.army.commander)
          return (
            <li key={e.key} className={`picker-item ${current ? 'picker-current' : ''} ${check.ok ? '' : 'picker-bad'}`}>
              <Icon name={COMMANDER_PORTRAITS[e.army.commander]} size={22} />
              <span className="picker-name">
                {e.name} {e.starter && <span className="tag">Starter</span>}
              </span>
              <span className="muted small">
                {def.name} · {check.cost}/{view.settings.budget}
              </span>
              {!check.ok && <span className="tag tag-bad" title={check.errors.join('\n')}>{check.errors[0]?.startsWith('Over budget') ? `Over this lobby's budget (${check.cost}/${view.settings.budget})` : check.errors[0]}</span>}
              <button type="button" className="btn btn-small" disabled={!check.ok || current} onClick={() => onUse(e.army, e.savedId)}>
                {current ? 'Chosen' : 'Use'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function Lobby() {
  const match = useMatch()
  const notify = useSettings((s) => s.settings.notifyTurn)
  const updateSettings = useSettings((s) => s.update)
  const save = useArmies((s) => s.save)
  const markUsed = useArmies((s) => s.markUsed)
  const armies = useArmies((s) => s.armies)
  const [builder, setBuilder] = useState<BuilderDraft | null>(null)
  const [saveToMine, setSaveToMine] = useState(true)
  if (match === null) return null
  const { snap, controller } = match
  const view = snap.view
  const session = controller.session
  const me = view.seat
  const other: Seat = me === 'host' ? 'guest' : 'host'
  const link = session.lobby.inviteLink
  const roomCode = session.room?.code ?? null
  const sandbox = controller.options.sandbox
  const readyCheck = validateIntent(view, { kind: 'setReady', ready: true })
  const bothReady = view.lobby.ready.host && view.lobby.ready.guest

  const run = (promise: Promise<{ ok: boolean; message?: string }>, done?: string) =>
    void promise.then((r) => {
      if (!r.ok) toast(r.message ?? 'Refused', 'warn')
      else if (done !== undefined) toast(done, 'good')
    })

  const useArmy = (army: ArmyList, savedId: string | null) => {
    if (savedId !== null) markUsed(savedId)
    run(session.lobby.setArmy(army))
  }

  return (
    <main className="screen lobby">
      <header className="screen-header">
        <button type="button" className="btn btn-ghost" onClick={leaveMatch}>
          ← Leave
        </button>
        <h1 className="screen-title">{sandbox ? `Lobby · playing as ${snap.names[me]}` : 'Lobby'}</h1>
        {roomCode !== null && <span className="muted">Room {roomCode}</span>}
      </header>
      {sandbox && (
        <p className="banner banner-info">
          Sandbox: choose an army for {snap.names[me]} and press Ready; the other seat takes over to choose theirs. Only the host seat changes the match settings.
        </p>
      )}
      {link !== null && (
        <section className="card invite-card" aria-label="Invite">
          <h2 className="section-title">Invite your friend</h2>
          <div className="invite-row">
            <input className="invite-link" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Invite link" />
            <CopyButton text={link} label="Copy link" className="btn btn-primary" />
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button type="button" className="btn" onClick={() => void navigator.share({ title: 'Coin Duel', text: 'Join my duel', url: link }).catch(() => undefined)}>
                Share…
              </button>
            )}
          </div>
          <p className="muted small">
            Paste this link to your friend (chat, mail…). The first person to open it plays against you. Keep this tab open until they join.
          </p>
        </section>
      )}
      <section className="seats" aria-label="Players">
        <SeatCard view={view} seat={me} name={snap.names[me]} me presence={snap.connection === 'connected' ? 'ok' : 'warn'} />
        {snap.opponent.joined ? (
          <SeatCard view={view} seat={other} name={snap.names[other]} me={false} presence={snap.opponent.activity === 'active' ? 'ok' : snap.opponent.activity === 'hidden' ? 'warn' : 'bad'} />
        ) : (
          <div className="seat-card seat-waiting">
            <p className="pulse">Waiting for your friend to open the link…</p>
          </div>
        )}
      </section>
      <div className="lobby-ready">
        <button
          type="button"
          className={view.lobby.ready[me] ? 'btn btn-large' : 'btn btn-primary btn-large'}
          disabled={!view.lobby.ready[me] && !readyCheck.ok}
          title={readyCheck.ok ? undefined : readyCheck.message}
          onClick={() => run(session.lobby.setReady(!view.lobby.ready[me]))}
        >
          {view.lobby.ready[me] ? 'Not ready' : 'Ready'}
        </button>
        {!readyCheck.ok && !view.lobby.ready[me] && <span className="muted small">{readyCheck.message}</span>}
        {bothReady && <span className="pulse strong">Both ready · the battle is being set up…</span>}
        <Toggle
          label="Notify me when it's my turn"
          checked={notify}
          onChange={(on) => {
            if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
              void Notification.requestPermission().then((p) => updateSettings({ notifyTurn: p === 'granted' }))
            } else updateSettings({ notifyTurn: on })
          }}
        />
      </div>
      <div className="lobby-columns">
        <ArmyPicker view={view} onUse={useArmy} onBuild={(draft) => setBuilder(draft ?? { name: defaultArmyName('trill', armies), army: { faction: 'empire', commander: 'trill', units: {} } })} />
        <SettingsPanel view={view} onPatch={(patch) => run(session.lobby.updateSettings(patch), 'Settings changed: both players must ready again')} />
      </div>
      {builder !== null && (
        <div className="drawer" role="dialog" aria-label="Army builder">
          <div className="drawer-head">
            <h2 className="display">Build an army for this match</h2>
            <span className="muted small">
              Budget {view.settings.budget} · {snap.opponent.joined ? `${snap.names[other]} is ${view.lobby.ready[other] ? 'ready' : 'choosing'}` : 'waiting for your friend'}
            </span>
          </div>
          <ArmyBuilder
            draft={builder}
            onChange={setBuilder}
            settings={view.settings}
            actions={
              <>
                <Toggle label="Save to my armies" checked={saveToMine} onChange={setSaveToMine} />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!checkArmy(builder.army, view.settings).ok}
                  onClick={() => {
                    const savedId = saveToMine ? save(newSavedArmy(builder.army, builder.name, view.settings.budget, Date.now())).id : null
                    useArmy(builder.army, savedId)
                    setBuilder(null)
                  }}
                >
                  Use this army
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setBuilder(null)}>
                  Cancel
                </button>
              </>
            }
          />
        </div>
      )}
    </main>
  )
}
