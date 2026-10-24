// Lobby and deployment resolution (2.1 steps 1-5, 5.4). Validation happens before these run.

import { COMMANDER_REVEAL } from './constants'
import { ROSTER_IDS } from './content/units'
import type { Resolver } from './resolve'
import { flipFirstSeat, seedRng } from './rng'
import { buildingsFor, newUnit, opponentOf } from './state'
import { beginBattle } from './turn'
import { SEATS, type ArmyList, type CommanderId, type MatchSettings, type Seat, type Square } from './types'

/** A5-10 / A5-13: armies are chosen simultaneously and in secret; changing one after Ready un-readies. */
export function setArmy(r: Resolver, seat: Seat, army: ArmyList): void {
  const seatState = r.state.seats[seat]
  seatState.army = {
    faction: army.faction,
    commander: army.commander,
    units: { ...army.units },
    ...(army.variant === undefined ? {} : { variant: army.variant }),
  }
  const variant = army.variant ?? null
  r.emit({ type: 'armyChosen', seat, commander: army.commander, variant }, COMMANDER_REVEAL === 'lobby' ? SEATS : [seat])
  if (COMMANDER_REVEAL !== 'lobby') r.emit({ type: 'armyChosen', seat, commander: null, variant: null }, [opponentOf(seat)])
  if (seatState.ready) setReady(r, seat, false) // PX AB-16: changing the army un-readies
}

export function setReady(r: Resolver, seat: Seat, ready: boolean): void {
  r.state.seats[seat].ready = ready
  r.emit({ type: 'readyChanged', seat, ready }, SEATS)
}

export function updateSettings(r: Resolver, patch: Partial<MatchSettings>): void {
  const settings: MatchSettings = { ...r.state.settings, ...patch }
  r.state.settings = settings
  r.state.buildings = buildingsFor(settings)
  r.emit({ type: 'settingsChanged', settings }, SEATS)
  for (const seat of SEATS) if (r.state.seats[seat].ready) setReady(r, seat, false)
}

/**
 * A2-04: the coin flip uses the state RNG reseeded with the commit-reveal coin seed (rng.combineSecrets), so
 * neither side can bias it; the winner plays South. Then every unit instance is created undeployed.
 * Commanders are public from the lobby (R16); with COMMANDER_REVEAL 'deploymentStart' they are announced here.
 */
export function startDeployment(r: Resolver, coinSeed: string): void {
  const state = r.state
  state.rng = seedRng(`${state.seed}|${coinSeed}`)
  const [south, rng] = flipFirstSeat(state.rng)
  state.rng = rng
  state.southSeat = south
  r.emit({ type: 'coinFlipped', southSeat: south }, SEATS)

  for (const seat of [south, opponentOf(south)]) {
    const army = state.seats[seat].army
    if (army === null) throw new Error('startDeployment without an army')
    state.units.push(newUnit(state, 'commander', seat, null, 1, null))
    for (const type of ROSTER_IDS) {
      for (let i = 0; i < (army.units[type] ?? 0); i++) state.units.push(newUnit(state, type, seat, null, 1, null))
    }
  }
  for (const unit of state.units) unit.toughness = r.stats(unit).baseToughness
  state.phase = 'deployment'
  const commanders: Record<Seat, CommanderId> = {
    host: state.seats.host.army?.commander ?? 'baseline',
    guest: state.seats.guest.army?.commander ?? 'baseline',
  }
  if (COMMANDER_REVEAL === 'deploymentStart') r.emit({ type: 'deploymentStarted', commanders }, SEATS)
}

/** A5-06: placements stay hidden and editable until both players confirm; editing withdraws Confirm. */
export function deploy(r: Resolver, seat: Seat, unitId: string, anchor: Square | null): void {
  const unit = r.stateUnit(unitId)
  if (unit === undefined) return
  unit.anchor = anchor === null ? null : { x: anchor.x, y: anchor.y }
  r.emit(anchor === null ? { type: 'unitUnplaced', unitId } : { type: 'unitPlaced', unitId, anchor }, [seat])
  if (r.state.seats[seat].deploymentConfirmed) confirmDeployment(r, seat, false)
}

export function confirmDeployment(r: Resolver, seat: Seat, confirmed: boolean): void {
  r.state.seats[seat].deploymentConfirmed = confirmed
  r.emit({ type: 'deploymentConfirmed', seat, confirmed }, SEATS)
  if (SEATS.every((s) => r.state.seats[s].deploymentConfirmed)) beginBattle(r)
}
