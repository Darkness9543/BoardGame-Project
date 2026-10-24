// Dev page for the 3D board (route '#/dev/render'). It runs a real engine battle on Crossroads in a sandbox session
// (createSession({ mode: 'local' }) on a DSL record, so the fog, buildings, mines and stealth are the engine's and the
// page only ever reads each seat's PlayerView) and wires the renderer the way the game UI would: select, preview the
// path and the damage, click to act, watch the animations, end the turn hot-seat.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import {
  area3x3,
  attackTargets,
  buildBattle,
  footprintSquares,
  previewAttack,
  reachableSquares,
  sameSquare,
  squareName,
  squaresWithin,
  startRecord,
  unitDef,
  validateIntent,
  zoneSquares,
  type AttackTarget,
  type Intent,
  type PlayerView,
  type Seat,
  type Square,
  type UnitId,
} from '@coinduel/engine'
import type { BoardOverlays, BoardSelection, PointerButton } from '../contracts'
import { createSession, memoryStore, type LocalSession } from '../net'
import { EMPTY_GHOSTS, updateGhosts, type Ghost, type GhostMemory } from '../store/ghosts'
import { ensureThemeFonts, FONTS, OWNER_CUES } from '../theme'
import { BoardRenderer } from './BoardRenderer'
import type { IsoStyle } from './cameraMath'
import type { AnimationSpeed } from './timeline'
import type { BoardRendererHandle, DamageForecast, GhostMarker } from './types'

const SEAT_PAIR: readonly Seat[] = ['host', 'guest']

interface Demo {
  readonly session: LocalSession
  readonly ghosts: Readonly<Record<Seat, GhostMemory>>
}

function newDemo(): Demo {
  const b = buildBattle({
    settings: { scenarioId: 'crossroads' },
    commanders: { south: 'trill', north: 'babaYaga' },
    variants: { north: 'hex-ward' },
    control: { keep: 'south', market: 'north' },
    south: [
      'commander@L2',
      'footman@J5',
      'footman@K5',
      { type: 'footman', at: 'L5', toughness: 1 },
      'soldier@M5',
      { type: 'soldier', at: 'N6', defending: true },
      'berserker@K7',
      'priestess@I6',
      { type: 'paladin', at: 'L8', toughness: 11 },
      'royalWizard@H4',
      'emissary@M3',
    ],
    north: [
      'commander@M24',
      'mercenary@K10',
      'mercenary@L10:M2',
      'mercenary@M10',
      'ranger@N11',
      { type: 'rogue', at: 'O11', stealthed: true },
      'juliomancer@P13',
      'artificer@Q14',
      'noAcb@Q13',
      { type: 'beast', at: 'L17', toughness: 31 },
      'scourge@N20',
    ],
    mines: [
      { owner: 'north', at: 'K9' },
      { owner: 'south', at: 'J7' },
    ],
  })
  const session = createSession({ mode: 'local', record: startRecord(b.state), followTurn: false, startSeat: b.south, storage: memoryStore() })
  // A stale memory for South, to show the ghost style: the Beast "was seen" two rows further south last round.
  const beast = session.endpoint(b.north).view.units.find((u) => u.type === 'beast')
  const stale: Ghost[] =
    beast === undefined
      ? []
      : [{ unitId: beast.id, type: beast.type, owner: beast.owner, anchor: { x: 11, y: 14 }, size: beast.size, tier: beast.tier, isCommander: false, power: beast.power, toughness: beast.toughness, maxToughness: beast.maxToughness, seenTurn: 0, seenRound: 1, vanished: false }]
  return { session, ghosts: { ...{ host: EMPTY_GHOSTS, guest: EMPTY_GHOSTS }, [b.south]: { ghosts: stale, history: [] } } }
}

function ghostMarker(g: Ghost): GhostMarker {
  const def = unitDef(g.type)
  return {
    unit: { id: g.unitId, type: g.type, owner: g.owner, anchor: g.anchor, toughness: g.toughness, defending: false, stealthed: false, isCommander: g.isCommander, size: g.size, tier: g.tier, power: g.power, maxToughness: g.maxToughness, lov: def.lov, movement: def.movement, attackRange: def.attackRange, own: null },
    seenRound: g.seenRound,
    vanished: g.vanished,
  }
}

const EMPTY_OVERLAYS: BoardOverlays = { reachable: [], path: [], attackRange: [], abilityTargets: [], deploymentZones: null }

function targetSquares(view: PlayerView, t: AttackTarget): Square[] {
  if (t.kind === 'square') return [t.square]
  const u = view.units.find((x) => x.id === t.unitId)
  return u?.anchor == null ? [] : footprintSquares(u.anchor, u.size)
}

export function RenderDemo() {
  const [demo, setDemo] = useState(newDemo)
  const [viewer, setViewer] = useState<Seat>(() => demo.session.seat)
  const [cameraMode, setCameraMode] = useState<'top' | 'iso'>('top')
  const [isoStyle, setIsoStyle] = useState<IsoStyle>('true')
  const [clarity, setClarity] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [speed, setSpeed] = useState<AnimationSpeed>('normal')
  const [deployOverlay, setDeployOverlay] = useState(false)
  const [abilityPick, setAbilityPick] = useState(false)
  const [threatOn, setThreatOn] = useState(false)
  const [follow, setFollow] = useState(true)
  const [hotSeat, setHotSeat] = useState(true)
  const [selected, setSelected] = useState<UnitId | null>(null)
  const [hover, setHover] = useState<Square | null>(null)
  const [hoverUnit, setHoverUnit] = useState<UnitId | null>(null)
  const [message, setMessage] = useState('Click one of your units, hover a square, click again to act.')
  const [ghostsBySeat, setGhostsBySeat] = useState(demo.ghosts)
  const board = useRef<BoardRendererHandle>(null)

  useEffect(() => {
    ensureThemeFonts()
  }, [])

  // Each seat's memory follows its own deliveries, whichever seat is on screen.
  useEffect(() => {
    setGhostsBySeat(demo.ghosts)
    const stops = SEAT_PAIR.map((seat) => {
      const endpoint = demo.session.endpoint(seat)
      let before = endpoint.view
      return endpoint.subscribe(() => {
        const after = endpoint.view
        if (after === before) return
        const previous = before
        before = after
        setGhostsBySeat((g) => ({ ...g, [seat]: updateGhosts(g[seat], previous, after, endpoint.events) }))
      })
    })
    return () => {
      for (const stop of stops) stop()
    }
  }, [demo])

  const endpoint = demo.session.endpoint(viewer)
  const subscribe = useCallback((listener: () => void) => endpoint.subscribe(listener), [endpoint])
  const view = useSyncExternalStore(subscribe, () => endpoint.view)
  const batchKey = useSyncExternalStore(subscribe, () => endpoint.updateSeq)
  const ghosts = useMemo(() => ghostsBySeat[viewer].ghosts.map(ghostMarker), [ghostsBySeat, viewer])
  const myTurn = view.phase === 'battle' && view.turn?.activeSeat === viewer
  const selectedUnit = view.units.find((u) => u.id === selected && u.owner === viewer) ?? null

  const reach = useMemo(() => (selectedUnit === null || !myTurn ? [] : reachableSquares(view, selectedUnit.id)), [view, selectedUnit, myTurn])
  const attacks = useMemo(() => {
    if (selectedUnit === null || !myTurn) return []
    return attackTargets(view, selectedUnit.id).filter((target) => validateIntent(view, { kind: 'attack', unitId: selectedUnit.id, target }).ok)
  }, [view, selectedUnit, myTurn])
  const hoverReach = hover === null ? undefined : reach.find((r) => sameSquare(r.anchor, hover))
  const hoverTarget = attacks.find((t) => (t.kind === 'unit' ? t.unitId === hoverUnit : hover !== null && sameSquare(t.square, hover)))

  const overlays: BoardOverlays = useMemo(() => {
    if (deployOverlay) {
      const side = view.side ?? 'south'
      return { ...EMPTY_OVERLAYS, deploymentZones: { normal: zoneSquares(side, 'normal'), extended: zoneSquares(side, 'extended') } }
    }
    return {
      reachable: reach.map((r) => r.anchor),
      path: hoverReach?.path ?? [],
      attackRange: attacks.flatMap((t) => targetSquares(view, t)),
      abilityTargets: abilityPick && selectedUnit?.anchor != null ? squaresWithin(selectedUnit.anchor, selectedUnit.size, 3) : [],
      deploymentZones: null,
    }
  }, [deployOverlay, view, reach, hoverReach, attacks, abilityPick, selectedUnit])

  const forecasts: DamageForecast[] = useMemo(() => {
    if (selectedUnit === null || hoverTarget?.kind !== 'unit') return []
    const result = previewAttack(view, selectedUnit.id, hoverTarget.unitId)
    return result === null ? [] : [{ unitId: hoverTarget.unitId, amount: result.amount }]
  }, [view, selectedUnit, hoverTarget])

  const threat = useMemo(() => {
    if (!threatOn) return []
    const out: Square[] = []
    for (const u of view.units) if (u.owner !== viewer && u.anchor !== null) out.push(...squaresWithin(u.anchor, u.size, u.attackRange + u.movement))
    return out
  }, [threatOn, view, viewer])

  const act = useCallback(
    (seat: Seat, intent: Intent): void => {
      void demo.session
        .endpoint(seat)
        .dispatch(intent)
        .then((result) => {
          if (!result.ok) {
            setMessage(`${result.code}: ${result.message}`)
            return
          }
          const next = demo.session.endpoint(seat).view.turn?.activeSeat
          if (hotSeat && intent.kind === 'endTurn' && next !== undefined && next !== viewer) {
            setViewer(next)
            setSelected(null)
          }
          setMessage(`${intent.kind}: ${demo.session.endpoint(seat).events.length} events`)
        })
    },
    [demo, viewer, hotSeat],
  )

  const onUnitClick = (unitId: UnitId, button: PointerButton): void => {
    if (button === 'secondary') {
      setSelected(null)
      return
    }
    const unit = view.units.find((u) => u.id === unitId)
    if (unit === undefined) return
    if (unit.owner === viewer) {
      setSelected(selected === unitId ? null : unitId)
      return
    }
    const target = attacks.find((t) => t.kind === 'unit' && t.unitId === unitId)
    if (selectedUnit !== null && target !== undefined) act(viewer, { kind: 'attack', unitId: selectedUnit.id, target })
  }

  const onSquareClick = (square: Square, button: PointerButton): void => {
    if (button === 'secondary' || selectedUnit === null) {
      setSelected(null)
      return
    }
    const r = reach.find((x) => sameSquare(x.anchor, square))
    if (r !== undefined) {
      act(viewer, { kind: 'move', unitId: selectedUnit.id, path: [...r.path] })
      return
    }
    const shot = attacks.find((t) => t.kind === 'square' && sameSquare(t.square, square))
    if (shot !== undefined) act(viewer, { kind: 'attack', unitId: selectedUnit.id, target: shot })
    else setSelected(null)
  }

  const ownUnits = view.units.filter((u) => u.owner === viewer && u.anchor !== null)
  const cycle = useCallback(
    (step: number): void => {
      if (ownUnits.length === 0) return
      const i = ownUnits.findIndex((u) => u.id === selected)
      const next = ownUnits[(i + step + ownUnits.length) % ownUnits.length]
      if (next?.anchor == null) return
      setSelected(next.id)
      if (board.current?.isOnScreen(next.anchor) === false) board.current.focus(next.anchor)
    },
    [ownUnits, selected],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      const pan = 2
      switch (e.key) {
        case 'v':
        case 'V':
          setCameraMode((m) => (m === 'top' ? 'iso' : 'top'))
          break
        case 'q':
        case 'Q':
          board.current?.rotate(-1)
          break
        case 'e':
        case 'E':
          board.current?.rotate(1)
          break
        case 'f':
        case 'F':
          if (selectedUnit?.anchor != null) board.current?.focus(selectedUnit.anchor)
          break
        case 'Home':
        case '0':
          board.current?.fit()
          break
        case '+':
        case '=':
          board.current?.zoomBy(1.25)
          break
        case '-':
          board.current?.zoomBy(0.8)
          break
        case 'w':
          board.current?.panBy(0, pan)
          break
        case 's':
          board.current?.panBy(0, -pan)
          break
        case 'a':
          board.current?.panBy(-pan, 0)
          break
        case 'd':
          board.current?.panBy(pan, 0)
          break
        case 'Tab':
          e.preventDefault()
          cycle(e.shiftKey ? -1 : 1)
          break
        case 'Escape':
          setSelected(null)
          break
        default:
          return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedUnit, cycle])

  const selection: BoardSelection = { unitId: selected, square: null }
  const active = view.turn?.activeSeat

  return (
    <div style={styles.page}>
      <div style={styles.board}>
        <BoardRenderer
          ref={board}
          view={view}
          mySeat={viewer}
          selection={selection}
          overlays={overlays}
          cameraMode={cameraMode}
          showExtendedZone={deployOverlay}
          onSquareHover={setHover}
          onSquareClick={onSquareClick}
          onUnitHover={setHoverUnit}
          onUnitClick={onUnitClick}
          events={endpoint.events}
          eventsKey={`${viewer}:${batchKey}`}
          ghosts={ghosts}
          forecasts={forecasts}
          areaPreview={abilityPick && hover !== null ? { primary: [hover], secondary: area3x3(hover).filter((s) => !sameSquare(s, hover)) } : null}
          threat={threat}
          clarity={clarity}
          reducedMotion={reduced ? true : undefined}
          animationSpeed={speed}
          followEvents={follow}
          isoStyle={isoStyle}
        />
      </div>
      <aside style={styles.panel}>
        <h1 style={styles.title}>Board renderer</h1>
        <p style={styles.small}>
          Viewing as <b>{viewer}</b> ({view.side}) · round {view.turn?.round ?? '-'} · {active === viewer ? 'your turn' : `${active ?? '-'} to play`} · AP {view.myAp}
        </p>
        <Row>
          <Button onClick={() => setCameraMode((m) => (m === 'top' ? 'iso' : 'top'))}>View: {cameraMode} (V)</Button>
          <Button onClick={() => setIsoStyle((s) => (s === 'true' ? 'dimetric' : 'true'))}>Iso: {isoStyle}</Button>
          <Button onClick={() => board.current?.rotate(1)}>Rotate (Q/E)</Button>
          <Button onClick={() => board.current?.fit()}>Fit (Home)</Button>
        </Row>
        <Row>
          <Button
            onClick={() => {
              setViewer((v) => (v === 'host' ? 'guest' : 'host'))
              setSelected(null)
            }}
          >
            Switch seat
          </Button>
          <Button onClick={() => active !== undefined && act(active, { kind: 'endTurn' })}>End turn</Button>
          <Button onClick={() => cycle(1)}>Next unit (Tab)</Button>
        </Row>
        <Row>
          <Toggle label="Clarity palette" value={clarity} onChange={setClarity} />
          <Toggle label="Reduced motion" value={reduced} onChange={setReduced} />
          <Toggle label="Hot seat" value={hotSeat} onChange={setHotSeat} />
          <Toggle label="Follow actions" value={follow} onChange={setFollow} />
        </Row>
        <Row>
          <Toggle label="Deployment zones" value={deployOverlay} onChange={setDeployOverlay} />
          <Toggle label="Ability pick + area" value={abilityPick} onChange={setAbilityPick} />
          <Toggle label="Danger zone" value={threatOn} onChange={setThreatOn} />
        </Row>
        <Row>
          <label style={styles.small}>
            Speed{' '}
            <select value={speed} onChange={(e) => setSpeed(e.target.value === 'fast' ? 'fast' : e.target.value === 'instant' ? 'instant' : 'normal')}>
              <option value="normal">normal</option>
              <option value="fast">fast</option>
              <option value="instant">instant</option>
            </select>
          </label>
          <Button
            onClick={() => {
              const next = newDemo()
              demo.session.close()
              setDemo(next)
              setViewer(next.session.seat)
              setSelected(null)
            }}
          >
            Reset
          </Button>
        </Row>
        <p style={styles.small}>
          Hover: {hover === null ? '-' : squareName(hover)} {hoverUnit !== null ? `· unit ${view.units.find((u) => u.id === hoverUnit)?.type ?? '?'}` : ''}
        </p>
        <p style={styles.message}>{message}</p>
        <p style={styles.help}>
          Drag to pan (any button), wheel or pinch to zoom, right click to cancel, long-press for the secondary action on touch. WASD pan, +/- zoom, F focus, Tab
          cycles units. <a href="#/">Back to the menu</a>
        </p>
      </aside>
    </div>
  )
}

function Row({ children }: { readonly children: ReactNode }) {
  return <div style={styles.row}>{children}</div>
}

function Button({ children, onClick }: { readonly children: ReactNode; readonly onClick: () => void }) {
  return (
    <button type="button" style={styles.button} onClick={onClick}>
      {children}
    </button>
  )
}

function Toggle({ label, value, onChange }: { readonly label: string; readonly value: boolean; readonly onChange: (v: boolean) => void }) {
  return (
    <label style={styles.toggle}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  )
}

const styles = {
  page: { position: 'fixed', inset: 0, display: 'flex', flexWrap: 'wrap', background: '#14100C', color: OWNER_CUES.me.bezel, fontFamily: FONTS.ui },
  board: { flex: '1 1 480px', minHeight: '60vh', position: 'relative' },
  panel: { flex: '0 1 340px', padding: 16, boxSizing: 'border-box', background: '#1C1611', borderLeft: '1px solid #4A3B2C', overflowY: 'auto', maxHeight: '100vh' },
  title: { fontFamily: FONTS.display, fontSize: 20, margin: '0 0 8px' },
  row: { display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' },
  button: { background: '#2D241B', color: '#F1E6C8', border: '1px solid #6B5539', borderRadius: 6, padding: '6px 10px', font: 'inherit', fontSize: 13, cursor: 'pointer' },
  toggle: { fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 8 },
  small: { fontSize: 13, color: '#B9A98D', margin: '6px 0' },
  message: { fontSize: 13, color: '#FFF3B0', minHeight: 18 },
  help: { fontSize: 12, color: '#857660', lineHeight: 1.4 },
} satisfies Record<string, CSSProperties>

export default RenderDemo
