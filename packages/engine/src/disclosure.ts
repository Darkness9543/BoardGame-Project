// What an action showed each seat, recorded as it resolves, for the take-back dialog (9 TB-4, TB-5) within the
// limits of 4.2 and 4.8: the decider is shown the action only as far as it saw it, and is told what the action
// revealed to the requester about its own side (units, mines set off or revealed, Assaults, prompts answered). Both
// are built from the events each seat was sent and its views before and after, so nothing the seat could not know
// gets in, and nothing it learned mid-action (a mine set off, a unit seen halfway) is missed.

import { liveAbility } from './abilities/registry'
import type { AbilityTarget, AttackTarget } from './abilities/types'
import type { ActionIntent, MarchDirection } from './commands'
import type { GameEvent, VisibleEvent } from './events'
import { opponentOf } from './state'
import type { ActionDisclosure, DisclosedMine, GameState, Seat, Square, UnitId } from './types'
import { filterEvents, isVisibleSquare, projectView, type PlayerView } from './view'

/** An action as one seat saw it: the acting unit only while that seat can see it now, and only the squares it saw. */
export type DisclosedAction =
  /** Nothing of it was visible to the seat (an unseen unit, or a secret ability such as Trip Mine or Stealth, 4.8). */
  | { readonly kind: 'unseen' }
  | { readonly kind: 'move'; readonly unitId: UnitId | null; readonly path: readonly Square[] }
  | { readonly kind: 'charge'; readonly unitId: UnitId | null; readonly path: readonly Square[]; readonly target: AttackTarget | null }
  | { readonly kind: 'attack'; readonly unitId: UnitId | null; readonly target: AttackTarget | null }
  | { readonly kind: 'defend'; readonly unitId: UnitId | null }
  | { readonly kind: 'useAbility'; readonly unitId: UnitId | null; readonly abilityId: string; readonly targets: readonly AbilityTarget[] }
  | { readonly kind: 'groupMarch'; readonly unitIds: readonly UnitId[]; readonly direction: MarchDirection }
  | { readonly kind: 'endTurn' }

export const UNSEEN: DisclosedAction = { kind: 'unseen' }

export const NO_DISCLOSURE: ActionDisclosure = { units: [], mines: [], assaults: 0, prompts: 0 }

/** Every unit id an event names (exhaustive, so a new event type has to be considered here). */
export function unitsNamed(e: VisibleEvent): UnitId[] {
  switch (e.type) {
    case 'unitPlaced':
    case 'unitUnplaced':
    case 'unitMoved':
    case 'moveEnded':
    case 'defendChanged':
    case 'unitHealed':
    case 'toughnessLost':
    case 'maxToughnessChanged':
    case 'unitDied':
    case 'unitRevived':
    case 'stealthChanged':
      return [e.unitId]
    case 'unitAttacked':
      return [e.attackerId, ...(e.target.kind === 'unit' ? [e.target.unitId] : [])]
    case 'attackMissed':
      return [e.attackerId]
    case 'abilityUsed':
      return [e.unitId, ...e.targets.flatMap((t) => (t.kind === 'unit' ? [t.unitId] : []))]
    case 'abilityNote':
      return e.unitId === null ? [] : [e.unitId]
    case 'unitDamaged':
      return [e.unitId, ...(e.dealerId === null ? [] : [e.dealerId])]
    case 'unitCreated':
      return [e.unitId, ...(e.createdBy === null ? [] : [e.createdBy])]
    case 'unitRevealed':
      return [e.unitId, ...(e.byId === null ? [] : [e.byId])]
    case 'mineExploded':
      return e.victimId === null ? [] : [e.victimId]
    case 'settingsChanged':
    case 'armyChosen':
    case 'readyChanged':
    case 'coinFlipped':
    case 'deploymentStarted':
    case 'deploymentConfirmed':
    case 'battleStarted':
    case 'turnStarted':
    case 'apChanged':
    case 'turnEnded':
    case 'minePlaced':
    case 'mineRevealed':
    case 'areaCreated':
    case 'areaExpired':
    case 'buildingCaptured':
    case 'buildingHeld':
    case 'buildingContested':
    case 'decisionRequested':
    case 'decisionResolved':
    case 'takebackRequested':
    case 'takebackDeclined':
    case 'takebackApplied':
    case 'drawOffered':
    case 'drawDeclined':
    case 'preferenceChanged':
    case 'gameEnded':
    case 'matchSummary':
      return []
  }
}

function ownerOf(states: readonly GameState[], id: UnitId): Seat | null {
  for (const state of states) {
    const unit = state.units.find((u) => u.id === id) ?? state.fallen.find((f) => f.unit.id === id)?.unit
    if (unit !== undefined) return unit.owner
  }
  return null
}

/** 9 TB-4 within 4.8: `intent` as `viewer` saw it, from its views around the action and the events it was sent. */
export function seenBy(intent: ActionIntent, before: GameState, after: GameState, events: readonly GameEvent[], viewer: Seat): DisclosedAction {
  const was = projectView(before, viewer)
  const now = projectView(after, viewer)
  const seen = filterEvents(events, viewer)
  const visibleNow = (id: UnitId): boolean => now.units.some((u) => u.id === id)
  const known = (id: UnitId): boolean => visibleNow(id) || was.units.some((u) => u.id === id) || seen.some((e) => unitsNamed(e).includes(id))
  const shown = (id: UnitId): UnitId | null => (visibleNow(id) ? id : null)
  const steps = (id: UnitId): Square[] => seen.flatMap((e) => (e.type === 'unitMoved' && e.unitId === id ? [e.to] : []))
  const attackOf = (id: UnitId): AttackTarget | null => {
    const event = seen.find((e) => e.type === 'unitAttacked' && e.attackerId === id)
    return event?.type === 'unitAttacked' ? event.target : null
  }
  switch (intent.kind) {
    case 'endTurn':
      return intent
    case 'groupMarch': {
      if (!intent.unitIds.some(known)) return UNSEEN
      return { kind: 'groupMarch', unitIds: intent.unitIds.filter(visibleNow), direction: intent.direction }
    }
    case 'move':
      return known(intent.unitId) ? { kind: 'move', unitId: shown(intent.unitId), path: steps(intent.unitId) } : UNSEEN
    case 'charge':
      return known(intent.unitId) ? { kind: 'charge', unitId: shown(intent.unitId), path: steps(intent.unitId), target: attackOf(intent.unitId) } : UNSEEN
    case 'attack':
      return known(intent.unitId) ? { kind: 'attack', unitId: shown(intent.unitId), target: attackOf(intent.unitId) } : UNSEEN
    case 'defend':
      return known(intent.unitId) ? { kind: 'defend', unitId: shown(intent.unitId) } : UNSEEN
    case 'useAbility': {
      const told = seen.some((e) => e.type === 'abilityUsed' && e.unitId === intent.unitId && e.abilityId === intent.abilityId)
      if (!told || liveAbility(intent.abilityId)?.active?.secret === true) return UNSEEN
      return { kind: 'useAbility', unitId: shown(intent.unitId), abilityId: intent.abilityId, targets: visibleTargets(intent.targets, was, now) }
    }
  }
}

/** Targets a seat may be shown: units it can see now (its own included), squares inside its vision. */
function visibleTargets(targets: readonly AbilityTarget[], was: PlayerView, now: PlayerView): AbilityTarget[] {
  const inSight = (s: Square): boolean => isVisibleSquare(was, s) || isVisibleSquare(now, s)
  return targets.flatMap((t): AbilityTarget[] => {
    switch (t.kind) {
      case 'unit':
        return now.units.some((u) => u.id === t.unitId) ? [t] : []
      case 'square':
        return inSight(t.square) ? [t] : []
      case 'squares': {
        const squares = t.squares.filter(inSight)
        return squares.length === 0 ? [] : [{ kind: 'squares', squares }]
      }
    }
  })
}

function addMine(mines: DisclosedMine[], mine: DisclosedMine): void {
  const index = mines.findIndex((m) => m.id === mine.id)
  const existing = mines[index]
  if (existing === undefined) mines.push(mine)
  else mines[index] = { ...existing, setOff: existing.setOff || mine.setOff }
}

/**
 * TB-5 / A9-03: what a step of resolution (the action, or a later answer to a prompt it caused) showed `actor` about
 * the other side that it did not see before, added to `previous`.
 */
export function disclose(previous: ActionDisclosure, before: GameState, after: GameState, events: readonly GameEvent[], actor: Seat): ActionDisclosure {
  const other = opponentOf(actor)
  const theirs = (id: UnitId): boolean => ownerOf([after, before], id) === other
  const was = projectView(before, actor)
  const now = projectView(after, actor)
  const named = new Set<UnitId>(now.units.map((u) => u.id))
  const mines = [...previous.mines]
  for (const e of filterEvents(events, actor)) {
    for (const id of unitsNamed(e)) named.add(id)
    if ((e.type === 'mineExploded' || e.type === 'mineRevealed') && e.owner === other) addMine(mines, { id: e.mineId, square: e.square, setOff: e.type === 'mineExploded' })
  }
  for (const m of now.mines) if (m.owner === other && !was.mines.some((w) => w.id === m.id)) addMine(mines, { id: m.id, square: m.square, setOff: false })
  const fresh = [...named].filter((id) => theirs(id) && !was.units.some((u) => u.id === id) && !previous.units.includes(id))
  const theirEvents = filterEvents(events, other)
  return {
    units: [...previous.units, ...fresh],
    mines,
    assaults: previous.assaults + theirEvents.filter((e) => e.type === 'unitAttacked' && e.source === 'rogue.assault' && theirs(e.attackerId)).length,
    prompts: previous.prompts + theirEvents.filter((e) => e.type === 'decisionResolved' && e.seat === other).length,
  }
}
