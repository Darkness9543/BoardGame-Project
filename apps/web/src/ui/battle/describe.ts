// Words for the battle HUD: what an action did (take-back cards, TB-4), ability states (PX BT-15) and statuses.

import {
  APPROACH_BOOST,
  AP_BASE,
  AP_MAX,
  AP_PER_ROUND_INCREMENT,
  ESCALATION_FROM_ROUND,
  MARKET_AP_BONUS,
  SCOURGE_AP_BONUS,
  DUMMY_CAP,
  KEEP_POWER_BONUS,
  MARKET_TIERS,
  MINE_CAP,
  abilityData,
  footprintSquares,
  goalRowY,
  hasAbilityData,
  isBabaWhite,
  squareName,
  type ActionDisclosure,
  type AttackTarget,
  type DisclosedAction,
  type PlayerView,
  type UnitView,
} from '@coinduel/engine'
import { ownedLabel, type UnitRegistry } from '../../store/naming'

/** R1 + R28 + R31 + R25 in words, built from the constants. */
export function apCurveText(): string {
  return (
    `Round r gives ${AP_BASE} + ${AP_PER_ROUND_INCREMENT === 1 ? '' : `${AP_PER_ROUND_INCREMENT} × `}(r − 1) AP, up to ${AP_MAX}. Until the end of the round in which ` +
    `any unit first sees an enemy, the pool is ×${APPROACH_BOOST} (approach boost: ${AP_BASE * APPROACH_BOOST} in round 1). From round ${ESCALATION_FROM_ROUND} it grows again ` +
    `by ${AP_PER_ROUND_INCREMENT} per round. The Market adds ${MARKET_AP_BONUS} and a living Scourge ${SCOURGE_AP_BONUS}. Unspent AP is lost.`
  )
}

/**
 * A clause such as "Paladin 2 moved to L8" for a take-back request's action: the requester's own, or the decider's
 * view of it (9 TB-4), which names only what the decider saw ("a unit you can't see" when unknown).
 */
export function describeIntent(intent: DisclosedAction, registry: UnitRegistry, view: PlayerView): string {
  const who = (id: string | null): string => {
    if (id === null || registry.units[id] === undefined) return "a unit you can't see"
    return ownedLabel(registry, view, id).replace(/^your /, '').replace(/^enemy /, 'their ')
  }
  const target = (t: AttackTarget | null): string => (t === null ? '' : t.kind === 'unit' ? ownedLabel(registry, view, t.unitId) : squareName(t.square))
  switch (intent.kind) {
    case 'unseen':
      return 'an action you could not see'
    case 'move': {
      const end = intent.path[intent.path.length - 1]
      return `${who(intent.unitId)} moved${end === undefined ? '' : ` to ${squareName(end)}`}`
    }
    case 'attack':
      return intent.target === null ? `${who(intent.unitId)} attacked` : `${who(intent.unitId)} attacked ${target(intent.target)}`
    case 'defend':
      return `${who(intent.unitId)} defended`
    case 'charge': {
      const end = intent.path[intent.path.length - 1]
      return `${who(intent.unitId)} charged${end === undefined ? '' : ` to ${squareName(end)}`}${intent.target === null ? '' : ` and attacked ${target(intent.target)}`}`
    }
    case 'useAbility':
      return `${who(intent.unitId)} used ${hasAbilityData(intent.abilityId) ? abilityData(intent.abilityId).name : intent.abilityId}`
    case 'groupMarch': {
      const n = intent.unitIds.length
      return `${n === 0 ? "units you can't see" : `${n} unit${n === 1 ? '' : 's'}`} marched ${intent.direction}`
    }
    case 'endTurn':
      return 'the end of their turn'
  }
}


/**
 * TB-5: the decider's lines about what the action showed the requester ("It revealed your Soldier 3 at E9", "It set off
 * your mine at H9", "Your Rogue's Assault fired", "You answered a revive prompt").
 */
export function disclosureLines(disclosure: ActionDisclosure, registry: UnitRegistry, view: PlayerView): string[] {
  const lines: string[] = []
  const squares = (setOff: boolean): string[] => disclosure.mines.filter((m) => m.setOff === setOff).map((m) => squareName(m.square))
  const plural = (n: number, word: string): string => `${word}${n === 1 ? '' : 's'}`
  if (disclosure.units.length > 0) lines.push(`It revealed ${disclosure.units.map((id) => ownedLabel(registry, view, id)).join(', ')}`)
  const setOff = squares(true)
  if (setOff.length > 0) lines.push(`It set off your ${plural(setOff.length, 'mine')} at ${setOff.join(', ')}`)
  const shown = squares(false)
  if (shown.length > 0) lines.push(`It revealed your ${plural(shown.length, 'mine')} at ${shown.join(', ')}`)
  if (disclosure.assaults > 0) lines.push(disclosure.assaults === 1 ? "Your Rogue's Assault fired" : `Your Rogues' Assaults fired ${disclosure.assaults} times`)
  if (disclosure.prompts > 0) lines.push(disclosure.prompts === 1 ? 'You answered a reaction prompt' : `You answered ${disclosure.prompts} reaction prompts`)
  return lines
}

/** A live line under an own ability: cooldown, uses this turn (PX BT-15). */
export function abilityStatus(view: PlayerView, unit: UnitView, abilityId: string): string | null {
  const own = unit.own
  if (own === null || !hasAbilityData(abilityId)) return null
  const data = abilityData(abilityId)
  const cooldown = own.cooldowns[abilityId]
  const now = view.ownTurns[view.seat]
  if (cooldown !== undefined && now < cooldown.readyOnOwnTurn) {
    const wait = cooldown.readyOnOwnTurn - now
    return `On cooldown: ready on your turn ${cooldown.readyOnOwnTurn} (${wait === 1 ? 'next turn' : `in ${wait} turns`})`
  }
  const uses = own.turn.abilityUses[abilityId] ?? 0
  if (data.usesPerTurn !== null && uses > 0) return `Used ${uses}/${data.usesPerTurn} this turn`
  return data.kind === 'active' ? 'Ready' : null
}

export interface Status {
  readonly label: string
  readonly tone: 'good' | 'bad' | 'info'
  readonly title?: string
}

export function statusesOf(view: PlayerView, unit: UnitView): Status[] {
  const out: Status[] = []
  if (unit.defending) out.push({ label: 'Defending', tone: 'good', title: 'Incoming damage is halved, rounded up, until its next turn starts' })
  if (unit.stealthed) out.push({ label: 'Stealthed', tone: 'info', title: 'Invisible to the opponent until revealed (adjacent enemy, damage in enemy vision, detection)' })
  const squares = unit.anchor === null ? [] : footprintSquares(unit.anchor, unit.size)
  for (const area of view.areas) {
    if (area.squares.some((a) => squares.some((s) => s.x === a.x && s.y === a.y))) {
      out.push({ label: `In ${hasAbilityData(area.abilityId) ? abilityData(area.abilityId).name : 'an area'}${area.owner === view.seat ? '' : ' (enemy)'}`, tone: area.owner === unit.owner ? 'good' : 'bad' })
    }
  }
  const keep = view.buildings.find((b) => b.kind === 'keep')
  if (keep?.controller === unit.owner) out.push({ label: `Keep +${KEEP_POWER_BONUS} Power`, tone: 'good' })
  const market = view.buildings.find((b) => b.kind === 'market')
  if (market?.controller === unit.owner && unit.tier !== null && MARKET_TIERS.includes(unit.tier)) out.push({ label: 'Market: extra action', tone: 'good' })
  if (isBabaWhite(unit.type) && view.commanders[unit.owner] === 'babaYaga') out.push({ label: 'Unit of white (Baba Yaga)', tone: 'info', title: 'A Lojrar Clan unit: her variant applies to it (R44)' })
  return out
}

/** PX BT-28: rows between the commander and its goal row. */
export function goalDistance(view: PlayerView, unit: UnitView): number | null {
  if (!unit.isCommander || unit.anchor === null || view.side === null || unit.owner !== view.seat) return null
  return Math.abs(goalRowY(view.side) - unit.anchor.y)
}

/** Artificer counters (A8-13, A8-16): shared caps over all own living Artificers. */
export function artificerCounters(view: PlayerView): { readonly mines: string; readonly dummies: string } | null {
  const artificers = view.units.filter((u) => u.owner === view.seat && u.type === 'artificer' && u.anchor !== null).length
  if (artificers === 0) return null
  const mines = view.mines.filter((m) => m.owner === view.seat).length
  const dummies = view.units.filter((u) => u.owner === view.seat && u.type === 'noAcb').length
  return { mines: `${mines}/${MINE_CAP(artificers)}`, dummies: `${dummies}/${DUMMY_CAP(artificers)}` }
}
