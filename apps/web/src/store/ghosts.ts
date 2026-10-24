// Last-seen markers (A4-16, LAST_SEEN_MARKERS; UX 13.3): client memory of enemy units that left this seat's
// vision. They show only what the player saw, as a memory, never as live data, so they leak nothing. A unit seen
// walking into the fog is remembered on the last square it was seen stepping onto.

import { footprintSquares, isVisibleSquare, type PlayerView, type Seat, type Square, type Tier, type UnitId, type UnitTypeId, type VisibleEvent } from '@coinduel/engine'

export interface Ghost {
  readonly unitId: UnitId
  readonly type: UnitTypeId
  readonly owner: Seat
  readonly anchor: Square
  readonly size: 1 | 2
  readonly tier: Tier | null
  readonly isCommander: boolean
  readonly power: number
  readonly toughness: number
  readonly maxToughness: number
  /** Global turn number and round when it was last seen. */
  readonly seenTurn: number
  readonly seenRound: number
  /** It vanished while its square was in vision (Stealth): an empty-looking square doesn't clear it. */
  readonly vanished: boolean
}

export interface GhostMemory {
  readonly ghosts: readonly Ghost[]
  /** The ghosts before each update that carried an action, so a take-back can drop what it created (TB-8). */
  readonly history: readonly (readonly Ghost[])[]
}

export const EMPTY_GHOSTS: GhostMemory = { ghosts: [], history: [] }

/** A ghost of a unit that vanished in plain sight is kept this many rounds, then dropped. */
export const VANISHED_GHOST_ROUNDS = 2
const HISTORY_LIMIT = 40
const ACTION_EVENTS: ReadonlySet<VisibleEvent['type']> = new Set(['unitMoved', 'unitAttacked', 'abilityUsed', 'defendChanged', 'turnEnded', 'attackMissed'])

function squaresVisible(view: PlayerView, anchor: Square, size: 1 | 2): boolean {
  return footprintSquares(anchor, size).every((s) => isVisibleSquare(view, s))
}

export function updateGhosts(memory: GhostMemory, previous: PlayerView | null, next: PlayerView, events: readonly VisibleEvent[]): GhostMemory {
  if (next.phase !== 'battle') return memory.ghosts.length === 0 && memory.history.length === 0 ? memory : EMPTY_GHOSTS
  // TB-8: an accepted take-back drops the markers the undone action created. Units it revealed vanish because the
  // timeline was rewound, not because they walked into the fog, so they get no marker either.
  if (events.some((e) => e.type === 'takebackApplied')) {
    const restored = memory.history[memory.history.length - 1] ?? memory.ghosts
    const seen = new Set(next.units.map((u) => u.id))
    return { ghosts: restored.filter((g) => !seen.has(g.unitId) && !squaresVisible(next, g.anchor, g.size)), history: memory.history.slice(0, -1) }
  }
  let ghosts = memory.ghosts
  let history = memory.history
  if (events.some((e) => ACTION_EVENTS.has(e.type))) history = [...history, ghosts].slice(-HISTORY_LIMIT)
  const dead = new Set(events.flatMap((e) => (e.type === 'unitDied' ? [e.unitId] : [])))
  const lastStep = new Map(events.flatMap((e) => (e.type === 'unitMoved' ? [[e.unitId, e.to] as const] : [])))
  const seen = new Set(next.units.map((u) => u.id))
  const created: Ghost[] = []
  if (previous?.phase === 'battle') {
    for (const unit of previous.units) {
      if (unit.owner === next.seat || unit.anchor === null || seen.has(unit.id) || dead.has(unit.id)) continue
      const anchor = lastStep.get(unit.id) ?? unit.anchor
      created.push({
        unitId: unit.id,
        type: unit.type,
        owner: unit.owner,
        anchor,
        size: unit.size,
        tier: unit.tier,
        isCommander: unit.isCommander,
        power: unit.power,
        toughness: unit.toughness,
        maxToughness: unit.maxToughness,
        seenTurn: previous.turn?.number ?? 0,
        seenRound: previous.turn?.round ?? 0,
        vanished: !lastStep.has(unit.id) && squaresVisible(next, anchor, unit.size),
      })
    }
  }
  const round = next.turn?.round ?? 0
  const kept = ghosts.filter((g) => {
    if (seen.has(g.unitId) || dead.has(g.unitId) || created.some((c) => c.unitId === g.unitId)) return false
    if (g.vanished) return round - g.seenRound <= VANISHED_GHOST_ROUNDS
    return !squaresVisible(next, g.anchor, g.size)
  })
  const result = created.length === 0 && kept.length === ghosts.length ? ghosts : [...kept, ...created]
  return result === memory.ghosts && history === memory.history ? memory : { ghosts: result, history }
}

export function ghostAt(memory: GhostMemory, square: Square): Ghost | undefined {
  return memory.ghosts.find((g) => footprintSquares(g.anchor, g.size).some((s) => s.x === square.x && s.y === square.y))
}
