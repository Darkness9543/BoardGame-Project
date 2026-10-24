// Test flows shared by the session tests: small armies and an automatic deployment through a session's own view.

import { deploymentSquares, validateIntent, type ArmyList, type Seat } from '@coinduel/engine'
import type { DispatchResult } from '../../contracts'
import type { NetSession } from '../types'

export const SMALL_ARMIES: Readonly<Record<Seat, ArmyList>> = {
  host: { faction: 'empire', commander: 'trill', units: { footman: 2 } },
  guest: { faction: 'lojrar', commander: 'ratasius', units: { mercenary: 2 } },
}

export function expectOk(result: DispatchResult): void {
  if (!result.ok) throw new Error(`refused: ${result.code} ${result.message}`)
}

/** Places every own unit on the first square its view allows. */
export async function placeAll(session: NetSession): Promise<void> {
  for (;;) {
    const view = session.view
    const unit = view.units.find((u) => u.owner === view.seat && u.anchor === null)
    if (unit === undefined) return
    if (view.side === null) throw new Error('sides are not decided')
    const anchor = deploymentSquares(view.side, unit.type).find((s) => validateIntent(view, { kind: 'deploy', unitId: unit.id, anchor: s }).ok)
    if (anchor === undefined) throw new Error(`no square for ${unit.type}`)
    expectOk(await session.dispatch({ kind: 'deploy', unitId: unit.id, anchor }))
  }
}

/** The first own unit with a legal one-step move, and that move. */
export function someMove(session: NetSession): { readonly unitId: string; readonly path: readonly { x: number; y: number }[] } {
  const view = session.view
  for (const unit of view.units) {
    if (unit.owner !== view.seat || unit.anchor === null) continue
    const step = { x: unit.anchor.x, y: unit.anchor.y + (view.side === 'south' ? 1 : -1) }
    if (validateIntent(view, { kind: 'move', unitId: unit.id, path: [step] }).ok) return { unitId: unit.id, path: [step] }
  }
  throw new Error('no legal move')
}
