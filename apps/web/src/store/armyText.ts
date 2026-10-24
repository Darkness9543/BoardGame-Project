// Army import/export as plain text (PX AB-03), readable enough to paste into a chat and edit by hand:
//
//   Coin Duel army
//   name: Shield Wall
//   faction: empire
//   commander: trill
//   units: footman 20, soldier 15, paladin 5
//
// Names or ids are accepted for factions, commanders and units; a pasted JSON ArmyList works too.

import { COMMANDERS, FACTIONS, ROSTER, commanderDef, type ArmyList, type CommanderId, type FactionId, type RosterUnitId } from '@coinduel/engine'
import { parseArmyList } from './armies'

export const ARMY_TEXT_HEADER = 'Coin Duel army'

export type ArmyTextResult =
  | { readonly ok: true; readonly name: string | null; readonly army: ArmyList }
  | { readonly ok: false; readonly error: string }

export function armyToText(name: string, army: ArmyList): string {
  const units = ROSTER.filter((u) => (army.units[u.id as RosterUnitId] ?? 0) > 0)
    .map((u) => `${u.id} ${army.units[u.id as RosterUnitId] ?? 0}`)
    .join(', ')
  const lines = [ARMY_TEXT_HEADER, `name: ${name}`, `faction: ${army.faction}`, `commander: ${army.commander}`]
  if (army.variant !== undefined) lines.push(`variant: ${army.variant}`)
  lines.push(`units: ${units.length > 0 ? units : 'none'}`)
  return lines.join('\n')
}

const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function findFaction(value: string): FactionId | null {
  const key = squash(value)
  return FACTIONS.find((f) => squash(f.id) === key || squash(f.name) === key || squash(f.name).endsWith(key))?.id ?? null
}

function findCommander(value: string): CommanderId | null {
  const key = squash(value)
  return COMMANDERS.find((c) => c.selectable && (squash(c.id) === key || squash(c.name) === key))?.id ?? null
}

function findUnit(value: string): RosterUnitId | null {
  const key = squash(value)
  const def = ROSTER.find((u) => squash(u.id) === key || squash(u.name) === key)
  return def === undefined ? null : (def.id as RosterUnitId)
}

function parseUnits(text: string): Partial<Record<RosterUnitId, number>> | string {
  const units: Partial<Record<RosterUnitId, number>> = {}
  if (squash(text) === 'none' || text.trim() === '') return units
  for (const part of text.split(/[,;\n]/)) {
    const item = part.trim()
    if (item === '') continue
    const match = /^(.*?)[\s:x*×=]+(\d+)$/i.exec(item) ?? /^(\d+)[\s:x*×]+(.*)$/i.exec(item)
    if (match === null) return `Can't read "${item}" (write it as "footman 10")`
    const [nameText, countText] = /^\d+$/.test(match[1] ?? '') ? [match[2] ?? '', match[1] ?? ''] : [match[1] ?? '', match[2] ?? '']
    const type = findUnit(nameText)
    if (type === null) return `Unknown unit "${nameText.trim()}"`
    units[type] = (units[type] ?? 0) + Number(countText)
  }
  return units
}

export function parseArmyText(text: string): ArmyTextResult {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: false, error: 'Paste an army first' }
  if (trimmed.startsWith('{')) {
    try {
      const army = parseArmyList(JSON.parse(trimmed))
      return army === null ? { ok: false, error: 'That JSON is not an army' } : { ok: true, name: null, army }
    } catch {
      return { ok: false, error: 'That JSON could not be read' }
    }
  }
  const fields = new Map<string, string>()
  for (const line of trimmed.split(/\r?\n/)) {
    const match = /^\s*([a-z]+)\s*:\s*(.*)$/i.exec(line)
    if (match !== null) fields.set((match[1] ?? '').toLowerCase(), (match[2] ?? '').trim())
  }
  const factionText = fields.get('faction')
  const commanderText = fields.get('commander')
  if (factionText === undefined) return { ok: false, error: 'Missing "faction:" line' }
  if (commanderText === undefined) return { ok: false, error: 'Missing "commander:" line' }
  const faction = findFaction(factionText)
  if (faction === null) return { ok: false, error: `Unknown faction "${factionText}"` }
  const commander = findCommander(commanderText)
  if (commander === null) return { ok: false, error: `Unknown commander "${commanderText}"` }
  const units = parseUnits(fields.get('units') ?? '')
  if (typeof units === 'string') return { ok: false, error: units }
  const variantText = fields.get('variant')
  const variant = variantText === undefined ? undefined : commanderDef(commander).variants.find((v) => squash(v.id) === squash(variantText) || squash(v.name) === squash(variantText))
  if (variantText !== undefined && variantText !== '' && variant === undefined) return { ok: false, error: `Unknown variant "${variantText}"` }
  const army: ArmyList = variant !== undefined ? { faction, commander, variant: variant.id, units } : { faction, commander, units }
  const name = fields.get('name')
  return { ok: true, name: name !== undefined && name !== '' ? name : null, army }
}
