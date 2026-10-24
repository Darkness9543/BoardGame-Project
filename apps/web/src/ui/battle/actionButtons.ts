// The buttons of the action bar for one own unit, with the engine's costs and disabled reasons (legalActions),
// plus Group march (R27), which legalActions leaves to the UI because it spans several units.

import { abilityData, hasAbilityData, type PlayerView, type UnitId, type UnitView } from '@coinduel/engine'
import { abilityFollowUps, type ActionRef } from '../../store/command'
import { actionsFor, marchOption, ownUnit } from '../../store/rules'
import type { HoveredAction } from '../../store/uiState'
import { abilityStatus } from './describe'

export interface ActionButton {
  readonly action: ActionRef
  readonly label: string
  readonly key: string
  readonly icon: string
  /** The effective AP cost, surcharges included. */
  readonly cost: number
  /** The part of `cost` over the action's own price (Holy Fervor's +1, Charge's +1), shown as "+N" (S-11.6). */
  readonly surcharge: number
  readonly enabled: boolean
  readonly reason: string | null
  /** Usable after the unit's action (Savagery, Mend): the "Next" glow (UX 10.4). */
  readonly followUp: boolean
  /** Basic actions fill the dock's first group, abilities the second (docs/ui-direction/action-bar.html, option A). */
  readonly group: 'basic' | 'ability'
  /** What the action does, with this unit's numbers, for the action card in the side panel (never a tooltip). */
  readonly description: string
  /** Ability readiness ("Ready", "On cooldown: ...", "Used 1/1 this turn"); null for basic actions. */
  readonly status: string | null
}

function basicDescription(kind: 'move' | 'attack' | 'defend' | 'charge', unit: UnitView, base: number): string {
  const plural = (n: number) => `${n} square${n === 1 ? '' : 's'}`
  switch (kind) {
    case 'move':
      return `Up to ${plural(unit.movement)} in orthogonal steps, through your own units but never through enemies.`
    case 'attack':
      return `${unit.power} Power against a unit within range ${unit.attackRange}. Defend halves it; armour and wards reduce it.`
    case 'defend':
      return 'Halve all damage taken (rounded up, never below 1) until your next turn starts. Acting again cancels it.'
    case 'charge':
      return `Move up to ${plural(Math.max(0, unit.movement - 1))} and attack from where you stop, as one action for ${base} AP +1. Needs Movement 2.`
  }
}

const BASIC: readonly { readonly kind: 'move' | 'attack' | 'defend' | 'charge'; readonly label: string; readonly key: string; readonly icon: string }[] = [
  { kind: 'move', label: 'Move', key: 'M', icon: 'walking-boot' },
  { kind: 'attack', label: 'Attack', key: 'A', icon: 'crossed-swords' },
  { kind: 'defend', label: 'Defend', key: 'D', icon: 'checked-shield' },
  { kind: 'charge', label: 'Charge', key: 'C', icon: 'pointy-sword' },
]

export function actionButtons(view: PlayerView, unit: UnitView): ActionButton[] {
  const options = actionsFor(view, unit.id)
  const base = unit.own?.apCost ?? 0
  const followUps = abilityFollowUps(view, unit.id)
  const out: ActionButton[] = []
  for (const b of BASIC) {
    const o = options.find((x) => x.kind === b.kind)
    if (o === undefined) continue
    out.push({
      action: { kind: b.kind },
      label: b.label,
      key: b.key,
      icon: b.icon,
      cost: o.cost,
      surcharge: Math.max(0, o.cost - base),
      enabled: o.enabled,
      reason: o.reason,
      followUp: false,
      group: 'basic',
      description: basicDescription(b.kind, unit, base),
      status: null,
    })
  }
  const march = marchOption(view, unit)
  out.push({
    action: { kind: 'march' },
    label: 'March',
    key: 'G',
    icon: 'knight-banner',
    cost: march.cost,
    surcharge: 0,
    enabled: march.enabled,
    reason: march.reason,
    followUp: false,
    group: 'basic',
    description: 'Up to 6 of your connected units that have not acted each step 1 square in the same direction, for 2 AP. Each uses its action and its move.',
    status: null,
  })
  let n = 1
  for (const o of options) {
    if (o.kind !== 'ability' || o.abilityId === null) continue
    const id = o.abilityId
    const usesAction = hasAbilityData(id) && abilityData(id).usesAction
    out.push({
      action: { kind: 'ability', abilityId: id },
      label: hasAbilityData(id) ? abilityData(id).name : id,
      key: String(n++),
      icon: 'regeneration',
      cost: o.cost,
      surcharge: usesAction ? Math.min(o.cost, unit.own?.nextActionSurcharge ?? 0) : 0,
      enabled: o.enabled,
      reason: o.reason,
      followUp: followUps.includes(id),
      group: 'ability',
      description: hasAbilityData(id) ? abilityData(id).text : '',
      status: abilityStatus(view, unit, id),
    })
  }
  return out
}

/** S-11.6: the price as "base +delta" ("2 AP +1" for a Charge at AP 2), never the total plus the delta again. */
export function costParts(button: ActionButton): { readonly base: number; readonly surcharge: number } {
  return { base: button.cost - button.surcharge, surcharge: button.surcharge }
}

/** The current button for the hovered action of the unit on the bar; null once that unit or that button is gone. */
export function hoveredButton(view: PlayerView, unitId: UnitId | null, hovered: HoveredAction | null): ActionButton | null {
  if (hovered === null || unitId === null || hovered.unitId !== unitId) return null
  const unit = ownUnit(view, unitId)
  return unit === undefined ? null : (actionButtons(view, unit).find((b) => sameAction(hovered.action, b.action)) ?? null)
}

/** S-10.5: why the hovered action is disabled, for the hint line. */
export function hoverHintOf(button: ActionButton | null): string | null {
  return button === null || button.enabled ? null : `${button.label}: ${button.reason ?? 'not available'}`
}

export function sameAction(a: ActionRef | null, b: ActionRef): boolean {
  if (a === null || a.kind !== b.kind) return false
  return a.kind !== 'ability' || (b.kind === 'ability' && a.abilityId === b.abilityId)
}
