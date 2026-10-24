// Pending decisions (2.11, A2-30). The queue head is asked; a seat preference (Always / Never) answers
// at once without pausing. The session runs the timeout and then answers with the default option.

import { liveAbility } from './abilities/registry'
import type { Resolver } from './resolve'
import type { PendingDecision } from './types'

export type DecisionState = 'clear' | 'waiting'

export function answerDecision(r: Resolver, decision: PendingDecision, choice: string, automatic: boolean): void {
  r.state.decisions = r.state.decisions.filter((d) => d.id !== decision.id)
  r.emit({ type: 'decisionResolved', decisionId: decision.id, seat: decision.seat, choice, automatic }, decision.publicTo)
  const holder = decision.holderId === null ? null : (r.stateUnit(decision.holderId) ?? null)
  const hook = liveAbility(decision.abilityId)?.onDecision
  if (hook === undefined) return
  r.withAbilityScope(() =>
    hook(r, holder, { id: decision.id, seat: decision.seat, kind: decision.kind, data: decision.data }, choice),
  )
  r.settle()
}

/** Auto-answers what preferences allow; returns 'waiting' if a player must answer the head decision. */
export function processDecisions(r: Resolver): DecisionState {
  for (;;) {
    if (r.isOver()) return 'clear'
    const head = r.state.decisions[0]
    if (head === undefined) return 'clear'
    const preference = head.preferenceKey === null ? undefined : r.state.seats[head.seat].preferences[head.preferenceKey]
    if (preference === 'always' && head.alwaysOption !== null) answerDecision(r, head, head.alwaysOption, true)
    else if (preference === 'never') answerDecision(r, head, head.defaultOption, true)
    else return 'waiting'
  }
}
