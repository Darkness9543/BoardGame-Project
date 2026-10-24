// Turn structure (2.10): the fixed end-of-turn order (damage ticks -> commander check -> heals -> captures
// -> expiries) and the start of the next player's turn (expire -> reset -> refill AP -> advance own-turn
// index -> start-of-turn triggers). The end phase is a resumable step machine so a reaction decision
// (Queso's revive after a tick, X-26) can pause it.

import { liveAbility } from './abilities/registry'
import type { HitContext, TurnEffects } from './abilities/types'
import {
  AP_CARRYOVER,
  apForRound,
  APPROACH_BOOST,
  CAPTURE_TIMING,
  DUMMIES_CAPTURE,
  FIRST_TURN_AP,
  MARKET_AP_BONUS,
  SHOW_OPPONENT_AP,
  SIEGE_TURNS,
  STEALTH_CAPTURES,
} from './constants'
import { buildingDef } from './content/buildings'
import { processDecisions } from './decisions'
import { ringSquares, sameSquare } from './geometry'
import type { Resolver } from './resolve'
import { freshTurnState, opponentOf } from './state'
import { SEATS, type Seat, type UnitId } from './types'

interface Tick {
  readonly source: string
  readonly target: UnitId
  readonly amount: number
}

/** Collects end-of-turn effects as data from units (APNAP) and areas; one tick per unit per source (A3-15). */
function collectTurnEffects(r: Resolver, endingSeat: Seat): { damage: Tick[]; heal: Tick[] } {
  const damage: Tick[] = []
  const heal: Tick[] = []
  const add = (source: string, effects: TurnEffects | null | undefined): void => {
    if (effects === null || effects === undefined) return
    for (const d of effects.damage ?? []) damage.push({ source, target: d.target, amount: d.amount })
    for (const h of effects.heal ?? []) heal.push({ source, target: h.target, amount: h.amount })
  }
  for (const holder of r.holdersApnap()) {
    for (const id of r.abilitiesOf(holder)) {
      const def = liveAbility(id)
      add(id, holder.owner === endingSeat ? def?.endOfOwnTurn?.(r, holder) : def?.endOfOpponentTurn?.(r, holder))
    }
  }
  for (const area of [...r.state.areas].sort((a, b) => a.seq - b.seq)) {
    add(area.abilityId, liveAbility(area.abilityId)?.area?.endOfTurn?.(r, area, endingSeat))
  }
  const once = (ticks: Tick[]): Tick[] => {
    const seen = new Set<string>()
    return ticks.filter((t) => {
      const key = `${t.source}|${t.target}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  return { damage: once(damage), heal: once(heal) }
}

/** 2.10 steps 1-2: all ticks are one simultaneous event; commander deaths end the game inside it. */
function applyDamageTicks(r: Resolver, ticks: readonly Tick[]): void {
  const hits: HitContext[] = []
  for (const t of ticks) {
    const target = r.stateUnit(t.target)
    if (target !== undefined && t.amount > 0) hits.push({ target, kind: 'tick', base: t.amount, source: t.source, dealer: null })
  }
  if (hits.length > 0) r.dealSimultaneous(hits)
}

/** 2.10 step 3: heals after damage, each capped (order is irrelevant once damage is applied). */
function applyHeals(r: Resolver, ticks: readonly Tick[]): void {
  for (const t of ticks) {
    const target = r.stateUnit(t.target)
    if (target !== undefined) r.heal(target, t.amount, t.source)
  }
}

/** A6-06 / A6-07 / A6-08 / R32: exactly one side present in the 16-square ring takes (or keeps) control. */
export function checkCaptures(r: Resolver, endingSeat: Seat): void {
  for (const building of r.state.buildings) {
    const ring = ringSquares(building.anchor, buildingDef(building.kind).size) // R32: 16 squares around a 3x3
    const present = new Set<Seat>()
    for (const unit of r.state.units) {
      if (unit.anchor === null) continue
      if (unit.stealthed && !STEALTH_CAPTURES) continue
      if (unit.type === 'noAcb' && !DUMMIES_CAPTURE) continue
      if (r.footprint(unit).some((s) => ring.some((g) => sameSquare(g, s)))) present.add(unit.owner)
    }
    if (present.size === 2) {
      r.emit({ type: 'buildingContested', building: building.kind }, SEATS)
      continue
    }
    const [seat] = [...present]
    if (seat === undefined) continue
    if (CAPTURE_TIMING === 'endOfOwnTurn' && seat !== endingSeat) continue
    if (building.controller === seat) {
      r.emit({ type: 'buildingHeld', building: building.kind, seat }, SEATS)
    } else {
      const previous = building.controller
      building.controller = seat
      if (previous !== null) r.state.seats[previous].siegeTurns = 0 // R30: losing either building resets the count
      r.emit({ type: 'buildingCaptured', building: building.kind, seat, previous }, SEATS)
    }
  }
  r.invalidate()
  r.settle()
}

/** R30 "Siege": both buildings (both enabled) held at the start of SIEGE_TURNS consecutive own turns wins. */
function checkSiege(r: Resolver, seat: Seat): void {
  const seatState = r.state.seats[seat]
  const keep = r.state.buildings.find((b) => b.kind === 'keep')
  const market = r.state.buildings.find((b) => b.kind === 'market')
  const holdsBoth = keep !== undefined && market !== undefined && keep.controller === seat && market.controller === seat
  seatState.siegeTurns = holdsBoth ? seatState.siegeTurns + 1 : 0
  if (seatState.siegeTurns >= SIEGE_TURNS) r.endGame(seat, 'siege')
}

/**
 * The AP a seat starts its turn with: the round's curve (R1 with R28's late escalation), doubled until the end
 * of the round of first contact (R28's approach boost), then the Market's and Tribute's bonuses after the cap
 * (R31, R25), carry-over (A2-03: none) and any Cauldron debt (R11).
 */
function turnPool(r: Resolver, seat: Seat, turnNumber: number, ownTurn: number): number {
  const state = r.state
  const round = Math.ceil(turnNumber / 2)
  const first = state.southSeat === seat && ownTurn === 1
  const curve = first && FIRST_TURN_AP !== null ? FIRST_TURN_AP : apForRound(round)
  const boosted = state.firstContactRound === null || round <= state.firstContactRound ? curve * APPROACH_BOOST : curve
  const market = state.buildings.some((b) => b.kind === 'market' && b.controller === seat) ? MARKET_AP_BONUS : 0
  const bonuses = new Map<string, number>()
  for (const holder of r.holdersApnap()) {
    if (holder.owner !== seat) continue
    for (const id of r.abilitiesOf(holder)) {
      const hook = liveAbility(id)?.startOfTurnAp
      if (hook !== undefined) bonuses.set(id, Math.max(bonuses.get(id) ?? 0, hook(r, holder)))
    }
  }
  const tribute = [...bonuses.values()].reduce((sum, n) => sum + n, 0)
  const carried = Math.min(AP_CARRYOVER, Math.max(0, state.seats[seat].ap))
  return Math.max(0, boosted + market + tribute + carried - state.seats[seat].apDebt)
}

/** Runs (or resumes) the end phase of the active player and then starts the opponent's turn. */
export function runTurnTransition(r: Resolver): void {
  for (;;) {
    const transition = r.state.transition
    if (transition === null || r.isOver()) return
    const ending = transition.endingSeat
    switch (transition.next) {
      case 'damage':
        transition.next = 'heal'
        applyDamageTicks(r, collectTurnEffects(r, ending).damage)
        break
      case 'heal':
        transition.next = 'capture'
        applyHeals(r, collectTurnEffects(r, ending).heal)
        break
      case 'capture':
        transition.next = 'expire'
        checkCaptures(r, ending)
        break
      case 'expire':
        transition.next = 'start' // 2.10 step 5: no end-of-turn expiries in v1
        break
      case 'start':
        r.state.transition = null
        startTurn(r, opponentOf(ending))
        return
    }
    if (processDecisions(r) === 'waiting') return
  }
}

export function endTurn(r: Resolver): void {
  const active = r.activeSeat
  if (active === null) return
  r.emit({ type: 'turnEnded', seat: active }, SEATS)
  r.state.drawOffer = null
  r.state.transition = { endingSeat: active, next: 'damage' }
  runTurnTransition(r)
}

/** 2.10 start phase for `seat`. */
export function startTurn(r: Resolver, seat: Seat): void {
  const state = r.state
  const seatState = state.seats[seat]
  const ownTurn = seatState.ownTurns + 1
  // 1. Expire this seat's Defend statuses and areas lasting until the start of its turn (A2-21, A2-23, A2-24).
  for (const unit of state.units) if (unit.owner === seat) r.cancelDefend(unit, 'expired')
  for (const area of state.areas.filter((a) => a.owner === seat && a.expiresAtOwnTurn <= ownTurn)) {
    state.areas = state.areas.filter((a) => a !== area)
    const other = opponentOf(seat)
    r.emit({ type: 'areaExpired', areaId: area.id }, area.squares.some((s) => r.seesSquare(other, s)) ? SEATS : [seat])
  }
  // 2. Reset per-turn counters (own-turn counters for this seat; every-turn counters for both seats).
  for (const unit of state.units) if (unit.owner === seat) unit.turn = freshTurnState()
  seatState.counters = {}
  for (const s of SEATS) state.seats[s].turnCounters = {}
  // 3. Refill AP (R1, R9, R25, R28, R31, R11; see turnPool).
  const number = (state.turn?.number ?? 0) + 1
  r.noteFirstContact()
  const before = seatState.ap
  seatState.ap = turnPool(r, seat, number, ownTurn)
  seatState.apDebt = 0
  r.emit({ type: 'apChanged', seat, ap: seatState.ap, delta: seatState.ap - before }, SHOW_OPPONENT_AP ? SEATS : [seat])
  // 4. Advance the own-turn index; cooldown readiness follows from it (A2-22).
  seatState.ownTurns = ownTurn
  state.turn = { number, activeSeat: seat }
  r.emit({ type: 'turnStarted', seat, turnNumber: number, round: Math.ceil(number / 2) }, SEATS)
  checkSiege(r, seat)
  if (r.isOver()) return
  // 5. Start-of-turn triggers.
  for (const holder of r.holdersApnap()) {
    if (holder.owner !== seat) continue
    for (const id of r.abilitiesOf(holder)) {
      if (r.isOver() || !state.units.includes(holder)) break
      liveAbility(id)?.startOfOwnTurn?.(r, holder)
    }
  }
  r.settle()
}

/** Both deployments confirmed: units start at full toughness, then South's first turn (2.1 step 6). */
export function beginBattle(r: Resolver): void {
  const state = r.state
  state.phase = 'battle'
  for (const unit of state.units) {
    unit.auraToughness = 0
    unit.toughness = r.stats(unit).baseToughness
  }
  r.invalidate()
  r.settle()
  const south = state.southSeat
  if (south === null) throw new Error('No first player')
  r.emit({ type: 'battleStarted', southSeat: south }, SEATS)
  startTurn(r, south)
}
