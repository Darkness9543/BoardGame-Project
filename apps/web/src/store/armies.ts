// Army compositions (PX S03/S04, A5-13): faction + commander (+ variant) + unit counts, named and stored locally.
// The engine's checkArmy is the only judge of legality; this module only keeps the records.

import { create } from 'zustand'
import {
  COMMANDERS,
  FACTIONS,
  RULES_VERSION,
  isCommanderId,
  isRosterUnit,
  type ArmyList,
  type CommanderId,
  type FactionId,
  type RosterUnitId,
} from '@coinduel/engine'
import { randomId } from './ids'
import { appStore, isRecord, numberOr, readJson, stringOr, writeJson, type KeyValueStore } from './storage'

export interface SavedArmy {
  readonly id: string
  readonly name: string
  readonly army: ArmyList
  /** The budget it was built for (AB-09); lobbies with another budget re-check it. */
  readonly budget: number
  /** Rules version it was built under (AB-17: re-validated on load). */
  readonly rulesVersion: number
  readonly createdAt: number
  readonly updatedAt: number
  readonly lastUsedAt: number | null
}

export const ARMY_NAME_MAX = 32
const KEY = 'armies.v1'

// ---------------------------------------------------------------- parsing

export function parseArmyList(raw: unknown): ArmyList | null {
  if (!isRecord(raw)) return null
  const faction = raw['faction']
  const commander = raw['commander']
  const units = raw['units']
  if (typeof faction !== 'string' || !FACTIONS.some((f) => f.id === faction)) return null
  if (typeof commander !== 'string' || !isCommanderId(commander)) return null
  if (!isRecord(units)) return null
  const counts: Partial<Record<RosterUnitId, number>> = {}
  for (const [type, count] of Object.entries(units)) {
    if (!isRosterUnit(type) || typeof count !== 'number' || !Number.isInteger(count) || count < 0) continue
    if (count > 0) counts[type] = count
  }
  const variant = raw['variant']
  const base = { faction: faction as FactionId, commander, units: counts }
  return typeof variant === 'string' ? { ...base, variant } : base
}

function parseSaved(raw: unknown): SavedArmy | null {
  if (!isRecord(raw) || typeof raw['id'] !== 'string') return null
  const army = parseArmyList(raw['army'])
  if (army === null) return null
  const lastUsed = raw['lastUsedAt']
  return {
    id: raw['id'],
    name: stringOr(raw['name'], 'Army').slice(0, ARMY_NAME_MAX),
    army,
    budget: numberOr(raw['budget'], 200),
    rulesVersion: numberOr(raw['rulesVersion'], 0),
    createdAt: numberOr(raw['createdAt'], 0),
    updatedAt: numberOr(raw['updatedAt'], 0),
    lastUsedAt: typeof lastUsed === 'number' ? lastUsed : null,
  }
}

export function parseSavedArmies(raw: unknown): SavedArmy[] {
  if (!Array.isArray(raw)) return []
  return raw.map(parseSaved).filter((a): a is SavedArmy => a !== null)
}

export function loadArmies(store: KeyValueStore = appStore()): SavedArmy[] {
  return readJson(store, KEY, parseSavedArmies, [])
}

export function saveArmies(list: readonly SavedArmy[], store: KeyValueStore = appStore()): void {
  writeJson(store, KEY, list)
}

// ---------------------------------------------------------------- pure list operations

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, ARMY_NAME_MAX)
}

/** AB-11: "<Commander> army N". */
export function defaultArmyName(commander: CommanderId, list: readonly SavedArmy[]): string {
  const base = `${COMMANDERS.find((c) => c.id === commander)?.name ?? 'New'} army`
  let n = 1
  while (list.some((a) => a.name === `${base} ${n}`)) n++
  return `${base} ${n}`
}

export function newSavedArmy(army: ArmyList, name: string, budget: number, now: number, id: string = randomId('army')): SavedArmy {
  return { id, name: cleanName(name) || 'Army', army, budget, rulesVersion: RULES_VERSION, createdAt: now, updatedAt: now, lastUsedAt: null }
}

export function upsertArmy(list: readonly SavedArmy[], entry: SavedArmy): SavedArmy[] {
  return list.some((a) => a.id === entry.id) ? list.map((a) => (a.id === entry.id ? entry : a)) : [entry, ...list]
}

export function updateArmy(list: readonly SavedArmy[], id: string, patch: { readonly army?: ArmyList; readonly name?: string; readonly budget?: number }, now: number): SavedArmy[] {
  return list.map((a) =>
    a.id !== id
      ? a
      : {
          ...a,
          army: patch.army ?? a.army,
          name: patch.name !== undefined ? cleanName(patch.name) || a.name : a.name,
          budget: patch.budget ?? a.budget,
          rulesVersion: RULES_VERSION,
          updatedAt: now,
        },
  )
}

export function duplicateArmy(list: readonly SavedArmy[], id: string, now: number, newId: string = randomId('army')): SavedArmy[] {
  const source = list.find((a) => a.id === id)
  if (source === undefined) return [...list]
  const copy: SavedArmy = { ...source, id: newId, name: cleanName(`${source.name} copy`), createdAt: now, updatedAt: now, lastUsedAt: null }
  const index = list.indexOf(source)
  return [...list.slice(0, index + 1), copy, ...list.slice(index + 1)]
}

export function deleteArmy(list: readonly SavedArmy[], id: string): SavedArmy[] {
  return list.filter((a) => a.id !== id)
}

export function markArmyUsed(list: readonly SavedArmy[], id: string, now: number): SavedArmy[] {
  return list.map((a) => (a.id === id ? { ...a, lastUsedAt: now } : a))
}

/** S03: sorted by last used, then last edited. */
export function sortArmies(list: readonly SavedArmy[]): SavedArmy[] {
  return [...list].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || b.updatedAt - a.updatedAt)
}

export function sameArmy(a: ArmyList, b: ArmyList): boolean {
  if (a.faction !== b.faction || a.commander !== b.commander || (a.variant ?? null) !== (b.variant ?? null)) return false
  const keys = new Set([...Object.keys(a.units), ...Object.keys(b.units)]) as Set<RosterUnitId>
  for (const k of keys) if ((a.units[k] ?? 0) !== (b.units[k] ?? 0)) return false
  return true
}

// ---------------------------------------------------------------- starter armies (AB-01: one per commander)

export interface StarterArmy {
  readonly id: string
  readonly name: string
  readonly blurb: string
  readonly army: ArmyList
}

export const STARTER_ARMIES: readonly StarterArmy[] = [
  {
    id: 'starter-trill',
    name: 'Shield Wall',
    blurb: 'Hardened Footmen and Soldiers behind a Paladin line.',
    army: { faction: 'empire', commander: 'trill', units: { footman: 20, soldier: 15, berserker: 6, priestess: 2, paladin: 5 } },
  },
  {
    id: 'starter-kulega',
    name: 'Fine Print Legion',
    blurb: 'Wide vision, Paladins that feed on fallen allies, one Royal Wizard.',
    army: { faction: 'empire', commander: 'kulega', units: { footman: 10, soldier: 10, berserker: 4, priestess: 2, paladin: 4, royalWizard: 1 } },
  },
  {
    id: 'starter-queso',
    name: 'Beacon Host',
    blurb: 'A Celestial Emissary at the heart of a healing column.',
    army: { faction: 'empire', commander: 'queso', units: { footman: 10, soldier: 10, berserker: 4, priestess: 3, paladin: 1, emissary: 1 } },
  },
  {
    id: 'starter-sabrina',
    name: 'Reel Workshop',
    blurb: 'Cheap Artificers and their dummies screen a Beast.',
    army: { faction: 'lojrar', commander: 'sabrina', units: { mercenary: 20, ranger: 10, rogue: 4, juliomancer: 2, artificer: 6, beast: 1 } },
  },
  {
    id: 'starter-babaYaga',
    name: 'Bwitch Swarm',
    blurb: 'Thirty Mercenaries mended by Baba Yaga, a Scourge for tribute.',
    army: { faction: 'lojrar', commander: 'babaYaga', variant: 'mend', units: { mercenary: 30, ranger: 10, rogue: 4, juliomancer: 1, artificer: 1, scourge: 1 } },
  },
  {
    id: 'starter-ratasius',
    name: "Rat King's Pack",
    blurb: 'Rogues in the dark, two Beasts to finish the job.',
    army: { faction: 'lojrar', commander: 'ratasius', units: { mercenary: 20, ranger: 10, rogue: 6, juliomancer: 3, beast: 2 } },
  },
]

// ---------------------------------------------------------------- store

interface ArmiesStore {
  readonly armies: readonly SavedArmy[]
  /** Creates or replaces; returns the stored entry. */
  save(entry: SavedArmy): SavedArmy
  update(id: string, patch: { readonly army?: ArmyList; readonly name?: string; readonly budget?: number }): void
  duplicate(id: string): void
  remove(id: string): SavedArmy | null
  markUsed(id: string): void
}

export const useArmies = create<ArmiesStore>()((set, get) => {
  const commit = (armies: SavedArmy[]): void => {
    saveArmies(armies)
    set({ armies })
  }
  return {
    armies: loadArmies(),
    save(entry) {
      commit(upsertArmy(get().armies, entry))
      return entry
    },
    update(id, patch) {
      commit(updateArmy(get().armies, id, patch, Date.now()))
    },
    duplicate(id) {
      commit(duplicateArmy(get().armies, id, Date.now()))
    },
    remove(id) {
      const removed = get().armies.find((a) => a.id === id) ?? null
      commit(deleteArmy(get().armies, id))
      return removed
    },
    markUsed(id) {
      commit(markArmyUsed(get().armies, id, Date.now()))
    },
  }
})
