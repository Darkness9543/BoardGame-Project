// Sealed submissions (S28 / R37). The guest keeps its army and its placements on its own machine until the host
// has locked (committed to) its own; only then are they revealed to the host in one batch. Meanwhile the guest
// sees its draft laid over the host's view, and the host sees that the guest is waiting. Only the commander and
// variant leave early, because R16 makes them public in the lobby.

import {
  validateIntent,
  ViewQuery,
  visionMask,
  type ArmyList,
  type Intent,
  type PlayerView,
  type Seat,
  type Square,
  type UnitId,
} from '@coinduel/engine'
import type { LockPhase } from './messages'

export interface GuestDraft {
  /** The real army (lobby); the host holds only its public part until the reveal. */
  readonly army: ArmyList | null
  readonly placements: Readonly<Record<UnitId, Square>>
  /** Ready / Confirm pressed, waiting for the host's commitment. */
  readonly lock: Readonly<Record<LockPhase, boolean>>
}

export const EMPTY_DRAFT: GuestDraft = { army: null, placements: {}, lock: { army: false, deploy: false } }

/** R16: what may be known about an army in the lobby (its commander and variant); the units stay sealed. */
export function publicArmy(army: ArmyList): ArmyList {
  return { faction: army.faction, commander: army.commander, units: {}, ...(army.variant === undefined ? {} : { variant: army.variant }) }
}

function visibilityOf(view: PlayerView): string {
  return Array.from(visionMask(new ViewQuery(view), view.seat), (v) => (v === 1 ? '1' : '0')).join('')
}

/** The guest's own view with its draft applied (what its UI shows and validates against). */
export function overlayDraft(view: PlayerView, draft: GuestDraft): PlayerView {
  const me = view.seat
  switch (view.phase) {
    case 'lobby':
      return {
        ...view,
        myArmy: draft.army ?? view.myArmy,
        lobby: { ...view.lobby, ready: { ...view.lobby.ready, [me]: view.lobby.ready[me] || draft.lock.army } },
      }
    case 'deployment': {
      const units = view.units.map((u) => {
        const placed = u.owner === me ? draft.placements[u.id] : undefined
        return placed === undefined ? u : { ...u, anchor: placed }
      })
      const placed: PlayerView = {
        ...view,
        units,
        deploymentConfirmed: { ...view.deploymentConfirmed, [me]: view.deploymentConfirmed[me] || draft.lock.deploy },
      }
      return { ...placed, visibility: visibilityOf(placed) }
    }
    case 'battle':
    case 'ended':
      return view
  }
}

/** The host's view, showing that the other seat pressed Ready / Confirm and waits for the host to lock. */
export function overlayOpponentLock(view: PlayerView, opponent: Seat, lock: Readonly<Record<LockPhase, boolean>>): PlayerView {
  if (view.phase === 'lobby' && lock.army && !view.lobby.ready[opponent]) {
    return { ...view, lobby: { ...view.lobby, ready: { ...view.lobby.ready, [opponent]: true } } }
  }
  if (view.phase === 'deployment' && lock.deploy && !view.deploymentConfirmed[opponent]) {
    return { ...view, deploymentConfirmed: { ...view.deploymentConfirmed, [opponent]: true } }
  }
  return view
}

/** The reveal batch for a phase, or null if the draft can't be revealed yet. */
export function revealIntents(phase: LockPhase, draft: GuestDraft): Intent[] | null {
  if (phase === 'army') return draft.army === null ? null : [{ kind: 'setArmy', army: draft.army }, { kind: 'setReady', ready: true }]
  const deploys: Intent[] = Object.entries(draft.placements)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([unitId, anchor]) => ({ kind: 'deploy', unitId, anchor }))
  return [...deploys, { kind: 'confirmDeployment', confirmed: true }]
}

/** A draft placement checked exactly as the authority will check it, on the guest's draft view. */
export function checkDraftIntent(view: PlayerView, draft: GuestDraft, intent: Intent): ReturnType<typeof validateIntent> {
  return validateIntent(overlayDraft(view, draft), intent)
}

/** Drops placements of units that are not (or no longer) the guest's own undeployed-or-placed units. */
export function prunePlacements(view: PlayerView, placements: Readonly<Record<UnitId, Square>>): Record<UnitId, Square> {
  const mine = new Set(view.units.filter((u) => u.owner === view.seat).map((u) => u.id))
  const out: Record<UnitId, Square> = {}
  for (const [unitId, anchor] of Object.entries(placements)) if (mine.has(unitId)) out[unitId] = anchor
  return out
}
