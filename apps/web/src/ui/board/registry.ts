// The board renderers the app can mount: anything implementing BoardRendererProps (contracts.ts), plus the extras
// context. The 3D board is the default; the 2D SVG board is a light fallback for slow devices (Options › Board).

import type { ComponentType } from 'react'
import type { BoardRendererProps } from '../../contracts'
import type { BoardChoice } from '../../store/settings'
import { Board3D } from './Board3D'
import { SvgBoard } from './SvgBoard'

export interface RendererEntry {
  readonly id: BoardChoice
  readonly label: string
  readonly component: ComponentType<BoardRendererProps>
}

export const BOARD_RENDERERS: readonly RendererEntry[] = [
  { id: '3d', label: '3D board', component: Board3D },
  { id: 'svg', label: '2D board (light)', component: SvgBoard },
]

export function boardRenderer(id: BoardChoice): RendererEntry {
  return BOARD_RENDERERS.find((r) => r.id === id) ?? (BOARD_RENDERERS[0] as RendererEntry)
}
