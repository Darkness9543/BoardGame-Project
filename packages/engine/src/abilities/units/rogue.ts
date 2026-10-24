// Rogue (RULES_INTERPRETATION 8.6, 4.4): Stealth and Assault. The reveal rules R1 (adjacency), R2 (damage inside
// enemy LOV) and R3 (detection) are the core's (resolve.ts settle and dealSimultaneous).

import { STEALTH_FAIL_MODE } from '../../constants'
import { unitDef } from '../../content/units'
import { squareName } from '../../geometry'
import type { RulesQuery } from '../../query'
import type { UnitCore } from '../../types'
import type { AbilityDefinition, ResolveContext } from '../types'

const STEALTH = 'rogue.stealth'
const ASSAULT = 'rogue.assault'
/** Unit memory: 1 once the current Stealth activation has made its Assault (ROG-10); a new activation clears it. */
const ASSAULT_SPENT = 'rogue.assaultSpent'
const SPOTTED = 'Spotted: an unseen enemy can see this square'

/**
 * A4-05: an enemy unit, as far as `q` knows, has one of the Rogue's squares in its LOV. On the truth that includes the
 * commander, dummies and invisible units.
 */
function watched(q: RulesQuery, rogue: UnitCore): boolean {
  const squares = q.footprint(rogue)
  return q.units().some((u) => u.owner !== rogue.owner && squares.some((s) => q.inLov(u, s)))
}

/** On the player's knowledge: only a watcher the player can see disables Stealth (C11). */
function stealthBlocked(q: RulesQuery, unit: UnitCore): string | null {
  if (unit.stealthed) return 'This unit is already in stealth' // ROG-3
  switch (STEALTH_FAIL_MODE) {
    case 'disableIfVisibleElseFail':
      return watched(q, unit) ? 'An enemy can see this unit' : null
  }
}

/** On the truth, after the visible-watcher check passed: an unseen watcher makes the attempt fail (ROG-2, X-31). */
function spotted(ctx: ResolveContext, unit: UnitCore): boolean {
  switch (STEALTH_FAIL_MODE) {
    case 'disableIfVisibleElseFail':
      return watched(ctx, unit)
  }
}

function strike(ctx: ResolveContext, rogue: UnitCore, target: UnitCore): void {
  // A8-07: free and not an action; a triggered attack, so it keeps the Rogue's Defend (2.7). Full pipeline (ROG-8).
  ctx.attack(rogue, { kind: 'unit', unitId: target.id }, { source: ASSAULT, triggered: true })
}

/** ROG-5 / X-33: the Rogue's own step reached several enemies; its controller picks the one to strike. */
function askForTarget(ctx: ResolveContext, rogue: UnitCore, targets: readonly UnitCore[]): void {
  const weakest = [...targets].sort((a, b) => a.toughness - b.toughness)[0]
  if (weakest === undefined) return
  ctx.requestDecision({
    abilityId: ASSAULT,
    holder: rogue,
    seat: rogue.owner,
    kind: ASSAULT,
    prompt: 'Assault: choose the enemy to strike',
    options: targets.map((t) => ({ id: t.id, label: `${unitDef(t.type).name}${t.anchor === null ? '' : ` at ${squareName(t.anchor)}`}` })),
    defaultOption: weakest.id, // AB ROG-5: on timeout, the enemy with the lowest current toughness
    subject: rogue,
  })
}

export const rogueAbilities: readonly AbilityDefinition[] = [
  {
    id: STEALTH,
    status: 'implemented',
    // A8-06: 1 AP and the Rogue's action (content data); it lasts until a reveal (R1-R3), with no cooldown (ROG-3).
    active: {
      targets: [],
      requirement: stealthBlocked,
      secret: true, // 4.8: the other player is told nothing, even when its unseen watcher sees the attempt fail
      resolve: (ctx, unit) => {
        if (spotted(ctx, unit)) {
          ctx.emit({ type: 'abilityNote', unitId: unit.id, abilityId: STEALTH, note: SPOTTED }, [unit.owner])
          return
        }
        ctx.setMemory(unit, ASSAULT_SPENT, 0)
        ctx.setStealthed(unit, true)
      },
    },
  },
  {
    id: ASSAULT,
    status: 'implemented',
    // A8-07: an enemy's distance to the stealthed Rogue became 1 through a movement step, whoever moved (a Move,
    // Charge or Group march step; never a creation or revive, ROG-4). The core runs mines, then these hooks
    // (stationary units first, ROG-6), then the reveals, so the Assault lands before R1 reveals the Rogue.
    onAdjacencyGained: (ctx, holder, info) => {
      if (!info.holderStealthed || ctx.memory(holder, ASSAULT_SPENT) > 0) return // ROG-10: once per activation
      const [first, ...others] = info.enemies
      if (first === undefined) return
      ctx.setMemory(holder, ASSAULT_SPENT, 1)
      if (others.length === 0) strike(ctx, holder, first)
      else askForTarget(ctx, holder, info.enemies)
      return 'interrupt' // C31 / ROG-7 / ROG-17: the move ends, the Rogue's own move included
    },
    onDecision: (ctx, holder, _decision, choice) => {
      const target = ctx.unit(choice)
      if (holder === null || target === undefined || target.owner === holder.owner || !ctx.isAdjacent(holder, target)) return
      strike(ctx, holder, target)
    },
  },
]
