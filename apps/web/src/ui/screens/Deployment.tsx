// S06 deployment (PX 6, UX 24): hidden and simultaneous. Click a tray chip and paint squares, drag a chip onto
// the board, click a placed token to lift it (click another to swap), right-click to send it back; auto-deploy,
// mirror and saved formations; confirm or withdraw. R33: both army lists are public from now on.

import { useEffect, useRef, useState } from 'react'
import { unitDef, zoneSquares, type Intent, type Square, type UnitTypeId } from '@coinduel/engine'
import { BROWSING, autoDeployIntents, captureFormation, clearIntents, formationIntents, mirrorIntents, reduceDeploy, trayGroups, unplacedCount, validSquares, type DeployEvent, type DeployState } from '../../store/deploy'
import { formationKey, loadFormation, saveFormation } from '../../store/formations'
import { prefersReducedMotion, useSettings } from '../../store/settings'
import { useUiState } from '../../store/uiState'
import { toast } from '../../store/toasts'
import { leaveMatch, sendAll } from '../actions'
import { ArmiesPanel } from '../components/ArmiesPanel'
import { Coin } from '../components/Coin'
import { Kbd } from '../components/common'
import { BoardStage } from '../board/BoardStage'
import { NO_EXTRAS } from '../board/extras'
import { useMatch } from '../hooks/useMatch'

interface Drag {
  readonly type: UnitTypeId
  readonly x: number
  readonly y: number
  readonly moved: boolean
}

export function Deployment() {
  const match = useMatch()
  const settings = useSettings((s) => s.settings)
  const cameraMode = useUiState((s) => s.cameraMode)
  const toggleCamera = useUiState((s) => s.toggleCamera)
  const [state, setState] = useState<DeployState>(BROWSING)
  const [hover, setHover] = useState<Square | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [busy, setBusy] = useState(false)
  const [clearArmed, setClearArmed] = useState(false)
  const hoverRef = useRef<Square | null>(null)
  hoverRef.current = hover

  const view = match?.snap.view
  const session = match?.controller.session

  const send = (intents: readonly Intent[]): void => {
    if (session === undefined || intents.length === 0) return
    setBusy(true)
    void sendAll(session, intents).finally(() => setBusy(false))
  }
  const handle = (event: DeployEvent): void => {
    if (view === undefined) return
    const result = reduceDeploy(state, event, view)
    setState(result.state)
    if (result.hint !== null) toast(result.hint, 'warn')
    send(result.intents)
  }

  // Dragging a tray chip: the board reports the hovered square, so a drop works with any renderer.
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag
  const handleRef = useRef(handle)
  handleRef.current = handle
  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (d === null) return
      setDrag({ ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 })
    }
    const onUp = () => {
      const d = dragRef.current
      setDrag(null)
      if (d === null) return
      handleRef.current(d.moved ? { t: 'drop', source: { type: d.type }, square: hoverRef.current } : { t: 'pickType', type: d.type })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') setState(BROWSING)
      if (e.key === 'v' || e.key === 'V') toggleCamera()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleCamera])

  if (match === null || view === undefined || session === undefined) return null
  const me = view.seat
  const other = me === 'host' ? 'guest' : 'host'
  const side = view.side
  const tray = trayGroups(view)
  const left = unplacedCount(view)
  const confirmed = view.deploymentConfirmed[me]
  const armedType = state.t === 'brush' ? state.type : state.t === 'lifted' ? (view.units.find((u) => u.id === state.unitId)?.type ?? null) : drag?.type ?? null
  const armedUnit = state.t === 'lifted' ? state.unitId : undefined
  const targets = armedType === null || confirmed ? [] : validSquares(view, armedType, armedUnit)
  const vanguard = armedType !== null && tray.find((g) => g.type === armedType)?.vanguard === true
  const army = view.myArmy
  const key = army === null ? null : formationKey(army, view.settings.scenarioId)
  const saved = key === null ? null : loadFormation(key)
  const lifted = state.t === 'lifted' ? view.units.find((u) => u.id === state.unitId)?.anchor ?? null : null

  return (
    <main className="screen deployment">
      <header className="match-topbar">
        <button type="button" className="btn btn-ghost btn-small" onClick={leaveMatch}>
          ← Leave
        </button>
        <h1 className="screen-title">Deployment</h1>
        <span className="muted">
          {view.southSeat === null ? '' : view.southSeat === me ? 'You move first (you play South)' : `${match.snap.names[other]} moves first (you play North)`}
        </span>
        <span className={`tag ${view.deploymentConfirmed[other] ? 'tag-ok' : ''}`}>
          {match.snap.names[other]}: {view.deploymentConfirmed[other] ? 'Ready ✓' : 'Deploying…'}
        </span>
        <button type="button" className="btn btn-small" onClick={toggleCamera} title="Top or isometric view (V)">
          {cameraMode === 'top' ? 'Isometric' : 'Top view'} <Kbd>V</Kbd>
        </button>
      </header>
      <div className="deployment-body">
        <aside className="deploy-tray" aria-label="Units to place">
          <h2 className="section-title">Your units</h2>
          <p className="muted small">Click a unit, then squares in your zone. Or drag it onto the board. Your placements are hidden from your opponent.</p>
          <ul className="tray">
            {tray.map((g) => {
              const def = unitDef(g.type)
              const armed = state.t === 'brush' && state.type === g.type
              return (
                <li key={g.type}>
                  <button
                    type="button"
                    className={`tray-chip${armed ? ' tray-armed' : ''}${g.unplaced.length === 0 ? ' tray-done' : ''}`}
                    disabled={confirmed || g.unplaced.length === 0}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return
                      setDrag({ type: g.type, x: e.clientX, y: e.clientY, moved: false })
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handle({ t: 'pickType', type: g.type })
                      }
                    }}
                    title={g.vanguard ? 'Vanguard: may also use the 2 extended rows' : undefined}
                  >
                    <Coin look={{ type: g.type, tier: g.unplaced[0]?.tier ?? g.placed[0]?.tier ?? def.tier, mine: true, commander: view.commanders[me], clarity: settings.clarityMode }} size={30} />
                    <span className="tray-name">
                      {def.name}
                      {g.type === 'commander' && <span className="tag tag-warn">required</span>}
                      {g.vanguard && <span className="tag">Vanguard</span>}
                    </span>
                    <span className="tray-count">
                      {g.unplaced.length}/{g.total}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="deploy-tools">
            <button type="button" className="btn" disabled={confirmed || left === 0 || busy} onClick={() => send(autoDeployIntents(view))}>
              Auto-deploy the rest
            </button>
            <button type="button" className="btn" disabled={confirmed || busy || left === tray.reduce((s, g) => s + g.total, 0)} onClick={() => send(mirrorIntents(view))}>
              Mirror left ↔ right
            </button>
            <button
              type="button"
              className="btn"
              disabled={key === null || left > 0}
              onClick={() => {
                if (key === null) return
                saveFormation(key, captureFormation(view))
                toast('Formation saved for this army and map', 'good')
              }}
            >
              Save formation
            </button>
            <button type="button" className="btn" disabled={confirmed || busy || saved === null} onClick={() => saved !== null && send(formationIntents(view, saved))} title={saved === null ? 'No saved formation for this army and map yet' : undefined}>
              Load formation
            </button>
            {!clearArmed ? (
              <button type="button" className="btn btn-ghost" disabled={confirmed || busy} onClick={() => setClearArmed(true)}>
                Clear all
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setClearArmed(false)
                  send(clearIntents(view))
                }}
              >
                Really clear?
              </button>
            )}
          </div>
          <div className="deploy-confirm">
            {!confirmed ? (
              <button type="button" className="btn btn-primary btn-large" disabled={left > 0 || busy} onClick={() => send([{ kind: 'confirmDeployment', confirmed: true }])}>
                {left > 0 ? `Place ${left} more` : 'Confirm deployment'}
              </button>
            ) : (
              <>
                <p className="pulse">Waiting for {match.snap.names[other]}…</p>
                <button type="button" className="btn" onClick={() => send([{ kind: 'confirmDeployment', confirmed: false }])}>
                  Change my deployment
                </button>
              </>
            )}
          </div>
        </aside>
        <section className="deploy-board" aria-label="Board">
          <BoardStage
            props={{
              view,
              mySeat: me,
              selection: { unitId: armedUnit ?? null, square: hover },
              overlays: {
                reachable: [],
                path: [],
                attackRange: [],
                abilityTargets: targets,
                deploymentZones: side === null ? null : { normal: zoneSquares(side, 'normal'), extended: zoneSquares(side, 'extended') },
              },
              cameraMode,
              showExtendedZone: vanguard,
              onSquareHover: setHover,
              onSquareClick: (square, button) => handle({ t: 'clickSquare', square, button }),
              onUnitHover: () => undefined,
              onUnitClick: (unitId, button) => handle({ t: 'clickUnit', unitId, button }),
            }}
            extras={{
              ...NO_EXTRAS,
              hover,
              picked: lifted === null ? [] : [lifted],
              clarity: settings.clarityMode,
              coordinates: settings.coordinates,
              reducedMotion: prefersReducedMotion(settings.motion),
              animationSpeed: settings.animationSpeed,
            }}
          />
          <p className="hint-line">
            {confirmed
              ? 'Deployment confirmed · it is locked until you change it'
              : state.t === 'brush'
                ? `Placing ${unitDef(state.type).name} · click squares in the lit zone · Esc to stop`
                : state.t === 'lifted'
                  ? 'Click a square to move it, another unit to swap · right-click sends it back to the tray'
                  : 'Pick a unit from the tray, or click a placed unit to move it'}
          </p>
        </section>
        <aside className="deploy-armies" aria-label="Armies">
          <h2 className="section-title">Armies</h2>
          <ArmiesPanel view={view} names={match.snap.names} />
        </aside>
      </div>
      {drag !== null && drag.moved && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <Coin look={{ type: drag.type, tier: unitDef(drag.type).tier, mine: true, commander: view.commanders[me], clarity: settings.clarityMode }} size={40} />
        </div>
      )}
    </main>
  )
}
