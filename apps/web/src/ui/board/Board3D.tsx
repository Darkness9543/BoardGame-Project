// The 3D board (render/ExtrasBoard: React Three Fiber over three.js), loaded on first use so the menus don't wait for
// three.js. The extras context set by BoardStage reaches it through the lazy boundary.

import { lazy, Suspense } from 'react'
import type { BoardRendererProps } from '../../contracts'

const ExtrasBoard = lazy(() => import('../../render/ExtrasBoard').then((m) => ({ default: m.ExtrasBoard })))

export function Board3D(props: BoardRendererProps) {
  return (
    <Suspense fallback={<div className="board-loading pulse">Setting up the board…</div>}>
      <ExtrasBoard {...props} />
    </Suspense>
  )
}
