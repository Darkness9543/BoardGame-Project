// The 3D board for the UI's renderer registry (ui/board/registry.ts takes ComponentType<BoardRendererProps>): it
// reads the UI's extras context (ui/board/extras.ts, the UI's channel for what contracts.ts lacks) and passes it to
// BoardRenderer as its optional props. ui/board/Board3D.tsx loads it on demand.

import { useMemo } from 'react'
import { unitDef, type UnitView } from '@coinduel/engine'
import type { BoardRendererProps } from '../contracts'
import { useBoardExtras, type BoardExtras } from '../ui/board/extras'
import { BoardRenderer } from './BoardRenderer'
import type { FloatTone } from './timeline'
import type { AreaPreview, BoardFloater, GhostMarker } from './types'

type UiGhost = BoardExtras['ghosts'][number]
type UiFloater = BoardExtras['floaters'][number]

function ghostMarker(g: UiGhost): GhostMarker {
  const def = unitDef(g.type)
  const unit: UnitView = {
    id: g.unitId,
    type: g.type,
    owner: g.owner,
    anchor: g.anchor,
    toughness: g.toughness,
    defending: false,
    stealthed: false,
    isCommander: g.isCommander,
    size: g.size,
    tier: g.tier,
    power: g.power,
    maxToughness: g.maxToughness,
    lov: def.lov,
    movement: def.movement,
    attackRange: def.attackRange,
    own: null,
  }
  return { unit, seenRound: g.seenRound, vanished: g.vanished }
}

function floatTone(tone: UiFloater['tone']): FloatTone {
  switch (tone) {
    case 'damage':
      return 'damage'
    case 'heal':
      return 'heal'
    case 'word':
      return 'status'
    case 'warn':
      return 'warning'
  }
}

export function ExtrasBoard(props: BoardRendererProps) {
  const x = useBoardExtras()
  const ghosts = useMemo(() => x.ghosts.map(ghostMarker), [x.ghosts])
  const floaters = useMemo((): BoardFloater[] => x.floaters.map((f) => ({ id: f.id, square: f.square, text: f.text, tone: floatTone(f.tone) })), [x.floaters])
  const area = useMemo((): AreaPreview | null => (x.area.length === 0 ? null : { primary: x.area, secondary: [] }), [x.area])
  return (
    <BoardRenderer
      {...props}
      ghosts={ghosts}
      floaters={floaters}
      strikes={x.flashes}
      focus={x.focus}
      hazards={x.hazards}
      picked={x.picked}
      areaPreview={area}
      highlight={x.highlight}
      cursor={x.hover}
      chips={x.chips}
      readyUnits={x.ready}
      highlightReady={x.highlightReady}
      animationSpeed={x.animationSpeed}
      captureRing={x.captureRing}
      visionPreview={x.visionPreview}
      threat={x.threat}
      clarity={x.clarity}
      showCoordinates={x.coordinates}
      reducedMotion={x.reducedMotion}
    />
  )
}
