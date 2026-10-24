// Typed rejections. Every reason is computed from the acting seat's knowledge (4.7), so the code and
// message never reveal hidden state (NC 7.8 rule 1).

export type RejectionCode =
  | 'GAME_OVER'
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'NOT_HOST'
  | 'DECISION_PENDING'
  | 'TAKEBACK_PENDING'
  | 'INVALID_ARMY'
  | 'NOT_READY'
  | 'INVALID_SETTINGS'
  | 'UNKNOWN_UNIT'
  | 'NOT_YOUR_UNIT'
  | 'NOT_DEPLOYED'
  | 'NOT_DEPLOYABLE'
  | 'OUTSIDE_ZONE'
  | 'SQUARE_UNAVAILABLE'
  | 'NOT_ALL_DEPLOYED'
  | 'NO_ACTIONS_LEFT'
  | 'ALREADY_MOVED'
  | 'NOT_ENOUGH_AP'
  | 'CANNOT_MOVE'
  | 'INVALID_PATH'
  | 'PATH_TOO_LONG'
  | 'NO_POWER'
  | 'INVALID_TARGET'
  | 'OUT_OF_RANGE'
  | 'UNKNOWN_ABILITY'
  | 'NOT_ACTIVE_ABILITY'
  | 'NOT_IMPLEMENTED'
  | 'ON_COOLDOWN'
  | 'LIMIT_REACHED'
  | 'REQUIREMENT_NOT_MET'
  | 'NO_DECISION'
  | 'INVALID_CHOICE'
  | 'TAKEBACK_UNAVAILABLE'
  | 'NO_TAKEBACK_REQUEST'
  | 'NO_DRAW_OFFER'
  | 'DRAW_ALREADY_OFFERED'
  | 'UNKNOWN_PREFERENCE'
  | 'NOT_AVAILABLE'

export interface Rejection {
  readonly ok: false
  readonly code: RejectionCode
  readonly message: string
}

export type Validation = { readonly ok: true } | Rejection

export const OK: Validation = { ok: true }

export function reject(code: RejectionCode, message: string): Rejection {
  return { ok: false, code, message }
}
