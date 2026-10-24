// The Resolver mutates a private clone of the state while an intent resolves, and records events with
// their audience. It implements ResolveContext for ability code and adds the core helpers the rule modules
// use (AP, actions, mines, deaths, state-based checks).

import { liveAbility } from './abilities/registry'
import type {
  AreaSpec,
  AttackOutcome,
  AttackTarget,
  DamageOutcome,
  DeathInfo,
  DecisionRequest,
  HitContext,
  MinePlacement,
  ResolveContext,
  RevealCause,
  SplashSpec,
} from './abilities/types'
import {
  MINDS_EYE_REVEALS_MINES,
  MINE_DAMAGE,
  MINE_LARGE_BONUS,
  MINE_LARGE_MIN_SIZE,
  OVERHEAL,
  REACTION_PROMPT_TIMEOUT_S,
  SHOW_OPPONENT_AP,
} from './constants'
import { computeHit } from './damage'
import type { EventBody, GameEvent } from './events'
import { footprintSquares, sameSquare } from './geometry'
import { StateQuery, type AreaCore } from './query'
import {
  drawId,
  drawSeq,
  isOpenGround,
  newUnit,
  opponentOf,
} from './state'
import { syncAuraToughness } from './stats'
import { matchSummary, recordDamage, recordLoss, type DamageCredit } from './summary'
import { SEATS, type DeathCause, type GameResultReason, type GameState, type MineState, type Seat, type Square, type UnitCore, type UnitId, type UnitState } from './types'
import { detectorOf, maskHas, unitVisibleTo, visionMask, watchersOf } from './vision'

interface DeathRecord {
  readonly unit: UnitState
  readonly cause: DeathCause
}

const NO_DAMAGE = (targetId: UnitId): DamageOutcome => ({ targetId, amount: 0, breakdown: [], killed: false })

export class Resolver extends StateQuery implements ResolveContext {
  readonly events: GameEvent[] = []
  private visionCache: Partial<Record<Seat, Uint8Array>> = {}
  private abilityDepth = 0
  private deferredDeaths: DeathInfo[] = []

  constructor(state: GameState) {
    super(state)
  }

  // ---------------------------------------------------------------- bookkeeping

  isOver(): boolean {
    return this.state.result !== null
  }

  /** Vision depends on positions, stealth and LOV; call after any change to them. It also records first contact (R28). */
  invalidate(): void {
    this.visionCache = {}
    this.noteFirstContact()
  }

  vision(seat: Seat): Uint8Array {
    const cached = this.visionCache[seat]
    if (cached !== undefined) return cached
    const mask = visionMask(this, seat)
    this.visionCache[seat] = mask
    return mask
  }

  stateUnit(id: UnitId): UnitState | undefined {
    return this.state.units.find((u) => u.id === id)
  }

  canSee(seat: Seat, unit: UnitCore): boolean {
    return unitVisibleTo(this, seat, unit, this.vision(seat))
  }

  seesSquare(seat: Seat, square: Square): boolean {
    return maskHas(this.vision(seat), square)
  }

  /** The owner plus every other seat that currently sees the unit. */
  seatsSeeing(unit: UnitCore): Seat[] {
    return SEATS.filter((s) => s === unit.owner || this.canSee(s, unit))
  }

  seatsSeeingSquare(square: Square, always: Seat | null): Seat[] {
    return SEATS.filter((s) => s === always || this.seesSquare(s, square))
  }

  emit(event: EventBody, visibleTo: readonly Seat[]): void {
    const audience = SEATS.filter((s) => visibleTo.includes(s))
    if (audience.length === 0) return
    this.events.push({ ...event, visibleTo: audience })
  }

  /** Living placed units, the non-active player's first, then creation order (APNAP, A2-28). */
  holdersApnap(): UnitState[] {
    const active = this.activeSeat
    return this.state.units
      .filter((u) => u.anchor !== null)
      .sort((a, b) => Number(a.owner === active) - Number(b.owner === active) || a.seq - b.seq)
  }

  endGame(winner: Seat | null, reason: GameResultReason): void {
    if (this.isOver()) return
    this.state.result = { winner, reason, turnNumber: this.turnNumber }
    this.state.phase = 'ended'
    this.state.decisions = []
    this.state.transition = null
    this.state.takeback.request = null
    this.state.drawOffer = null
    // settle() stops once the game is over, so auras whose source fell in the final resolution (Hex Ward with Baba Yaga,
    // a Strong aura) end here: the final board shows consistent toughness (A2-26, A3-11).
    for (const unit of this.state.units) syncAuraToughness(this, unit)
    this.emit({ type: 'gameEnded', result: this.state.result }, SEATS)
    const summary = matchSummary(this.state)
    if (summary !== null) this.emit({ type: 'matchSummary', summary }, SEATS) // R38, R39
  }

  // ---------------------------------------------------------------- AP and actions (2.3, 2.4)

  spendAp(seat: Seat, amount: number): void {
    if (amount === 0) return
    const seatState = this.state.seats[seat]
    seatState.ap -= amount
    this.emit({ type: 'apChanged', seat, ap: seatState.ap, delta: -amount }, SHOW_OPPONENT_AP ? SEATS : [seat]) // R15
  }

  /** Records one of the unit's actions; a later action cancels Defend (A2-21, C25). */
  beginAction(unit: UnitState, kind: 'move' | 'attack' | 'defend' | 'ability', cost: number): void {
    this.spendAp(unit.owner, cost)
    unit.turn.actionsUsed += 1
    if (kind === 'move') unit.turn.moves += 1
    this.cancelDefend(unit, 'acted')
  }

  cancelDefend(unit: UnitState, reason: 'expired' | 'acted'): void {
    if (!unit.defending) return
    unit.defending = false
    this.emit({ type: 'defendChanged', unitId: unit.id, defending: false, reason }, this.seatsSeeing(unit))
  }

  /** Runs an ability effect; sacrifices inside it trigger after it (A2-29). */
  withAbilityScope(effect: () => void): void {
    this.abilityDepth += 1
    try {
      effect()
    } finally {
      this.abilityDepth -= 1
    }
    if (this.abilityDepth === 0 && this.deferredDeaths.length > 0) {
      const deaths = this.deferredDeaths
      this.deferredDeaths = []
      this.runDeathTriggers(deaths)
      this.settle()
    }
  }

  // ---------------------------------------------------------------- damage (3.3, 3.4)

  dealDamage(hit: HitContext): DamageOutcome {
    return this.dealDamageTogether([hit])[0] ?? NO_DAMAGE(hit.target.id)
  }

  /** A1-10 / 3.4: one effect instance hits each unit at most once (the first listed hit wins). */
  dealDamageTogether(hits: readonly HitContext[]): readonly DamageOutcome[] {
    const seen = new Set<UnitId>()
    return this.dealSimultaneous(
      hits.filter((h) => {
        if (seen.has(h.target.id)) return false
        seen.add(h.target.id)
        return true
      }),
    )
  }

  /** R25 Smite / A8-20 Forceful slam: the main hit is listed first, so a unit on both takes only the main damage. */
  dealSplash(spec: SplashSpec): readonly DamageOutcome[] {
    const hits: HitContext[] = []
    const add = (target: UnitCore, base: number): void => {
      if (spec.friendlyFire || target.owner !== spec.dealer.owner) hits.push({ target, kind: 'ability', base, source: spec.source, dealer: spec.dealer })
    }
    if (spec.target !== null) add(spec.target, spec.damage)
    for (const square of spec.squares) {
      const unit = this.unitAt(square)
      if (unit !== undefined) add(unit, spec.splash)
    }
    return this.dealDamageTogether(hits)
  }

  /** R39: the dealer, else the unit the core credits (a mine's Artificer, an area's caster), else nobody. */
  private creditOf(hit: HitContext): DamageCredit | null {
    if (hit.dealer !== null) return { seat: hit.dealer.owner, type: hit.dealer.type }
    const id = hit.creditId ?? null
    const unit = id === null ? undefined : (this.stateUnit(id) ?? this.fallenUnit(id))
    return unit === undefined ? null : { seat: unit.owner, type: unit.type }
  }

  /** Several damage instances resolved as one event (end-of-turn ticks): computed on the board before, applied together, deaths together. */
  dealSimultaneous(hits: readonly HitContext[]): readonly DamageOutcome[] {
    if (this.isOver()) return hits.map((h) => NO_DAMAGE(h.target.id))
    const computed = hits.map((hit) => ({ hit, unit: this.stateUnit(hit.target.id), result: computeHit(this, hit) }))
    const applied: { hit: HitContext; unit: UnitState; amount: number; removed: number; outcomeIndex: number }[] = []
    const outcomes: DamageOutcome[] = computed.map((c, index) => {
      if (c.unit === undefined || c.unit.anchor === null || c.result.amount <= 0) {
        return { targetId: c.hit.target.id, amount: 0, breakdown: c.result.breakdown, killed: false }
      }
      const removed = Math.min(c.result.amount, Math.max(0, c.unit.toughness))
      c.unit.toughness -= c.result.amount
      applied.push({ hit: c.hit, unit: c.unit, amount: c.result.amount, removed, outcomeIndex: index })
      return { targetId: c.unit.id, amount: c.result.amount, breakdown: c.result.breakdown, killed: false }
    })
    // A4-07 (R2): damage received inside enemy LOV reveals a stealthed unit; audiences are computed after it.
    for (const a of applied) {
      if (a.unit.stealthed && watchersOf(this, opponentOf(a.unit.owner), this.footprint(a.unit)).length > 0) {
        this.reveal(a.unit, 'damage', null)
      }
    }
    for (const a of applied) {
      const outcome = outcomes[a.outcomeIndex]
      if (outcome !== undefined) this.emitDamage(a.unit, a.hit, outcome)
    }
    for (const a of applied) {
      for (const holder of this.holdersApnap()) {
        for (const id of this.abilitiesOf(holder)) {
          const outcome = outcomes[a.outcomeIndex]
          const hook = liveAbility(id)?.onDamaged
          if (hook !== undefined && outcome !== undefined) hook(this, holder, a.hit, outcome)
        }
      }
    }
    const dead = applied.filter((a) => a.unit.toughness <= 0 && this.state.units.includes(a.unit))
    for (const a of applied) recordDamage(this.state.matchStats, this.creditOf(a.hit), a.unit, a.removed, dead.includes(a)) // R39
    for (const d of dead) {
      const outcome = outcomes[d.outcomeIndex]
      if (outcome !== undefined) outcomes[d.outcomeIndex] = { ...outcome, killed: true }
    }
    if (dead.length > 0) this.resolveDeaths(dead.map((d) => ({ unit: d.unit, cause: 'damage' })), false)
    return outcomes
  }

  /** A4-12: a seat that sees the target but not the dealer learns the amount, not the dealer. */
  private emitDamage(unit: UnitState, hit: HitContext, outcome: DamageOutcome): void {
    const audience = this.seatsSeeing(unit)
    const dealer = hit.dealer
    const full = audience.filter((s) => dealer === null || s === dealer.owner || this.canSee(s, dealer))
    const redacted = audience.filter((s) => !full.includes(s))
    const body = {
      type: 'unitDamaged' as const,
      unitId: unit.id,
      amount: outcome.amount,
      toughness: unit.toughness,
      kind: hit.kind,
      source: hit.source,
      breakdown: outcome.breakdown,
    }
    this.emit({ ...body, dealerId: dealer?.id ?? null }, full)
    this.emit({ ...body, dealerId: null }, redacted)
  }

  // ---------------------------------------------------------------- deaths (3.8, A3-12, 6.2)

  private resolveDeaths(records: readonly DeathRecord[], deferTriggers: boolean): void {
    const infos: DeathInfo[] = []
    for (const { unit, cause } of records) {
      const index = this.state.units.indexOf(unit)
      if (index < 0 || unit.anchor === null) continue
      const stats = this.stats(unit)
      const audience = this.seatsSeeing(unit)
      infos.push({
        unit,
        footprint: this.footprint(unit),
        cause,
        tier: stats.tier,
        baseToughness: stats.baseToughness,
        isCommander: unit.type === 'commander',
      })
      this.state.units.splice(index, 1)
      unit.defending = false
      this.state.fallen.push({ unit, diedOnTurn: this.turnNumber, cause })
      recordLoss(this.state.matchStats, unit) // R39
      this.emit({ type: 'unitDied', unitId: unit.id, unitType: unit.type, owner: unit.owner, at: unit.anchor, cause }, audience)
    }
    this.invalidate()
    const losers = new Set(infos.filter((i) => i.isCommander).map((i) => i.unit.owner))
    if (losers.size === 2) this.endGame(null, 'simultaneousCommanderDeath') // A6-02
    else for (const loser of losers) this.endGame(opponentOf(loser), 'conquest') // A6-01
    if (this.isOver()) return
    if (deferTriggers) this.deferredDeaths.push(...infos)
    else this.runDeathTriggers(infos)
    this.settle()
  }

  private runDeathTriggers(deaths: readonly DeathInfo[]): void {
    for (const death of deaths) {
      for (const holder of this.holdersApnap()) {
        if (!this.state.units.includes(holder)) continue
        for (const id of this.abilitiesOf(holder)) {
          if (this.isOver()) return
          liveAbility(id)?.onUnitDied?.(this, holder, death)
        }
      }
    }
  }

  // ---------------------------------------------------------------- toughness (3.5-3.9)

  heal(target: UnitCore, amount: number, source: string): number {
    const unit = this.stateUnit(target.id)
    if (unit === undefined || unit.anchor === null || amount <= 0 || this.isOver()) return 0
    const max = this.stats(unit).maxToughness
    const healed = OVERHEAL ? amount : Math.max(0, Math.min(amount, max - unit.toughness))
    if (healed === 0) return 0
    unit.toughness += healed
    this.emit({ type: 'unitHealed', unitId: unit.id, amount: healed, toughness: unit.toughness, source }, this.seatsSeeing(unit))
    return healed
  }

  loseToughness(target: UnitCore, amount: number, source: string, options: { readonly canKill?: boolean } = {}): number {
    const unit = this.stateUnit(target.id)
    if (unit === undefined || amount <= 0 || this.isOver()) return 0
    const lost = Math.max(0, Math.min(amount, options.canKill === true ? unit.toughness : unit.toughness - 1))
    if (lost === 0) return 0
    unit.toughness -= lost
    this.emit({ type: 'toughnessLost', unitId: unit.id, amount: lost, toughness: unit.toughness, source }, this.seatsSeeing(unit))
    if (unit.toughness <= 0) this.resolveDeaths([{ unit, cause: 'toughnessLoss' }], this.abilityDepth > 0)
    return lost
  }

  /**
   * R28: records the round of first contact the moment any seat sees an enemy unit (stealthed ones only once
   * revealed; mines never count). invalidate() calls it on every vision change, so a sighting that ends within the
   * same action (the mover dies on a mine) still counts. Before South's first turn starts, it is round 1.
   */
  noteFirstContact(): void {
    if (this.state.firstContactRound !== null || this.state.phase !== 'battle') return
    const contact = this.units().some((u) => this.canSee(this.opponentOf(u.owner), u))
    if (contact) this.state.firstContactRound = Math.max(1, Math.ceil(this.turnNumber / 2))
  }

  sacrifice(target: UnitCore, _source: string): void {
    const unit = this.stateUnit(target.id)
    if (unit === undefined) return
    if (unit.type === 'commander') throw new Error('A commander can never be sacrificed (A7-04)')
    this.resolveDeaths([{ unit, cause: 'sacrifice' }], this.abilityDepth > 0)
  }

  changePermanentToughness(target: UnitCore, delta: number): void {
    const unit = this.stateUnit(target.id)
    if (unit === undefined || delta === 0) return
    unit.permanentToughness += delta
    unit.toughness = Math.min(unit.toughness, this.stats(unit).maxToughness)
    this.emit(
      { type: 'maxToughnessChanged', unitId: unit.id, delta, toughness: unit.toughness, source: 'permanent' },
      this.seatsSeeing(unit),
    )
  }

  // ---------------------------------------------------------------- attacks (2.6)

  attack(attacker: UnitCore, target: AttackTarget, options: { readonly source: string; readonly triggered: boolean }): AttackOutcome {
    const unit = this.stateUnit(attacker.id)
    const nothing: AttackOutcome = { result: 'nothing', damage: 0, targetId: null }
    if (unit === undefined || unit.anchor === null || this.isOver()) return nothing
    if (!options.triggered) this.cancelDefend(unit, 'acted')
    const power = this.stats(unit).power // A3-01: attack damage = current Power; the target never hits back (A2-20)
    this.emit({ type: 'unitAttacked', attackerId: unit.id, target, source: options.source }, this.seatsSeeing(unit))

    let victim: UnitState | undefined
    if (target.kind === 'unit') {
      victim = this.stateUnit(target.unitId)
    } else {
      // A2-18 / RNG-4: a blind shot hits whatever stands there, sets off a mine there, or finds nothing.
      const occupant = this.unitAt(target.square)
      victim = occupant === undefined ? undefined : this.stateUnit(occupant.id)
      if (victim === undefined) {
        const mine = this.state.mines.find((m) => sameSquare(m.square, target.square))
        if (mine !== undefined) {
          this.explodeMine(mine, null, 'shot')
          return { result: 'mine', damage: 0, targetId: null }
        }
        this.emit({ type: 'attackMissed', attackerId: unit.id, square: target.square }, [unit.owner])
        return nothing
      }
    }
    if (victim === undefined || victim.anchor === null) return nothing
    const outcome = this.dealDamage({ target: victim, kind: 'attack', base: power, source: options.source, dealer: unit })
    return { result: outcome.amount > 0 ? 'hit' : 'nullified', damage: outcome.amount, targetId: victim.id }
  }

  // ---------------------------------------------------------------- mines (8.16)

  /** A8-16: one explosion; the victim takes 5 (10 for size >= 2) as its own damage instance. */
  explodeMine(mine: MineState, victim: UnitState | null, trigger: 'entered' | 'shot'): void {
    const index = this.state.mines.indexOf(mine)
    if (index < 0) return
    this.state.mines.splice(index, 1)
    // 4.8: the owner and every seat watching the square learn of the explosion, but only a seat that can see the
    // victim learns which unit it was (a stealthed unit on an unwatched mine stays unnamed).
    const audience = this.seatsSeeingSquare(mine.square, mine.owner)
    const named = victim === null ? [] : audience.filter((s) => this.canSee(s, victim))
    const body = { type: 'mineExploded' as const, mineId: mine.id, owner: mine.owner, square: mine.square, trigger }
    this.emit({ ...body, victimId: victim?.id ?? null }, named)
    this.emit({ ...body, victimId: null }, audience.filter((s) => !named.includes(s)))
    if (victim === null) return
    const big = this.sizeOf(victim) >= MINE_LARGE_MIN_SIZE
    const base = MINE_DAMAGE + (big ? MINE_LARGE_BONUS : 0)
    this.dealDamage({ target: victim, kind: 'mine', base, source: 'mine', dealer: null, creditId: mine.placedBy })
  }

  /** Mines on squares a unit just entered (TMN-2: each one is a separate instance). Returns whether any went off. */
  triggerMines(unit: UnitState, entered: readonly Square[]): boolean {
    let exploded = false
    for (const square of entered) {
      if (!this.state.units.includes(unit) || this.isOver()) break
      const mine = this.state.mines.find((m) => sameSquare(m.square, square))
      if (mine === undefined) continue
      exploded = true
      this.explodeMine(mine, unit, 'entered')
    }
    return exploded
  }

  placeMine(owner: Seat, square: Square, placedBy: UnitCore | null): MinePlacement {
    const existing = this.state.mines.find((m) => sameSquare(m.square, square))
    if (existing !== undefined) {
      // ART-8: placing onto an unseen enemy mine fails and reveals it.
      if (existing.owner !== owner && !existing.revealed) this.revealMine(existing)
      return 'blockedByHiddenMine'
    }
    const mine: MineState = { id: drawId(this.state, 'm'), owner, square, revealed: false, seq: drawSeq(this.state), placedBy: placedBy?.id ?? null }
    this.state.mines.push(mine)
    this.emit({ type: 'minePlaced', mineId: mine.id, owner, square }, [owner])
    this.settle()
    return 'placed'
  }

  private revealMine(mine: MineState): void {
    mine.revealed = true
    this.emit({ type: 'mineRevealed', mineId: mine.id, owner: mine.owner, square: mine.square }, this.seatsSeeingSquare(mine.square, mine.owner))
  }

  // ---------------------------------------------------------------- creation, areas, revives

  createUnit(type: 'noAcb', owner: Seat, anchor: Square, createdBy: UnitCore | null): UnitCore | null {
    if (this.isOver()) return null
    const footprint = footprintSquares(anchor, 1)
    if (footprint.some((s) => !isOpenGround(this.state, s) || this.unitAt(s) !== undefined)) return null
    const unit = newUnit(this.state, type, owner, anchor, 1, createdBy?.id ?? null)
    this.state.units.push(unit)
    unit.toughness = this.stats(unit).baseToughness
    this.invalidate()
    // A seat that sees the dummy but not its Artificer learns of the dummy only (4.8, A4-12).
    const audience = this.seatsSeeing(unit)
    const told = createdBy === null ? [] : audience.filter((s) => this.canSee(s, createdBy))
    const body = { type: 'unitCreated' as const, unitId: unit.id, unitType: type, owner, anchor }
    this.emit({ ...body, createdBy: createdBy?.id ?? null }, told)
    this.emit({ ...body, createdBy: null }, audience.filter((s) => !told.includes(s)))
    this.triggerMines(unit, footprint) // A8-16: "a unit created on it"
    this.settle() // R1 reveals but no Assault (ROG-4); aura gains apply
    return this.stateUnit(unit.id) ?? null
  }

  createArea(spec: AreaSpec): AreaCore {
    const ownTurn = this.ownTurn(spec.owner)
    const area = {
      id: drawId(this.state, 'a'),
      abilityId: spec.abilityId,
      owner: spec.owner,
      sourceId: spec.source?.id ?? null,
      squares: spec.squares.map((s) => ({ x: s.x, y: s.y })),
      createdOnOwnTurn: ownTurn,
      expiresAtOwnTurn: ownTurn + spec.durationOwnTurns,
      seq: drawSeq(this.state),
      data: { ...spec.data },
    }
    this.state.areas.push(area)
    const body = { type: 'areaCreated' as const, areaId: area.id, abilityId: area.abilityId, owner: area.owner, expiresAtOwnTurn: area.expiresAtOwnTurn }
    this.emit({ ...body, squares: area.squares }, [area.owner])
    const other = opponentOf(area.owner)
    const seen = area.squares.filter((s) => this.seesSquare(other, s)) // A4-13
    if (seen.length > 0) this.emit({ ...body, squares: seen }, [other])
    return area
  }

  revive(unitId: UnitId, toughness: number, anchor?: Square): UnitCore | null {
    const index = this.state.fallen.findIndex((f) => f.unit.id === unitId)
    const fallen = this.state.fallen[index]
    if (fallen === undefined || this.isOver()) return null
    const unit = fallen.unit
    if (unit.type === 'commander' || unit.anchor === null) return null // A7-04
    const at = anchor ?? unit.anchor
    if (footprintSquares(at, this.sizeOf(unit)).some((s) => !isOpenGround(this.state, s) || this.unitAt(s) !== undefined)) return null
    this.state.fallen.splice(index, 1)
    unit.anchor = { x: at.x, y: at.y }
    unit.toughness = Math.max(1, toughness)
    unit.defending = false
    unit.stealthed = false
    unit.auraToughness = 0
    const position = this.state.units.findIndex((u) => u.seq > unit.seq)
    if (position < 0) this.state.units.push(unit)
    else this.state.units.splice(position, 0, unit)
    this.invalidate()
    this.emit({ type: 'unitRevived', unitId: unit.id, anchor: unit.anchor, toughness: unit.toughness }, this.seatsSeeing(unit))
    this.triggerMines(unit, this.footprint(unit)) // a return onto an unseen mine sets it off
    this.settle()
    return this.stateUnit(unit.id) ?? null
  }

  exhaust(target: UnitCore): void {
    const unit = this.stateUnit(target.id)
    if (unit === undefined) return
    unit.turn.actionsUsed = Math.max(unit.turn.actionsUsed, this.stats(unit).actionAllowance)
    unit.turn.moves = Math.max(unit.turn.moves, 1)
  }

  chargeAp(seat: Seat, amount: number): boolean {
    if (amount <= 0) return true
    if (this.activeSeat === seat) {
      if (this.state.seats[seat].ap < amount) return false
      this.spendAp(seat, amount)
      return true
    }
    this.state.seats[seat].apDebt += amount
    return true
  }

  // ---------------------------------------------------------------- hidden information (4.3-4.6)

  setStealthed(target: UnitCore, stealthed: boolean): void {
    const unit = this.stateUnit(target.id)
    if (unit === undefined || unit.stealthed === stealthed) return
    if (!stealthed) {
      this.reveal(unit, 'detection', null)
      return
    }
    unit.stealthed = true
    this.invalidate()
    this.emit({ type: 'stealthChanged', unitId: unit.id, stealthed: true }, [unit.owner])
    this.settle()
  }

  /** A4-10: the owner is always told; the revealer only if the owner can see it. Revealed stays revealed until Stealth is used again (A4-09). */
  reveal(target: UnitCore, cause: RevealCause, by: UnitCore | null): void {
    const unit = this.stateUnit(target.id)
    if (unit === undefined || !unit.stealthed) return
    unit.stealthed = false
    this.invalidate()
    const byVisible = by !== null && this.canSee(unit.owner, by)
    this.emit({ type: 'unitRevealed', unitId: unit.id, cause, byId: byVisible ? by.id : null }, [unit.owner])
    const other = opponentOf(unit.owner)
    if (this.canSee(other, unit)) this.emit({ type: 'unitRevealed', unitId: unit.id, cause, byId: by?.id ?? null }, [other])
  }

  /**
   * State-based checks after every step, placement, creation, death and revive (A3-11, A4-06, A4-08):
   * toughness auras, then R1 adjacency and R3 detection reveals, then mine detection.
   */
  settle(): void {
    if (this.isOver()) return
    const dead: DeathRecord[] = []
    for (const unit of [...this.state.units]) {
      syncAuraToughness(this, unit)
      if (unit.toughness <= 0 && unit.anchor !== null) dead.push({ unit, cause: 'auraLoss' })
    }
    if (dead.length > 0) {
      this.resolveDeaths(dead, false)
      return
    }
    for (const unit of this.state.units) {
      if (!unit.stealthed || unit.anchor === null) continue
      const enemy = opponentOf(unit.owner)
      const adjacent = this.units().find((u) => u.owner === enemy && this.isAdjacent(u, unit))
      if (adjacent !== undefined) {
        this.reveal(unit, 'adjacency', adjacent)
        continue
      }
      const detector = detectorOf(this, enemy, this.footprint(unit))
      if (detector !== undefined) this.reveal(unit, 'detection', detector)
    }
    if (!MINDS_EYE_REVEALS_MINES) return
    for (const mine of this.state.mines) {
      if (!mine.revealed && detectorOf(this, opponentOf(mine.owner), [mine.square]) !== undefined) this.revealMine(mine)
    }
  }

  // ---------------------------------------------------------------- decisions and small state

  requestDecision(request: DecisionRequest): void {
    const other = opponentOf(request.seat)
    const subjectVisible = request.subject !== undefined && this.canSee(other, request.subject)
    const decision = {
      id: drawId(this.state, 'd'),
      seat: request.seat,
      abilityId: request.abilityId,
      holderId: request.holder?.id ?? null,
      kind: request.kind,
      prompt: request.prompt,
      options: request.options.map((o) => ({ id: o.id, label: o.label })),
      defaultOption: request.defaultOption,
      alwaysOption: request.alwaysOption ?? null,
      preferenceKey: request.preferenceKey ?? null,
      timeoutSeconds: request.timeoutSeconds ?? REACTION_PROMPT_TIMEOUT_S,
      publicTo: subjectVisible ? [request.seat, other] : [request.seat],
      data: { ...request.data },
    }
    this.state.decisions.push(decision)
    this.emit({ type: 'decisionRequested', decisionId: decision.id, seat: decision.seat, kind: decision.kind }, decision.publicTo)
  }

  setTurnFlag(target: UnitCore, key: string, value: number): void {
    const unit = this.stateUnit(target.id)
    if (unit !== undefined) unit.turn.flags[key] = value
  }

  setMemory(target: UnitCore, key: string, value: number): void {
    const unit = this.stateUnit(target.id) ?? this.state.fallen.find((f) => f.unit.id === target.id)?.unit
    if (unit !== undefined) unit.memory[key] = value
  }

  memory(target: UnitCore, key: string): number {
    const unit = this.stateUnit(target.id) ?? this.state.fallen.find((f) => f.unit.id === target.id)?.unit
    return unit?.memory[key] ?? 0
  }

  setSeatCounter(seat: Seat, key: string, value: number): void {
    this.state.seats[seat].counters[key] = value
  }

  setTurnCounter(seat: Seat, key: string, value: number): void {
    this.state.seats[seat].turnCounters[key] = value
  }

  fallenUnit(id: UnitId): UnitCore | undefined {
    return this.state.fallen.find((f) => f.unit.id === id)?.unit
  }
}
