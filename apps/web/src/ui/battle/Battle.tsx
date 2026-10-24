// S07 battle (UX 5.1 layout): top bar; inspector; the board with its banners, preview and prompts; the log and
// armies; the action bar with AP and End Turn. State machine A drives every input.

import { useEffect, useMemo, useState } from 'react'
import type { BoardRendererProps } from '../../contracts'
import { commandGate, commandUnitId, hintLine } from '../../store/command'
import { useCommandStore } from '../../store/commandStore'
import type { MatchController, MatchSnapshot } from '../../store/matchController'
import { labelWithSquare } from '../../store/naming'
import { unitById } from '../../store/rules'
import { prefersReducedMotion, useSettings } from '../../store/settings'
import { useUiState } from '../../store/uiState'
import { ArmiesPanel } from '../components/ArmiesPanel'
import { BoardStage } from '../board/BoardStage'
import { useMatch } from '../hooks/useMatch'
import { useNow } from '../hooks/useNow'
import { ActionBar, ActionCard, ApWidget, EndTurnButton, TakebackButton } from './ActionBar'
import { hoveredButton, hoverHintOf } from './actionButtons'
import { boardModel } from './boardModel'
import { EventLog } from './EventLog'
import { GameMenu, ShortcutSheet } from './Menus'
import { ForecastPanel, HazardPrompt, ReactionPrompt, StatusBanners, TakebackCard, TurnBanner } from './Prompts'
import { Result } from './Result'
import { TopBar } from './TopBar'
import { UnitPanel } from './UnitPanel'
import { useBattleKeys } from './useBattleKeys'
import { useTurnNotice } from './useTurnNotice'

const NOTICE_MS = 3500

/** The last pointer position on the page, so a hover card appears where the pointer already is instead of staying
 *  invisible until the next move (which read as a flicker when the hovered unit changed under a slow pointer). */
let lastPointer: { x: number; y: number } | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e) => (lastPointer = { x: e.clientX, y: e.clientY }), { capture: true, passive: true })
}

function HoverCard({ snap, unitId }: { readonly snap: MatchSnapshot; readonly unitId: string | null }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(lastPointer)
  useEffect(() => {
    const onMove = (e: PointerEvent) => setAt({ x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
  const unit = unitById(snap.view, unitId)
  if (unit === undefined || at === null) return null
  return (
    <div className="hover-card" style={{ left: at.x + 16, top: at.y + 16 }} aria-hidden="true">
      <span className="strong">{labelWithSquare(snap.registry, snap.view, unit.id)}</span>
      <span className="small">
        {unit.power} Power · {unit.toughness}/{unit.maxToughness} toughness · LOV {unit.lov} · Move {unit.movement}
        {unit.defending ? ' · defending' : ''}
      </span>
    </div>
  )
}

function BattleView({ controller, snap }: { readonly controller: MatchController; readonly snap: MatchSnapshot }) {
  const state = useCommandStore((s) => s.state)
  const hover = useCommandStore((s) => s.hover)
  const hoverUnit = useCommandStore((s) => s.hoverUnit)
  const notice = useCommandStore((s) => s.notice)
  const send = useCommandStore((s) => s.send)
  const setHoverUnit = useCommandStore((s) => s.setHoverUnit)
  const settings = useSettings((s) => s.settings)
  const cameraMode = useUiState((s) => s.cameraMode)
  const threat = useUiState((s) => s.threat)
  const highlight = useUiState((s) => s.highlight)
  const focus = useUiState((s) => s.focus)
  const setFocus = useUiState((s) => s.setFocus)
  const shortcutsOpen = useUiState((s) => s.shortcutsOpen)
  const setShortcuts = useUiState((s) => s.setShortcuts)
  const sidePanel = useUiState((s) => s.sidePanel)
  const sideOpen = useUiState((s) => s.sideOpen)
  const showSide = useUiState((s) => s.showSide)
  const hoveredAction = useUiState((s) => s.hoveredAction)
  const [menuOpen, setMenuOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(true)
  // Tick only while a notice is fading out: an idle battle must not re-render (and redraw the board) on a timer.
  const now = useNow(notice !== null && Date.now() - notice.at < NOTICE_MS + 600 ? 500 : 0)
  const view = snap.view
  const other = view.seat === 'host' ? 'guest' : 'host'
  const ended = view.phase === 'ended'
  const connected = snap.connection === 'connected' || snap.connection === 'unstable'
  const gate = commandGate(view, connected)
  const reducedMotion = prefersReducedMotion(settings.motion)
  // Memoised: a hover change rebuilds it, but a notice tick or unrelated store change must not, because its overlay
  // and selection objects reach the renderer by identity and each new identity costs a frame.
  const model = useMemo(
    () => boardModel(snap, state, hover, hoverUnit, settings, { threat, highlight, focus }, reducedMotion),
    [snap, state, hover, hoverUnit, settings, threat, highlight, focus, reducedMotion],
  )

  useBattleKeys(controller, state, menuOpen || shortcutsOpen || (ended && resultOpen))
  useTurnNotice(snap.banner, snap.names[other])
  useEffect(() => {
    if (focus === null) return
    const timer = setTimeout(() => setFocus(null), 1600)
    return () => clearTimeout(timer)
  }, [focus, setFocus])

  const skipIfPlaying = (): boolean => {
    if (!snap.playback.playing) return false
    controller.skipPlayback()
    return true
  }
  const props: BoardRendererProps = {
    view: snap.display,
    mySeat: view.seat,
    selection: model.selection,
    overlays: model.overlays,
    cameraMode,
    showExtendedZone: false,
    onSquareHover: (square) => send({ t: 'hoverSquare', square }),
    onSquareClick: (square, button) => {
      if (!skipIfPlaying()) send({ t: 'clickSquare', square, button })
    },
    onUnitHover: setHoverUnit,
    onUnitClick: (unitId, button) => {
      if (!skipIfPlaying()) send({ t: 'clickUnit', unitId, button })
    },
  }
  const selectedId = state.t === 'idle' ? null : state.t === 'inspect' ? (state.target.kind === 'unit' ? state.target.unitId : null) : state.unitId
  const panelUnit = selectedId ?? hoverUnit
  const fresh = notice !== null && now - notice.at < NOTICE_MS
  const hoverHint = hoverHintOf(hoveredButton(view, commandUnitId(state), hoveredAction))
  const hint = hoverHint ?? (fresh ? notice.text : hintLine(state, view, gate))

  return (
    <main className={`screen battle ${sideOpen ? '' : 'battle-side-closed'}`}>
      <TopBar controller={controller} snap={snap} onMenu={() => setMenuOpen(true)} />
      <div className="battle-body">
        <aside className="battle-left" aria-label="Unit">
          <ActionCard snap={snap} state={state} />
          <HazardPrompt snap={snap} state={state} />
          <ForecastPanel snap={snap} state={state} forecast={model.forecast} />
          <UnitPanel snap={snap} unitId={panelUnit} inspect={state.t === 'inspect' ? state.target : null} />
        </aside>
        <section className="battle-center" aria-label="Board">
          <div className="banner-slot">
            <StatusBanners controller={controller} snap={snap} />
            <TakebackCard controller={controller} snap={snap} />
            <ReactionPrompt controller={controller} snap={snap} />
          </div>
          <TurnBanner snap={snap} />
          <BoardStage props={props} extras={model.extras} />
          <p className={`hint-line ${fresh || hoverHint !== null ? 'hint-notice' : ''}`} aria-live="polite" title={hint}>
            {hint}
          </p>
        </section>
        {sideOpen && (
          <aside className="battle-right" aria-label="Log and armies">
            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={sidePanel === 'log'} className={sidePanel === 'log' ? 'tab tab-on' : 'tab'} onClick={() => showSide('log')}>
                Log
              </button>
              <button type="button" role="tab" aria-selected={sidePanel === 'armies'} className={sidePanel === 'armies' ? 'tab tab-on' : 'tab'} onClick={() => showSide('armies')}>
                Armies
              </button>
            </div>
            {sidePanel === 'log' ? <EventLog entries={snap.log} /> : <ArmiesPanel view={view} names={snap.names} />}
          </aside>
        )}
      </div>
      <footer className="battle-bottom">
        <ActionBar snap={snap} state={state} gate={gate} />
        <div className="battle-turn">
          <TakebackButton controller={controller} snap={snap} />
          <ApWidget snap={snap} />
          <EndTurnButton controller={controller} snap={snap} gate={gate} />
        </div>
      </footer>
      {hoverUnit !== null && hoverUnit !== selectedId && <HoverCard snap={snap} unitId={hoverUnit} />}
      {menuOpen && <GameMenu controller={controller} snap={snap} onClose={() => setMenuOpen(false)} />}
      {shortcutsOpen && <ShortcutSheet onClose={() => setShortcuts(false)} />}
      {ended && resultOpen && <Result controller={controller} snap={snap} onClose={() => setResultOpen(false)} />}
      {ended && !resultOpen && (
        <button type="button" className="btn btn-primary result-reopen" onClick={() => setResultOpen(true)}>
          Show the result
        </button>
      )}
    </main>
  )
}

export function Battle() {
  const match = useMatch()
  if (match === null) return null
  return <BattleView controller={match.controller} snap={match.snap} />
}
