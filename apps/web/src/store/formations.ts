// Saved formations (PX DP-09): one per army composition and scenario, stored relative to the own edge so they
// work from either side of the board.

import { ROSTER_IDS, isRosterUnit, type ArmyList, type ScenarioId, type UnitTypeId } from '@coinduel/engine'
import type { FormationSlot } from './deploy'
import { appStore, isRecord, readJson, writeJson, type KeyValueStore } from './storage'

const KEY = 'formations.v1'

export function formationKey(army: ArmyList, scenarioId: ScenarioId): string {
  const units = ROSTER_IDS.filter((t) => (army.units[t] ?? 0) > 0).map((t) => `${t}${army.units[t] ?? 0}`)
  return [scenarioId, army.faction, army.commander, army.variant ?? '-', ...units].join('|')
}

function parseSlots(raw: unknown): FormationSlot[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((s) => {
    if (!isRecord(s) || typeof s['type'] !== 'string') return []
    const type = s['type']
    if (!isRosterUnit(type) && type !== 'commander') return []
    const nums = [s['ordinal'], s['column'], s['row']]
    if (!nums.every((n) => typeof n === 'number' && Number.isInteger(n))) return []
    return [{ type: type as UnitTypeId, ordinal: s['ordinal'] as number, column: s['column'] as number, row: s['row'] as number }]
  })
}

function parseAll(raw: unknown): Record<string, FormationSlot[]> {
  if (!isRecord(raw)) return {}
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, parseSlots(v)]))
}

export function loadFormation(key: string, store: KeyValueStore = appStore()): FormationSlot[] | null {
  return readJson(store, KEY, parseAll, {})[key] ?? null
}

export function saveFormation(key: string, slots: readonly FormationSlot[], store: KeyValueStore = appStore()): void {
  const all = readJson(store, KEY, parseAll, {})
  writeJson(store, KEY, { ...all, [key]: slots })
}
