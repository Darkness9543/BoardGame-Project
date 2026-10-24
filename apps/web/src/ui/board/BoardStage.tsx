// Mounts the board renderer chosen in the options with its contract props and the extras context.

import type { BoardRendererProps } from '../../contracts'
import { useSettings } from '../../store/settings'
import { BoardExtrasContext, type BoardExtras } from './extras'
import { boardRenderer } from './registry'

export function BoardStage({ props, extras, className }: { readonly props: BoardRendererProps; readonly extras: BoardExtras; readonly className?: string }) {
  const Renderer = boardRenderer(useSettings((s) => s.settings.board)).component
  return (
    <BoardExtrasContext.Provider value={extras}>
      <div className={`board-stage${className === undefined ? '' : ` ${className}`}`} data-camera={props.cameraMode}>
        <Renderer {...props} />
      </div>
    </BoardExtrasContext.Provider>
  )
}
