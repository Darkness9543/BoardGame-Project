// #/dev/sandbox (PX MM-05): one person plays both seats in one tab (hot seat), each seat still seeing only its own
// fog. The full flow runs through the lobby (each seat builds or picks its army, Baba Yaga's variant included), the
// hidden deployment of both seats and the battle; the board follows whoever must act, or the seat chosen by hand.
// R29: no turn timer unless the lobby turns it on. Sandbox games never count for achievements.

import { useState } from 'react'
import { DEFAULT_SETTINGS, SCENARIOS, checkArmy, type ArmyList, type MatchSettings, type ScenarioId, type Seat } from '@coinduel/engine'
import { STARTER_ARMIES, useArmies } from '../../store/armies'
import { autoDeployIntents } from '../../store/deploy'
import { NAME_MAX, profileName } from '../../store/profile'
import { useSessionStore } from '../../store/sessionStore'
import { sendAll } from '../actions'
import { ScreenHeader, Segmented, Toggle } from '../components/common'
import { useMatch } from '../hooks/useMatch'
import { MatchBody } from './MatchScreen'

interface Choice {
  readonly key: string
  readonly name: string
  readonly army: ArmyList
}

function ArmySelect({ label, choices, value, onChange }: { readonly label: string; readonly choices: readonly Choice[]; readonly value: string; readonly onChange: (key: string) => void }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {choices.map((c) => (
          <option key={c.key} value={c.key} disabled={!checkArmy(c.army, DEFAULT_SETTINGS).ok}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function NameField({ label, value, onChange }: { readonly label: string; readonly value: string; readonly onChange: (name: string) => void }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input value={value} maxLength={NAME_MAX} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function Setup() {
  const armies = useArmies((s) => s.armies)
  const start = useSessionStore((s) => s.startSandbox)
  const skirmish = useSessionStore((s) => s.startSkirmish)
  const choices: Choice[] = [...STARTER_ARMIES.map((s) => ({ key: s.id, name: `Starter: ${s.name}`, army: s.army })), ...armies.map((a) => ({ key: a.id, name: a.name, army: a.army }))]
  const [names, setNames] = useState<Record<Seat, string>>({ host: profileName(), guest: 'Player 2' })
  const [host, setHost] = useState(choices[0]?.key ?? '')
  const [guest, setGuest] = useState(choices[3]?.key ?? choices[0]?.key ?? '')
  const [scenarioId, setScenario] = useState<ScenarioId>('crossroads')
  const [keep, setKeep] = useState(true)
  const [market, setMarket] = useState(true)
  const pick = (key: string): ArmyList | undefined => choices.find((c) => c.key === key)?.army
  const playerNames = { host: names.host.trim() || 'Player 1', guest: names.guest.trim() || 'Player 2' }
  const settings: Partial<MatchSettings> = { scenarioId, keepEnabled: keep, marketEnabled: market }
  return (
    <main className="screen">
      <ScreenHeader title="Sandbox (hot seat)" back={{ label: 'Menu', href: '#/' }} />
      <section className="card sandbox-setup">
        <p className="muted">
          Play both sides in this tab to try armies and rules. Each seat sees only its own fog; the board follows whoever has to act (switch seats by hand any
          time). No turn timer unless you turn it on in the lobby, and no achievements.
        </p>
        <div className="row">
          <NameField label="Player 1 (host seat)" value={names.host} onChange={(name) => setNames({ ...names, host: name })} />
          <NameField label="Player 2 (guest seat)" value={names.guest} onChange={(name) => setNames({ ...names, guest: name })} />
        </div>
        <div className="setting-row">
          <span className="setting-label">Scenario</span>
          <Segmented label="Scenario" value={scenarioId} options={SCENARIOS.map((s) => ({ value: s.id, label: s.name }))} onChange={setScenario} />
        </div>
        <div className="setting-row">
          <Toggle label="The Keep" checked={keep} onChange={setKeep} />
          <Toggle label="The Market" checked={market} onChange={setMarket} />
        </div>
        <div className="row">
          <button type="button" className="btn btn-primary btn-large" onClick={() => start({ names: playerNames, settings })} title="Each seat builds or picks its army in the lobby, then both deploy">
            Start in the lobby
          </button>
        </div>
      </section>
      <section className="card sandbox-setup">
        <h2 className="section-title">Quick start</h2>
        <p className="muted small">Skip the lobby with two ready-made armies (you still deploy both sides, or auto-deploy them), or jump into a small battle.</p>
        <div className="row">
          <ArmySelect label="Player 1 army" choices={choices} value={host} onChange={setHost} />
          <ArmySelect label="Player 2 army" choices={choices} value={guest} onChange={setGuest} />
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btn-large"
            onClick={() => {
              const a = pick(host)
              const b = pick(guest)
              if (a !== undefined && b !== undefined) start({ names: playerNames, settings, armies: { host: a, guest: b } })
            }}
          >
            Deploy these armies
          </button>
          <button type="button" className="btn btn-large" onClick={() => skirmish(playerNames)} title="Skip army building and deployment: a small battle already in contact">
            Quick skirmish
          </button>
        </div>
      </section>
    </main>
  )
}

function Toolbar() {
  const sandbox = useSessionStore((s) => s.sandbox)
  const playAs = useSessionStore((s) => s.playAs)
  const setFollow = useSessionStore((s) => s.setFollowTurn)
  const detach = useSessionStore((s) => s.detach)
  const match = useMatch()
  const [busy, setBusy] = useState(false)
  if (sandbox === null || match === null) return null
  const view = match.snap.view
  const names = match.snap.names
  return (
    <div className="sandbox-bar" role="toolbar" aria-label="Sandbox">
      <span className="tag tag-warn">Sandbox</span>
      <Segmented label="Play as" value={sandbox.seat} options={[{ value: 'host', label: names.host }, { value: 'guest', label: names.guest }]} onChange={playAs} />
      <Toggle label="Follow the turn" checked={sandbox.followTurn} onChange={setFollow} />
      {view.phase === 'deployment' && (
        <button
          type="button"
          className="btn btn-small"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void (async () => {
              for (const seat of ['host', 'guest'] as const) {
                const session = sandbox.controllers[seat].session
                if (session.view.deploymentConfirmed[seat]) continue
                await sendAll(session, [...autoDeployIntents(session.view), { kind: 'confirmDeployment', confirmed: true }])
              }
            })().finally(() => setBusy(false))
          }}
        >
          Auto-deploy both and start
        </button>
      )}
      <button type="button" className="btn btn-small btn-ghost" onClick={detach}>
        New sandbox
      </button>
    </div>
  )
}

export function Sandbox() {
  const mode = useSessionStore((s) => s.mode)
  if (mode !== 'sandbox') return <Setup />
  return (
    <div className="sandbox">
      <Toolbar />
      <MatchBody />
    </div>
  )
}
