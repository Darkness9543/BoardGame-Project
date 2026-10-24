// Achievements (PX section 9, A13-03): the 15 of 9.1, tracked locally from this seat's own event stream and
// view, so they can never use hidden information. Progress inside a match is scratch state that a take-back
// rolls back (TB-8); it is committed when the match ends (AC-03: unlocks are shown on the result screen).

import { create } from 'zustand'
import {
  COMMANDERS,
  ROSTER_IDS,
  armyCost,
  tierFor,
  type ArmyList,
  type CommanderId,
  type DamageStep,
  type GameResult,
  type PlayerView,
  type RosterUnitId,
  type Seat,
  type Tier,
  type UnitId,
  type VisibleEvent,
} from '@coinduel/engine'
import { parseArmyList } from './armies'
import { appStore, isRecord, numberOr, readJson, STORAGE_PREFIX, writeJson, type KeyValueStore } from './storage'

export type AchievementId =
  | 'ACH-01'
  | 'ACH-02'
  | 'ACH-03'
  | 'ACH-04'
  | 'ACH-05'
  | 'ACH-06'
  | 'ACH-07'
  | 'ACH-08'
  | 'ACH-09'
  | 'ACH-10'
  | 'ACH-11'
  | 'ACH-12'
  | 'ACH-13'
  | 'ACH-14'
  | 'ACH-15'

export interface AchievementDef {
  readonly id: AchievementId
  readonly name: string
  readonly description: string
  readonly set: 'core' | 'extended'
  /** Counter target for a progress bar, or null for a one-off. */
  readonly target: number | null
}

/** AC-01: win-based achievements need at least this many full rounds, so instant resignations can't farm them. */
export const MIN_ROUNDS_FOR_WINS = 3
export const KEEP_STREAK_TARGET = 5
export const SHIELD_WALL_TARGET = 50
export const FAIR_PLAY_TARGET = 5
const SMALL_CHANGE_TIERS: readonly Tier[] = [1, 2, 5]
const SELECTABLE_COMMANDERS: readonly CommanderId[] = COMMANDERS.filter((c) => c.selectable).map((c) => c.id)

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'ACH-01', name: 'First Coin', description: 'Finish your first match, any result.', set: 'core', target: null },
  { id: 'ACH-02', name: 'Regicide', description: 'Win by defeating the enemy commander.', set: 'core', target: null },
  { id: 'ACH-03', name: 'Across the Line', description: 'Win by bringing your commander to the far row.', set: 'core', target: null },
  { id: 'ACH-04', name: 'Small Change', description: 'Win with an army made only of tier 1, 2 and 5 units (at least one unit).', set: 'core', target: null },
  { id: 'ACH-05', name: 'Exact Change', description: 'Win with an army that spends exactly the whole budget.', set: 'core', target: null },
  { id: 'ACH-06', name: 'Untouchable', description: 'Win without your commander losing any toughness.', set: 'core', target: null },
  { id: 'ACH-07', name: 'King of the Hill', description: `Hold the Keep at the end of ${KEEP_STREAK_TARGET} of your turns in a row, in one match.`, set: 'core', target: KEEP_STREAK_TARGET },
  { id: 'ACH-08', name: 'Monopoly', description: 'Own the Keep and the Market at the same time.', set: 'core', target: null },
  { id: 'ACH-09', name: 'Watch Your Step', description: 'An enemy unit is defeated by one of your Trip Mines.', set: 'core', target: null },
  { id: 'ACH-10', name: 'Shield Wall', description: `Line Formation prevents ${SHIELD_WALL_TARGET} damage in total, across all matches.`, set: 'core', target: SHIELD_WALL_TARGET },
  { id: 'ACH-11', name: 'From the Shadows', description: "A Rogue's Assault defeats an enemy during your opponent's turn.", set: 'extended', target: null },
  { id: 'ACH-12', name: 'David and Goliath', description: "A tier-1 unit's attack defeats a tier-100 unit.", set: 'extended', target: null },
  { id: 'ACH-13', name: 'Fair Play', description: `Accept ${FAIR_PLAY_TARGET} take-back requests from opponents.`, set: 'extended', target: FAIR_PLAY_TARGET },
  { id: 'ACH-14', name: 'Numismatist', description: `Field each of the ${ROSTER_IDS.length} units in at least one completed match.`, set: 'extended', target: ROSTER_IDS.length },
  { id: 'ACH-15', name: 'Hall of Commanders', description: `Win at least once with each of the ${SELECTABLE_COMMANDERS.length} commanders.`, set: 'extended', target: SELECTABLE_COMMANDERS.length },
]

// ---------------------------------------------------------------- stored progress

export interface ProfileStats {
  readonly matchesCompleted: number
  readonly wins: number
  readonly losses: number
  readonly draws: number
  readonly winsByCommander: Readonly<Partial<Record<CommanderId, number>>>
  readonly unitsFielded: readonly RosterUnitId[]
  readonly lineFormationPrevented: number
  readonly takebacksAccepted: number
  readonly bestKeepStreak: number
  readonly longestMatchRounds: number
}

export interface AchievementsState {
  readonly stats: ProfileStats
  /** Unlock time (epoch ms) per achievement. */
  readonly unlocked: Readonly<Partial<Record<AchievementId, number>>>
}

export const EMPTY_ACHIEVEMENTS: AchievementsState = {
  stats: {
    matchesCompleted: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winsByCommander: {},
    unitsFielded: [],
    lineFormationPrevented: 0,
    takebacksAccepted: 0,
    bestKeepStreak: 0,
    longestMatchRounds: 0,
  },
  unlocked: {},
}

// ---------------------------------------------------------------- per-match scratch

export interface MatchScratch {
  readonly seat: Seat
  /** AC-01: sandbox games never count. */
  readonly counts: boolean
  readonly army: ArmyList | null
  readonly budget: number
  readonly myUnits: readonly UnitId[]
  readonly commanderId: UnitId | null
  readonly activeSeat: Seat | null
  readonly commanderHurt: boolean
  readonly keepStreak: number
  readonly bestKeepStreak: number
  readonly monopoly: boolean
  readonly mineKill: boolean
  readonly assaultKill: boolean
  readonly davidAndGoliath: boolean
  readonly lineFormationPrevented: number
  readonly takebacksAccepted: number
  /** Snapshots before each update that carried an action, for take-backs. */
  readonly history: readonly Omit<MatchScratch, 'history'>[]
}

export function startScratch(seat: Seat, counts: boolean): MatchScratch {
  return {
    seat,
    counts,
    army: null,
    budget: 0,
    myUnits: [],
    commanderId: null,
    activeSeat: null,
    commanderHurt: false,
    keepStreak: 0,
    bestKeepStreak: 0,
    monopoly: false,
    mineKill: false,
    assaultKill: false,
    davidAndGoliath: false,
    lineFormationPrevented: 0,
    takebacksAccepted: 0,
    history: [],
  }
}

const ACTION_EVENTS: ReadonlySet<VisibleEvent['type']> = new Set(['unitMoved', 'unitAttacked', 'abilityUsed', 'defendChanged', 'turnEnded', 'attackMissed'])

/** ACH-10: what Line Formation really kept off one hit: its reduction, less what the floor of 1 gave back (A3-05). */
export function lineFormationPrevented(breakdown: readonly DamageStep[]): number {
  const formation = breakdown.find((s) => s.step === 'reduction' && s.source === 'footman.lineFormation')
  if (formation === undefined || formation.delta >= 0) return 0
  const reductions = breakdown.filter((s) => s.step === 'reduction')
  const before = breakdown[breakdown.findIndex((s) => s.step === 'reduction') - 1]?.total ?? 0
  const after = reductions[reductions.length - 1]?.total ?? before
  return Math.max(0, Math.min(-formation.delta, before - after))
}

/** Folds one update (the view after it and its events) into the match scratch. */
export function trackUpdate(scratch: MatchScratch, view: PlayerView, events: readonly VisibleEvent[]): MatchScratch {
  const { history: previousHistory, ...plain } = scratch
  let s: Omit<MatchScratch, 'history'> = plain
  let history = previousHistory
  if (events.some((e) => e.type === 'takebackApplied') && history.length > 0) {
    s = history[history.length - 1] ?? s
    history = history.slice(0, -1)
  } else if (events.some((e) => ACTION_EVENTS.has(e.type))) {
    history = [...history, s].slice(-40)
  }
  const me = s.seat
  const mine = new Set([...s.myUnits, ...view.units.filter((u) => u.owner === me).map((u) => u.id), ...view.fallen.filter((u) => u.owner === me).map((u) => u.id)])
  const commanderId = s.commanderId ?? view.units.find((u) => u.owner === me && u.isCommander)?.id ?? null
  const tierOfMine = new Map(view.units.filter((u) => u.owner === me).map((u) => [u.id, u.tier]))
  const enemyCommander = view.commanders[me === 'host' ? 'guest' : 'host']
  let active = s.activeSeat ?? view.turn?.activeSeat ?? null
  let commanderHurt = s.commanderHurt
  let lineFormation = s.lineFormationPrevented
  let takebacks = s.takebacksAccepted
  let mineKill = s.mineKill
  let assaultKill = s.assaultKill
  let david = s.davidAndGoliath
  let endedMyTurn = false
  /** One of my mines went off on a unit this seat can't name (4.8); its damage event, right after, names it if seen. */
  let unnamedMineHit = false
  const mineVictims = new Set<UnitId>()
  const assaultVictims = new Set<UnitId>()
  const smallAttackVictims = new Set<UnitId>()

  for (const e of events) {
    switch (e.type) {
      case 'turnStarted':
        active = e.seat
        break
      case 'turnEnded':
        if (e.seat === me) endedMyTurn = true
        break
      case 'unitDamaged': {
        if (e.unitId === commanderId && e.amount > 0) commanderHurt = true
        if (unnamedMineHit && e.kind === 'mine') mineVictims.add(e.unitId)
        unnamedMineHit = false
        if (mine.has(e.unitId)) {
          lineFormation += lineFormationPrevented(e.breakdown)
        } else if (e.dealerId !== null && mine.has(e.dealerId)) {
          if (e.source === 'rogue.assault' && active !== me) assaultVictims.add(e.unitId)
          if (e.kind === 'attack' && tierOfMine.get(e.dealerId) === 1) smallAttackVictims.add(e.unitId)
        }
        break
      }
      case 'toughnessLost':
        if (e.unitId === commanderId && e.amount > 0) commanderHurt = true
        break
      case 'mineExploded':
        if (e.owner !== me) break
        if (e.victimId !== null) mineVictims.add(e.victimId)
        else unnamedMineHit = e.trigger === 'entered'
        break
      case 'unitDied':
        if (e.owner === me) break
        if (mineVictims.has(e.unitId)) mineKill = true
        if (assaultVictims.has(e.unitId)) assaultKill = true
        if (smallAttackVictims.has(e.unitId) && tierFor(e.unitType, enemyCommander) === 100) david = true
        break
      case 'takebackApplied':
        if (e.seat !== me) takebacks += 1
        break
      default:
        break
    }
  }

  const keep = view.buildings.find((b) => b.kind === 'keep')
  const market = view.buildings.find((b) => b.kind === 'market')
  const keepStreak = endedMyTurn ? (keep?.controller === me ? s.keepStreak + 1 : 0) : s.keepStreak
  const army = view.myArmy ?? s.army
  return {
    ...s,
    army,
    budget: view.settings.budget,
    myUnits: [...mine],
    commanderId,
    activeSeat: active,
    commanderHurt,
    keepStreak,
    bestKeepStreak: Math.max(s.bestKeepStreak, keepStreak),
    monopoly: s.monopoly || (keep !== undefined && market !== undefined && keep.controller === me && market.controller === me),
    mineKill,
    assaultKill,
    davidAndGoliath: david,
    lineFormationPrevented: lineFormation,
    takebacksAccepted: takebacks,
    history,
  }
}

// ---------------------------------------------------------------- the scratch across a reload (NET-04 resume)

const scratchKey = (roomId: string, seat: Seat): string => `match-scratch.v1:${roomId}:${seat}`

const flag = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null)
const seatOrNull = (value: unknown): Seat | null => (value === 'host' || value === 'guest' ? value : null)

function parsePlain(raw: unknown, seat: Seat): Omit<MatchScratch, 'history'> | null {
  if (!isRecord(raw) || raw['seat'] !== seat) return null
  const myUnits = raw['myUnits']
  const army = raw['army'] === null ? null : parseArmyList(raw['army'])
  const flags = ['counts', 'commanderHurt', 'monopoly', 'mineKill', 'assaultKill', 'davidAndGoliath'].map((k) => flag(raw[k]))
  const counts = ['budget', 'keepStreak', 'bestKeepStreak', 'lineFormationPrevented', 'takebacksAccepted'].map((k) => count(raw[k]))
  const [counted, commanderHurt, monopoly, mineKill, assaultKill, davidAndGoliath] = flags
  const [budget, keepStreak, bestKeepStreak, lineFormation, takebacks] = counts
  if (flags.some((f) => f === null) || counts.some((c) => c === null) || !Array.isArray(myUnits) || (raw['army'] !== null && army === null)) return null
  const commanderId = raw['commanderId']
  return {
    seat,
    counts: counted === true,
    army,
    budget: budget ?? 0,
    myUnits: myUnits.filter((id): id is UnitId => typeof id === 'string'),
    commanderId: typeof commanderId === 'string' ? commanderId : null,
    activeSeat: seatOrNull(raw['activeSeat']),
    commanderHurt: commanderHurt === true,
    keepStreak: keepStreak ?? 0,
    bestKeepStreak: bestKeepStreak ?? 0,
    monopoly: monopoly === true,
    mineKill: mineKill === true,
    assaultKill: assaultKill === true,
    davidAndGoliath: davidAndGoliath === true,
    lineFormationPrevented: lineFormation ?? 0,
    takebacksAccepted: takebacks ?? 0,
  }
}

export function parseScratch(raw: unknown, seat: Seat): MatchScratch | null {
  const plain = parsePlain(raw, seat)
  if (plain === null || !isRecord(raw) || !Array.isArray(raw['history'])) return null
  const history = raw['history'].map((h) => parsePlain(h, seat))
  return history.every((h) => h !== null) ? { ...plain, history: history.filter((h) => h !== null) } : null
}

/** PX AC: a match's scratch survives a reload, so a resumed match can't forget that the commander was hurt. */
export function saveScratch(store: KeyValueStore, roomId: string, scratch: MatchScratch): void {
  writeJson(store, scratchKey(roomId, scratch.seat), scratch)
}

/** The saved scratch of this room's current match: its commander must be one this seat still knows (alive or fallen). */
export function loadScratch(store: KeyValueStore, roomId: string, view: PlayerView): MatchScratch | null {
  const saved = readJson(store, scratchKey(roomId, view.seat), (raw) => parseScratch(raw, view.seat), null)
  if (saved === null || saved.commanderId === null) return null
  return [...view.units, ...view.fallen].some((u) => u.id === saved.commanderId) ? saved : null
}

export function forgetScratch(store: KeyValueStore, roomId: string, seat: Seat): void {
  store.remove(STORAGE_PREFIX + scratchKey(roomId, seat))
}

/** A scratch started mid-match without a saved one: a commander already below its max was hurt (ACH-06). */
export function scratchFromView(seat: Seat, counts: boolean, view: PlayerView): MatchScratch {
  const scratch = trackUpdate(startScratch(seat, counts), view, [])
  const commander = view.units.find((u) => u.owner === seat && u.isCommander)
  const hurt = commander !== undefined && commander.toughness < commander.maxToughness
  return hurt ? { ...scratch, commanderHurt: true } : scratch
}

function smallChange(army: ArmyList | null): boolean {
  if (army === null) return false
  const fielded = ROSTER_IDS.filter((t) => (army.units[t] ?? 0) > 0)
  return fielded.length > 0 && fielded.every((t) => {
    const tier = tierFor(t, army.commander)
    return tier !== null && SMALL_CHANGE_TIERS.includes(tier)
  })
}

/** Commits a finished match: stats, then every achievement that is now met (returned for the result screen). */
export function finishMatch(state: AchievementsState, scratch: MatchScratch, result: GameResult, rounds: number, now: number): { state: AchievementsState; unlocked: AchievementId[] } {
  if (!scratch.counts) return { state, unlocked: [] }
  const me = scratch.seat
  const won = result.winner === me
  const lost = result.winner !== null && !won
  const commander = scratch.army?.commander ?? null
  const fielded = scratch.army === null ? [] : ROSTER_IDS.filter((t) => (scratch.army?.units[t] ?? 0) > 0)
  const s = state.stats
  const realWin = won && rounds >= MIN_ROUNDS_FOR_WINS
  // ACH-15 is win-based, so a quick resignation must not count either (AC-01); the plain win total still does.
  const winsByCommander = realWin && commander !== null ? { ...s.winsByCommander, [commander]: (s.winsByCommander[commander] ?? 0) + 1 } : s.winsByCommander
  const stats: ProfileStats = {
    matchesCompleted: s.matchesCompleted + 1,
    wins: s.wins + (won ? 1 : 0),
    losses: s.losses + (lost ? 1 : 0),
    draws: s.draws + (result.winner === null ? 1 : 0),
    winsByCommander,
    unitsFielded: [...new Set([...s.unitsFielded, ...fielded])],
    lineFormationPrevented: s.lineFormationPrevented + scratch.lineFormationPrevented,
    takebacksAccepted: s.takebacksAccepted + scratch.takebacksAccepted,
    bestKeepStreak: Math.max(s.bestKeepStreak, scratch.bestKeepStreak),
    longestMatchRounds: Math.max(s.longestMatchRounds, rounds),
  }
  const met: Readonly<Record<AchievementId, boolean>> = {
    'ACH-01': stats.matchesCompleted >= 1,
    'ACH-02': realWin && result.reason === 'conquest',
    'ACH-03': realWin && result.reason === 'domination',
    'ACH-04': realWin && smallChange(scratch.army),
    'ACH-05': realWin && scratch.army !== null && armyCost(scratch.army) === scratch.budget,
    'ACH-06': realWin && !scratch.commanderHurt,
    'ACH-07': scratch.bestKeepStreak >= KEEP_STREAK_TARGET,
    'ACH-08': scratch.monopoly,
    'ACH-09': scratch.mineKill,
    'ACH-10': stats.lineFormationPrevented >= SHIELD_WALL_TARGET,
    'ACH-11': scratch.assaultKill,
    'ACH-12': scratch.davidAndGoliath,
    'ACH-13': stats.takebacksAccepted >= FAIR_PLAY_TARGET,
    'ACH-14': ROSTER_IDS.every((t) => stats.unitsFielded.includes(t)),
    'ACH-15': SELECTABLE_COMMANDERS.every((c) => (stats.winsByCommander[c] ?? 0) > 0),
  }
  const unlocked = ACHIEVEMENTS.filter((a) => met[a.id] && state.unlocked[a.id] === undefined).map((a) => a.id)
  const stamp = { ...state.unlocked }
  for (const id of unlocked) stamp[id] = now
  return { state: { stats, unlocked: stamp }, unlocked }
}

/** Progress for the screen: the counter value next to its target. */
export function progressOf(state: AchievementsState, id: AchievementId): { readonly value: number; readonly target: number } | null {
  const s = state.stats
  switch (id) {
    case 'ACH-07':
      return { value: Math.min(s.bestKeepStreak, KEEP_STREAK_TARGET), target: KEEP_STREAK_TARGET }
    case 'ACH-10':
      return { value: Math.min(s.lineFormationPrevented, SHIELD_WALL_TARGET), target: SHIELD_WALL_TARGET }
    case 'ACH-13':
      return { value: Math.min(s.takebacksAccepted, FAIR_PLAY_TARGET), target: FAIR_PLAY_TARGET }
    case 'ACH-14':
      return { value: s.unitsFielded.filter((t) => ROSTER_IDS.includes(t)).length, target: ROSTER_IDS.length }
    case 'ACH-15':
      return { value: SELECTABLE_COMMANDERS.filter((c) => (s.winsByCommander[c] ?? 0) > 0).length, target: SELECTABLE_COMMANDERS.length }
    default:
      return null
  }
}

// ---------------------------------------------------------------- persistence and store

const KEY = 'achievements.v1'

export function parseAchievements(raw: unknown): AchievementsState {
  if (!isRecord(raw) || !isRecord(raw['stats'])) return EMPTY_ACHIEVEMENTS
  const st = raw['stats']
  const d = EMPTY_ACHIEVEMENTS.stats
  const wins = isRecord(st['winsByCommander']) ? st['winsByCommander'] : {}
  const winsByCommander: Partial<Record<CommanderId, number>> = {}
  for (const c of COMMANDERS) if (typeof wins[c.id] === 'number') winsByCommander[c.id] = wins[c.id] as number
  const fielded = Array.isArray(st['unitsFielded']) ? st['unitsFielded'].filter((t): t is RosterUnitId => typeof t === 'string' && (ROSTER_IDS as readonly string[]).includes(t)) : []
  const unlockedRaw = isRecord(raw['unlocked']) ? raw['unlocked'] : {}
  const unlocked: Partial<Record<AchievementId, number>> = {}
  for (const a of ACHIEVEMENTS) if (typeof unlockedRaw[a.id] === 'number') unlocked[a.id] = unlockedRaw[a.id] as number
  return {
    stats: {
      matchesCompleted: numberOr(st['matchesCompleted'], d.matchesCompleted),
      wins: numberOr(st['wins'], d.wins),
      losses: numberOr(st['losses'], d.losses),
      draws: numberOr(st['draws'], d.draws),
      winsByCommander,
      unitsFielded: fielded,
      lineFormationPrevented: numberOr(st['lineFormationPrevented'], 0),
      takebacksAccepted: numberOr(st['takebacksAccepted'], 0),
      bestKeepStreak: numberOr(st['bestKeepStreak'], 0),
      longestMatchRounds: numberOr(st['longestMatchRounds'], 0),
    },
    unlocked,
  }
}

export function loadAchievements(store: KeyValueStore = appStore()): AchievementsState {
  return readJson(store, KEY, parseAchievements, EMPTY_ACHIEVEMENTS)
}

interface AchievementsStore {
  readonly state: AchievementsState
  /** Achievements unlocked by the last finished match (for the result screen). */
  readonly recent: readonly AchievementId[]
  commit(scratch: MatchScratch, result: GameResult, rounds: number): readonly AchievementId[]
  reset(): void
}

export const useAchievements = create<AchievementsStore>()((set, get) => ({
  state: loadAchievements(),
  recent: [],
  commit(scratch, result, rounds) {
    const out = finishMatch(get().state, scratch, result, rounds, Date.now())
    writeJson(appStore(), KEY, out.state)
    set({ state: out.state, recent: out.unlocked })
    return out.unlocked
  },
  reset() {
    writeJson(appStore(), KEY, EMPTY_ACHIEVEMENTS)
    set({ state: EMPTY_ACHIEVEMENTS, recent: [] })
  },
}))
