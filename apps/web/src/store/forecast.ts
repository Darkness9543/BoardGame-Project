// Damage forecasts (UX 9.2-9.5, PX BT-10): exact numbers from the engine's pipeline on the player's own view,
// marked "may differ" when fogged squares next to the target or the attacker could hide a modifier (9.4).

import {
  MINE_DAMAGE,
  MINE_LARGE_BONUS,
  MINE_LARGE_MIN_SIZE,
  abilityData,
  abilityParam,
  adjacentSquares,
  area3x3,
  computeHit,
  footprintSquares,
  hasAbilityData,
  isBabaWhite,
  isVisibleSquare,
  liveAbility,
  previewAttack,
  slamSplash,
  squaresWithin,
  woundShare,
  type AbilityTarget,
  type DamageStep,
  type PipelineResult,
  type PlayerView,
  type Square,
  type UnitId,
  type UnitView,
} from '@coinduel/engine'
import { unitAt, unitById, viewQuery } from './rules'

export interface ForecastRow {
  readonly label: string
  readonly delta: number
  readonly total: number
}

export interface HitForecast {
  readonly targetId: UnitId
  readonly amount: number
  readonly before: number
  readonly after: number
  readonly max: number
  readonly lethal: boolean
  /** A lethal hit on the enemy commander wins the game (conquest). */
  readonly wins: boolean
  /** One of my own units is hit (splash, R14). */
  readonly ally: boolean
  readonly rows: readonly ForecastRow[]
}

export interface Forecast {
  readonly title: string
  readonly hits: readonly HitForecast[]
  readonly heals: readonly { readonly targetId: UnitId; readonly amount: number; readonly after: number; readonly max: number }[]
  readonly uncertain: boolean
  readonly notes: readonly string[]
}

export function sourceName(source: string): string {
  if (source === 'base') return 'Base'
  if (source === 'attack') return 'Power'
  if (source === 'floor') return 'Minimum 1'
  if (source === 'defend') return 'Defending: half, rounded up'
  if (source === 'mine') return 'Trip Mine'
  return hasAbilityData(source) ? abilityData(source).name : source
}

function rowsOf(breakdown: readonly DamageStep[], baseLabel: string): ForecastRow[] {
  return breakdown.map((s) => ({ label: s.step === 'base' ? baseLabel : sourceName(s.source), delta: s.delta, total: s.total }))
}

function hitOf(view: PlayerView, target: UnitView, result: PipelineResult, baseLabel: string): HitForecast {
  const after = Math.max(0, target.toughness - result.amount)
  const lethal = result.amount >= target.toughness
  return {
    targetId: target.id,
    amount: result.amount,
    before: target.toughness,
    after,
    max: target.maxToughness,
    lethal,
    wins: lethal && target.isCommander && target.owner !== view.seat,
    ally: target.owner === view.seat,
    rows: rowsOf(result.breakdown, baseLabel),
  }
}

/** UX 9.4: modifiers that depend on adjacent units could hide in fogged neighbours; Hex Ward reaches further. */
function uncertainFor(view: PlayerView, attacker: UnitView | null, target: UnitView): boolean {
  const near = (unit: UnitView): Square[] => (unit.anchor === null ? [] : adjacentSquares(unit.anchor, unit.size, 'ORTHO_4'))
  const squares = [...near(target), ...(attacker === null ? [] : near(attacker))]
  if (squares.some((s) => !isVisibleSquare(view, s))) return true
  // R11 Hex Ward: own white units (R44: Lojrar Clan units) within range of Baba Yaga take 1 less damage; she may stand in the fog.
  const hexWard = view.commanderVariants[target.owner] === 'hex-ward' && isBabaWhite(target.type)
  if (hexWard && target.owner !== view.seat) {
    const babaVisible = view.units.some((u) => u.isCommander && u.owner === target.owner)
    return !babaVisible
  }
  return false
}

export function attackForecast(view: PlayerView, attackerId: UnitId, targetId: UnitId): Forecast | null {
  const attacker = unitById(view, attackerId)
  const target = unitById(view, targetId)
  const result = previewAttack(view, attackerId, targetId)
  if (attacker === undefined || target === undefined || result === null) return null
  return { title: 'Attack', hits: [hitOf(view, target, result, 'Power')], heals: [], uncertain: uncertainFor(view, attacker, target), notes: [] }
}

/** R26: the attack is made from the end square; Power auras there are not recomputed, so the number may differ. */
export function chargeForecast(view: PlayerView, attackerId: UnitId, path: readonly Square[], targetId: UnitId): Forecast | null {
  const end = path[path.length - 1]
  if (end === undefined) return null
  const moved: PlayerView = { ...view, units: view.units.map((u) => (u.id === attackerId ? { ...u, anchor: end } : u)) }
  const base = attackForecast(moved, attackerId, targetId)
  if (base === null) return null
  return { ...base, title: 'Charge', uncertain: true, notes: ['Auras around the end square are not counted until the unit arrives'] }
}

/** Squares an ability's splash would hit (Smite R25, Forceful slam A8-20), for previews and forecasts. */
export function splashSquares(view: PlayerView, unit: UnitView, abilityId: string, picks: readonly AbilityTarget[]): Square[] {
  const first = picks[0]
  switch (abilityId) {
    case 'emissary.smite': {
      const target = first?.kind === 'unit' ? unitById(view, first.unitId) : undefined
      return target?.anchor == null ? [] : adjacentSquares(target.anchor, target.size, 'ORTHO_4')
    }
    case 'beast.forcefulSlam':
      return first?.kind === 'square' && unit.anchor !== null ? slamSplash(unit.anchor, unit.size, first.square) : []
    default:
      return []
  }
}

function numberParam(abilityId: string, key: string): number | null {
  return hasAbilityData(abilityId) && abilityData(abilityId).params[key] !== undefined ? abilityParam(abilityId, key) : null
}

function abilityHit(view: PlayerView, unit: UnitView, target: UnitView, abilityId: string, base: number): HitForecast {
  const result = computeHit(viewQuery(view), { target, kind: 'ability', base, source: abilityId, dealer: unit })
  return hitOf(view, target, result, abilityData(abilityId).name)
}

/** A8-16: one known mine's hit on the unit entering it, through the pipeline (Reinforced Armor and the like). */
export function mineForecast(view: PlayerView, unit: UnitView): HitForecast {
  const base = MINE_DAMAGE + (unit.size >= MINE_LARGE_MIN_SIZE ? MINE_LARGE_BONUS : 0)
  return hitOf(view, unit, computeHit(viewQuery(view), { target: unit, kind: 'mine', base, source: 'mine', dealer: null }), sourceName('mine'))
}

/** The distinct units standing on any of these squares (a Size-2 unit once). */
function unitsOn(view: PlayerView, squares: readonly Square[]): UnitView[] {
  return squares.map((s) => unitAt(view, s)).filter((u, i, all): u is UnitView => u !== undefined && all.indexOf(u) === i)
}

/** A heal of `amount` on a unit, capped at its max toughness (A3-10). */
function healOf(u: UnitView, amount: number): Forecast['heals'][number] {
  return { targetId: u.id, amount: Math.max(0, Math.min(amount, u.maxToughness - u.toughness)), after: Math.min(u.maxToughness, u.toughness + amount), max: u.maxToughness }
}

/**
 * An area that ticks (Pajazon, A8-19): nothing happens at once. Own units inside regenerate at the end of your turns,
 * enemy units take a tick at the end of the opponent's turns, so nothing here is lethal and nothing wins.
 */
function areaForecast(view: PlayerView, abilityId: string, centre: Square): Forecast {
  const heal = numberParam(abilityId, 'heal') ?? 0
  const damage = numberParam(abilityId, 'damage') ?? 0
  const inside = unitsOn(view, area3x3(centre))
  const enemies = inside.filter((u) => u.owner !== view.seat).length
  return {
    title: abilityData(abilityId).name,
    hits: [],
    heals: inside.filter((u) => u.owner === view.seat).map((u) => healOf(u, heal)),
    uncertain: area3x3(centre).some((s) => !isVisibleSquare(view, s)),
    notes: [
      `Nothing happens at once. At the end of each of your turns, your units inside regenerate ${heal}`,
      `At the end of each of the opponent's turns, enemy units inside take ${damage} damage${enemies > 0 ? ` (${enemies} inside now)` : ''}`,
    ],
  }
}

/** Shared wounds (A8-09, R19): the donor loses half its toughness rounded up (a donor at 1 dies); the heal is capped (PRI-6). */
function sharedWoundsForecast(view: PlayerView, abilityId: string, donor: UnitView, recipient: UnitView): Forecast {
  const share = woundShare(donor.toughness)
  const heal = healOf(recipient, share)
  const loss: HitForecast = {
    targetId: donor.id,
    amount: share,
    before: donor.toughness,
    after: Math.max(0, donor.toughness - share),
    max: donor.maxToughness,
    lethal: share >= donor.toughness,
    wins: false,
    ally: donor.owner === view.seat,
    rows: [{ label: abilityData(abilityId).name, delta: share, total: share }],
  }
  return {
    title: abilityData(abilityId).name,
    hits: [loss],
    heals: [heal],
    uncertain: false,
    notes: share > heal.amount ? [`${share - heal.amount} of the ${share} toughness is wasted: the recipient is capped at its max`] : [],
  }
}

/**
 * Ability forecasts from the content table: a `damage` param on the picked unit or square, a `splash` on the
 * splash squares, Julio Vernification's sacrificed toughness (capped, R22), Shared wounds, ticking areas, and
 * `heal` abilities.
 */
export function abilityForecast(view: PlayerView, unitId: UnitId, abilityId: string, picks: readonly AbilityTarget[]): Forecast | null {
  const unit = unitById(view, unitId)
  if (unit === undefined || !hasAbilityData(abilityId)) return null
  const data = abilityData(abilityId)
  const hits: HitForecast[] = []
  const notes: string[] = []
  let uncertain = false
  const targetOf = (pick: AbilityTarget | undefined): UnitView | undefined =>
    pick?.kind === 'unit' ? unitById(view, pick.unitId) : pick?.kind === 'square' ? unitAt(view, pick.square) : undefined
  const first = picks[0]
  if (liveAbility(abilityId)?.active?.targets[0]?.kind === 'area3x3') return first?.kind === 'square' ? areaForecast(view, abilityId, first.square) : null
  if (abilityId === 'priestess.sharedWounds') {
    const donor = targetOf(picks[0])
    const recipient = targetOf(picks[1])
    return donor === undefined || recipient === undefined ? null : sharedWoundsForecast(view, abilityId, donor, recipient)
  }

  if (abilityId === 'juliomancer.julioVernification') {
    const fuel = targetOf(picks[0])
    const target = targetOf(picks[1])
    const cap = numberParam(abilityId, 'cap')
    if (fuel !== undefined && target !== undefined) {
      const base = cap === null ? fuel.toughness : Math.min(fuel.toughness, cap)
      hits.push(abilityHit(view, unit, target, abilityId, base))
      notes.push(`Sacrifices ${fuel.toughness} toughness worth of unit${cap !== null && fuel.toughness > cap ? ` (damage capped at ${cap})` : ''}`)
      uncertain = uncertainFor(view, unit, target)
    }
  } else {
    const damage = numberParam(abilityId, 'damage')
    const main = damage === null ? undefined : targetOf(picks.find((p) => p.kind !== 'squares'))
    if (damage !== null && main !== undefined) {
      hits.push(abilityHit(view, unit, main, abilityId, damage))
      uncertain = uncertainFor(view, unit, main)
    }
    const splash = numberParam(abilityId, 'splash')
    if (splash !== null) {
      const struck = new Set(hits.map((h) => h.targetId))
      for (const s of splashSquares(view, unit, abilityId, picks)) {
        const victim = unitAt(view, s)
        if (victim === undefined || struck.has(victim.id)) continue
        struck.add(victim.id)
        hits.push(abilityHit(view, unit, victim, abilityId, splash))
      }
      if (splashSquares(view, unit, abilityId, picks).some((s) => !isVisibleSquare(view, s))) uncertain = true
    }
  }
  const heal = numberParam(abilityId, 'heal')
  const range = numberParam(abilityId, 'range')
  const heals =
    heal !== null && range !== null && unit.anchor !== null && picks.length === 0
      ? unitsOn(view, squaresWithin(unit.anchor, unit.size, range))
          .filter((u) => u.owner === view.seat)
          .map((u) => healOf(u, heal))
      : []
  if (hits.length === 0 && heals.length === 0) return null
  hits.sort((a, b) => Number(b.lethal) - Number(a.lethal) || Number(b.ally) - Number(a.ally))
  return { title: data.name, hits, heals, uncertain, notes }
}

/** Squares of every unit a forecast touches (for chips on the board). */
export function forecastSquares(view: PlayerView, forecast: Forecast): Square[] {
  const ids = [...forecast.hits.map((h) => h.targetId), ...forecast.heals.map((h) => h.targetId)]
  return ids.flatMap((id) => {
    const unit = unitById(view, id)
    return unit?.anchor == null ? [] : footprintSquares(unit.anchor, unit.size).slice(0, 1)
  })
}
