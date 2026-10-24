// Telling copies apart (PX BT-18): own units are numbered per type in creation order, enemy units in the order
// this player first saw them. Ids are opaque, so the numbers are client memory and reveal nothing.

import { commanderDef, squareName, unitDef, type PlayerView, type Seat, type Square, type UnitId, type UnitTypeId, type VisibleEvent } from '@coinduel/engine'

export interface KnownUnit {
  readonly id: UnitId
  readonly type: UnitTypeId
  readonly owner: Seat
  readonly number: number
  readonly lastAnchor: Square | null
}

export interface UnitRegistry {
  readonly units: Readonly<Record<UnitId, KnownUnit>>
  readonly counters: Readonly<Record<string, number>>
}

export const EMPTY_REGISTRY: UnitRegistry = { units: {}, counters: {} }

function add(registry: { units: Record<UnitId, KnownUnit>; counters: Record<string, number> }, id: UnitId, type: UnitTypeId, owner: Seat, anchor: Square | null): void {
  const known = registry.units[id]
  if (known !== undefined) {
    if (anchor !== null) registry.units[id] = { ...known, lastAnchor: anchor }
    return
  }
  const key = `${owner}:${type}`
  const number = (registry.counters[key] ?? 0) + 1
  registry.counters[key] = number
  registry.units[id] = { id, type, owner, number, lastAnchor: anchor }
}

/** Learns every unit of a view and every unit an event names. */
export function learnUnits(registry: UnitRegistry, view: PlayerView, events: readonly VisibleEvent[] = []): UnitRegistry {
  const next = { units: { ...registry.units }, counters: { ...registry.counters } }
  for (const unit of [...view.units, ...view.fallen]) add(next, unit.id, unit.type, unit.owner, unit.anchor)
  for (const e of events) {
    if (e.type === 'unitCreated') add(next, e.unitId, e.unitType, e.owner, e.anchor)
    if (e.type === 'unitDied') add(next, e.unitId, e.unitType, e.owner, e.at)
    if (e.type === 'unitMoved') {
      const known = next.units[e.unitId]
      if (known !== undefined) next.units[e.unitId] = { ...known, lastAnchor: e.to }
    }
  }
  return next
}

export function typeName(type: UnitTypeId): string {
  return unitDef(type).name
}

/** "Footman 3", "Trill" (a commander goes by its name), "No-ACB 2"; "an unseen unit" when unknown. */
export function unitLabel(registry: UnitRegistry, view: PlayerView, id: UnitId | null): string {
  if (id === null) return 'an unseen unit'
  const known = registry.units[id]
  if (known === undefined) return 'an unseen unit'
  if (known.type === 'commander') {
    const commander = view.commanders[known.owner]
    return commander === null ? 'Commander' : commanderDef(commander).name
  }
  return `${typeName(known.type)} ${known.number}`
}

/** With the owner's adjective: "your Footman 3", "enemy Paladin 1". */
export function ownedLabel(registry: UnitRegistry, view: PlayerView, id: UnitId | null): string {
  const known = id === null ? undefined : registry.units[id]
  if (known === undefined) return 'an unseen unit'
  return `${known.owner === view.seat ? 'your' : 'enemy'} ${unitLabel(registry, view, id)}`
}

export function unitSquare(registry: UnitRegistry, id: UnitId | null): Square | null {
  return id === null ? null : (registry.units[id]?.lastAnchor ?? null)
}

export function labelWithSquare(registry: UnitRegistry, view: PlayerView, id: UnitId | null): string {
  const square = unitSquare(registry, id)
  return square === null ? ownedLabel(registry, view, id) : `${ownedLabel(registry, view, id)} (${squareName(square)})`
}

/** Labels start lowercase ("your Footman 3"); a sentence or a log line starts uppercase. */
export function sentence(text: string): string {
  return text.length === 0 ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}
