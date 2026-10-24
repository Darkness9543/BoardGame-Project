// The damage pipeline (RULES_INTERPRETATION 3.3), computed per target and per damage instance:
//   1 base -> 2 attacker additions (attacks only) -> 3 attacker subtractions (floor WEAKNESS_FLOOR = 1, R13)
//   -> 4 target flat reductions (floor 1) -> 5 Defend halves, rounding up.
// runPipeline is pure arithmetic; collectHit gathers the contributions from hooks on any RulesQuery, so the
// same code serves the authority and client-side previews.

import { liveAbility } from './abilities/registry'
import type { DamageStep, HitContext } from './abilities/types'
import {
  DAMAGE_ORDER,
  SAME_NAME_STACKING,
  TARGET_REDUCTION_FLOOR,
  WEAKNESS_FLOOR,
  type DamageOrder,
} from './constants'
import type { RulesQuery } from './query'

export interface Contribution {
  readonly source: string
  readonly amount: number
}

export interface PipelineInput {
  readonly base: number
  /** Step 2 only applies to attacks (A3-02). */
  readonly isAttack: boolean
  readonly additions: readonly Contribution[]
  readonly subtractions: readonly Contribution[]
  readonly reductions: readonly Contribution[]
  readonly defending: boolean
}

export interface PipelineResult {
  readonly amount: number
  readonly breakdown: readonly DamageStep[]
}

function ceilHalf(x: number): number {
  return Math.ceil(x / 2)
}

/** The switches the pipeline reads; tests may pass alternatives. */
export interface PipelineRules {
  readonly order: DamageOrder
  readonly weaknessFloor: number
  readonly reductionFloor: number
}

export const PIPELINE_RULES: PipelineRules = { order: DAMAGE_ORDER, weaknessFloor: WEAKNESS_FLOOR, reductionFloor: TARGET_REDUCTION_FLOOR }

/** Pure pipeline (A3-03 .. A3-06, R13). DAMAGE_ORDER may swap steps 4 and 5 (C3). */
export function runPipeline(input: PipelineInput, rules: PipelineRules = PIPELINE_RULES): PipelineResult {
  const steps: DamageStep[] = []
  let x = input.base
  steps.push({ step: 'base', source: 'base', delta: input.base, total: x })
  if (input.isAttack) {
    for (const c of input.additions) {
      x += c.amount
      steps.push({ step: 'addition', source: c.source, delta: c.amount, total: x })
    }
  }
  for (const c of input.subtractions) {
    x -= c.amount
    steps.push({ step: 'subtraction', source: c.source, delta: -c.amount, total: x })
  }
  if (input.subtractions.length > 0 && x < rules.weaknessFloor) {
    steps.push({ step: 'subtraction', source: 'floor', delta: rules.weaknessFloor - x, total: rules.weaknessFloor })
    x = rules.weaknessFloor
  }
  // A3-04: a hit at 0 here deals no damage at all (Defend never raises 0 to 1, RL C-11); R13 floors weakness at 1.
  if (x <= 0) return { amount: 0, breakdown: steps }

  const reduce = (): void => {
    if (input.reductions.length === 0) return
    for (const c of input.reductions) {
      x -= c.amount
      steps.push({ step: 'reduction', source: c.source, delta: -c.amount, total: x })
    }
    if (x < rules.reductionFloor) {
      steps.push({ step: 'reduction', source: 'floor', delta: rules.reductionFloor - x, total: rules.reductionFloor })
      x = rules.reductionFloor
    }
  }
  const defend = (): void => {
    if (!input.defending) return
    const halved = ceilHalf(x)
    steps.push({ step: 'defend', source: 'defend', delta: halved - x, total: halved })
    x = halved
  }
  switch (rules.order) {
    case 'subtractThenHalve':
      reduce()
      defend()
      break
    case 'halveThenSubtract':
      defend()
      reduce()
      break
  }
  return { amount: x, breakdown: steps }
}

/** A3-15: one contribution per source name (the largest), unless SAME_NAME_STACKING. */
function dedupe(contributions: readonly Contribution[]): Contribution[] {
  if (SAME_NAME_STACKING) return contributions.filter((c) => c.amount !== 0)
  const best = new Map<string, number>()
  for (const c of contributions) best.set(c.source, Math.max(best.get(c.source) ?? 0, c.amount))
  return [...best.entries()].filter(([, amount]) => amount !== 0).map(([source, amount]) => ({ source, amount }))
}

/** Gathers every hook's contribution to one hit, from the board as `q` sees it right now. */
export function collectHit(q: RulesQuery, hit: HitContext): PipelineInput {
  const additions: Contribution[] = []
  const subtractions: Contribution[] = []
  const reductions: Contribution[] = []
  const isAttack = hit.kind === 'attack'

  if (isAttack && hit.dealer !== null) {
    for (const id of q.abilitiesOf(hit.dealer)) {
      const hook = liveAbility(id)?.attackerAddition
      if (hook !== undefined) additions.push({ source: id, amount: hook(q, hit.dealer, hit) })
    }
  }
  // Step 3 only touches damage dealt right now by a unit: never mines or Pajazon ticks (7.8).
  const dealt = hit.dealer !== null && (hit.kind === 'attack' || hit.kind === 'ability')
  for (const holder of q.units()) {
    for (const id of q.abilitiesOf(holder)) {
      const def = liveAbility(id)
      if (def === undefined) continue
      if (dealt && def.attackerSubtraction !== undefined) {
        subtractions.push({ source: id, amount: def.attackerSubtraction(q, holder, hit) })
      }
      if (def.targetReduction !== undefined) reductions.push({ source: id, amount: def.targetReduction(q, holder, hit) })
    }
  }
  for (const area of q.areas()) {
    const hook = liveAbility(area.abilityId)?.area?.targetReduction
    if (hook !== undefined) reductions.push({ source: area.abilityId, amount: hook(q, area, hit) })
  }
  return {
    base: hit.base,
    isAttack,
    additions: dedupe(additions),
    subtractions: dedupe(subtractions),
    reductions: dedupe(reductions),
    defending: hit.target.defending,
  }
}

export function computeHit(q: RulesQuery, hit: HitContext): PipelineResult {
  return runPipeline(collectHit(q, hit))
}
