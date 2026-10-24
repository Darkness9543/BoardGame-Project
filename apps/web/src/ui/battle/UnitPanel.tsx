// The inspector (UX S-5.2, PX BT-15/16): the selected unit, else the hovered one, else what is being inspected
// (an enemy, a last-seen ghost, a building). Enemy cards show only public facts.

import {
  CAPTURE_RULE_TEXT,
  SIEGE_RULE_TEXT,
  buildingDef,
  commanderDef,
  footprintSquares,
  squareName,
  unitDef,
  type BuildingCore,
  type PlayerView,
  type Square,
  type UnitView,
} from '@coinduel/engine'
import type { InspectTarget } from '../../store/command'
import type { Ghost } from '../../store/ghosts'
import type { MatchSnapshot } from '../../store/matchController'
import { labelWithSquare, unitLabel } from '../../store/naming'
import { useSettings } from '../../store/settings'
import { Coin } from '../components/Coin'
import { Icon } from '../components/Icon'
import { AbilityList, StatLine, type StatItem } from '../components/UnitInfo'
import { BUILDING_SYMBOLS } from '../theme'
import { abilityStatus, artificerCounters, goalDistance, statusesOf } from './describe'

function statsOf(unit: UnitView): StatItem[] {
  const def = unitDef(unit.type)
  const items: StatItem[] = [
    { icon: 'power', label: 'Power', value: unit.power, ...(unit.power > def.power ? { changed: 'up' as const } : unit.power < def.power ? { changed: 'down' as const } : {}) },
    { icon: 'toughness', label: 'Toughness (current / max)', value: `${unit.toughness}/${unit.maxToughness}`, ...(unit.toughness < unit.maxToughness ? { changed: 'down' as const } : {}) },
    { icon: 'lov', label: 'Vision (LOV)', value: unit.lov },
    { icon: 'movement', label: 'Movement', value: unit.movement },
  ]
  if (unit.own !== null) items.push({ icon: 'ap', label: 'AP per action', value: unit.own.nextActionSurcharge > 0 ? `${unit.own.apCost}+${unit.own.nextActionSurcharge}` : unit.own.apCost })
  if (unit.attackRange > 1) items.push({ icon: 'range', label: 'Attack range', value: unit.attackRange })
  return items
}

function UnitCard({ snap, unit }: { readonly snap: MatchSnapshot; readonly unit: UnitView }) {
  const clarity = useSettings((s) => s.settings.clarityMode)
  const view = snap.view
  const mine = unit.owner === view.seat
  const commander = view.commanders[unit.owner]
  const name = unit.isCommander && commander !== null ? `${commanderDef(commander).name} (commander)` : unitLabel(snap.registry, view, unit.id)
  const own = unit.own
  const goal = goalDistance(view, unit)
  const counters = mine && unit.type === 'artificer' ? artificerCounters(view) : null
  const statuses = statusesOf(view, unit)
  return (
    <div className="unit-card">
      <header className="unit-card-head">
        <Coin look={{ type: unit.type, tier: unit.tier, mine, commander, clarity, power: unit.power, toughness: unit.toughness, maxToughness: unit.maxToughness, defending: unit.defending, stealthed: unit.stealthed }} size={58} />
        <div>
          <h2 className="unit-card-name">{name}</h2>
          <p className="muted small">
            {mine ? 'Yours' : `${snap.names[unit.owner]}'s`} · {unit.tier === null ? 'no tier' : `tier ${unit.tier}`}
            {unit.anchor !== null && ` · ${squareName(unit.anchor)}`}
            {unit.size === 2 && ' · size 2'}
          </p>
        </div>
      </header>
      <div className="toughness-bar" aria-label={`Toughness ${unit.toughness} of ${unit.maxToughness}`}>
        <span style={{ width: `${Math.max(0, Math.min(100, (unit.toughness / Math.max(1, unit.maxToughness)) * 100))}%` }} className={unit.toughness * 3 <= unit.maxToughness ? 'tb-low' : unit.toughness * 3 <= unit.maxToughness * 2 ? 'tb-mid' : 'tb-high'} />
      </div>
      <StatLine items={statsOf(unit)} />
      {own !== null && (
        <p className="small">
          Actions: {[...Array(own.actionAllowance).keys()].map((i) => (
            <span key={i} className={i < own.turn.actionsUsed ? 'pip pip-used' : 'pip'} aria-hidden="true" />
          ))}{' '}
          {own.actionAllowance - own.turn.actionsUsed} of {own.actionAllowance} left
          {own.turn.moves > 0 && ` · moved ${own.turn.moves}×`}
        </p>
      )}
      {goal !== null && <p className="small strong">Goal row: {goal === 0 ? 'reached' : `${goal} row${goal === 1 ? '' : 's'} away`} (reaching it wins)</p>}
      {statuses.length > 0 && (
        <ul className="statuses">
          {statuses.map((s) => (
            <li key={s.label} className={`status status-${s.tone}`} title={s.title}>
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {counters !== null && (
        <p className="small">
          <Icon name="teller-mine" size={13} /> Mines {counters.mines} · <Icon name="vintage-robot" size={13} /> Dummies {counters.dummies}
        </p>
      )}
      <AbilityList abilities={own?.abilities ?? []} unitAp={own?.apCost ?? 0} {...(mine ? { status: (id: string) => abilityStatus(view, unit, id) } : {})} />
      {!mine && <p className="muted small">Enemy cards show what is visible: cooldowns, AP and hidden effects stay hidden.</p>}
    </div>
  )
}

function GhostCard({ ghost, snap }: { readonly ghost: Ghost; readonly snap: MatchSnapshot }) {
  const clarity = useSettings((s) => s.settings.clarityMode)
  const view = snap.view
  return (
    <div className="unit-card unit-card-ghost">
      <header className="unit-card-head">
        <Coin look={{ type: ghost.type, tier: ghost.tier, mine: false, commander: view.commanders[ghost.owner], clarity, ghost: true, power: ghost.power, toughness: ghost.toughness }} size={58} />
        <div>
          <h2 className="unit-card-name">{labelWithSquare(snap.registry, view, ghost.unitId).replace(/^enemy /, 'Enemy ')}</h2>
          <p className="muted small">
            Last seen in round {ghost.seenRound} at {squareName(ghost.anchor)} · {ghost.toughness}/{ghost.maxToughness}
          </p>
        </div>
      </header>
      <p className="small">{ghost.vanished ? 'It vanished in plain sight: it may be stealthed nearby.' : 'A memory, not live data: it may have moved.'}</p>
    </div>
  )
}

function BuildingCard({ building, view, names }: { readonly building: BuildingCore; readonly view: PlayerView; readonly names: MatchSnapshot['names'] }) {
  const def = buildingDef(building.kind)
  return (
    <div className="unit-card">
      <header className="unit-card-head">
        <Icon name={BUILDING_SYMBOLS[building.kind]} size={48} />
        <div>
          <h2 className="unit-card-name">{def.name}</h2>
          <p className="muted small">Controlled by {building.controller === null ? 'nobody' : building.controller === view.seat ? 'you' : names[building.controller]}</p>
        </div>
      </header>
      <p className="small">{def.text}</p>
      <p className="small muted">{CAPTURE_RULE_TEXT}</p>
      {view.buildings.length === 2 && <p className="small muted">{SIEGE_RULE_TEXT}</p>}
    </div>
  )
}

export function UnitPanel({ snap, unitId, inspect }: { readonly snap: MatchSnapshot; readonly unitId: string | null; readonly inspect: InspectTarget | null }) {
  const view = snap.view
  const unit = unitId === null ? undefined : view.units.find((u) => u.id === unitId)
  if (unit !== undefined) return <UnitCard snap={snap} unit={unit} />
  if (inspect?.kind === 'ghost') {
    const ghost = snap.ghosts.ghosts.find((g) => g.unitId === inspect.unitId)
    if (ghost !== undefined) return <GhostCard ghost={ghost} snap={snap} />
  }
  if (inspect?.kind === 'square') {
    const square: Square = inspect.square
    const building = view.buildings.find((b) => footprintSquares(b.anchor, buildingDef(b.kind).size).some((s) => s.x === square.x && s.y === square.y))
    if (building !== undefined) return <BuildingCard building={building} view={view} names={snap.names} />
  }
  return (
    <div className="unit-card unit-card-empty">
      <p className="muted">Hover or select a unit to see its card.</p>
      <p className="muted small">Tab cycles the units that can still act; click an enemy, a ghost or a building to inspect it.</p>
    </div>
  )
}
