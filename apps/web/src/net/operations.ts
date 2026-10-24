// Small pieces every session kind shares: the lobby and take-back operation objects of the contract, the
// reaction answer, and logging the finished match (R38).

import type { Intent, MatchSummary, PlayerView, RejectionCode, Seat, VisibleEvent } from '@coinduel/engine'
import type { DispatchResult, LobbyOperations, OpponentPresence } from '../contracts'
import { appendMatchLog, type MatchLogMode } from './matchLog'
import type { KeyValueStore } from './storage'
import type { NetTakebackOperations } from './types'

export type Dispatch = (intent: Intent) => Promise<DispatchResult>

export function refused(code: RejectionCode | 'NOT_CONNECTED' | 'TIMEOUT', message: string): Promise<DispatchResult> {
  return Promise.resolve({ ok: false, code, message })
}

export function lobbyOperations(dispatch: Dispatch, inviteLink: () => string | null): LobbyOperations {
  return {
    setArmy: (army) => dispatch({ kind: 'setArmy', army }),
    setReady: (ready) => dispatch({ kind: 'setReady', ready }),
    updateSettings: (patch) => dispatch({ kind: 'updateSettings', settings: patch }),
    get inviteLink() {
      return inviteLink()
    },
  }
}

export function takebackOperations(dispatch: Dispatch, view: () => PlayerView, deadline: () => number | null): NetTakebackOperations {
  return {
    request: () => dispatch({ kind: 'requestTakeback' }),
    respond: (accept) => dispatch(accept ? { kind: 'acceptTakeback' } : { kind: 'declineTakeback' }),
    get state() {
      return view().takeback
    },
    get deadline() {
      return deadline()
    },
  }
}

export function answerReaction(dispatch: Dispatch, view: PlayerView, choice: string): Promise<DispatchResult> {
  const decision = view.decision
  if (decision === null) return refused('NO_DECISION', 'There is nothing to answer')
  return dispatch({ kind: 'respondDecision', decisionId: decision.id, choice })
}

export function presence(joined: boolean, name: string | null, activity: OpponentPresence['activity']): OpponentPresence {
  return { joined, name, activity }
}

type SummaryEvent = Extract<VisibleEvent, { readonly type: 'matchSummary' }>

export function summaryIn(events: readonly VisibleEvent[]): MatchSummary | null {
  const found = events.find((e): e is SummaryEvent => e.type === 'matchSummary')
  return found === undefined ? null : found.summary
}

/** R38: logs the match once its summary arrives; `id` keeps a resent summary from being logged twice. */
export function logFinishedMatch(
  store: KeyValueStore,
  id: string,
  mode: MatchLogMode,
  seat: Seat,
  view: PlayerView,
  events: readonly VisibleEvent[],
  finishedAt: number,
): void {
  const summary = summaryIn(events)
  if (summary === null) return
  appendMatchLog(store, { id, finishedAt, mode, seat, names: view.names, summary })
}
