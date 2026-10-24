// The top bar (UX S-5.1): round and whose turn, both players with their commander, AP and AP debt (R15), the
// Siege counters (R30), the approach boost and AP curve (R28), building control, the turn clock (R29), and the
// view, replay, shortcut and menu buttons.

import {
  SIEGE_RULE_TEXT,
  SIEGE_TURNS,
  apForRound,
  APPROACH_BOOST,
  commanderDef,
  type PlayerView,
  type Seat,
} from '@coinduel/engine'
import type { MatchSnapshot, MatchController } from '../../store/matchController'
import { clockDisplay, formatClock } from '../../store/turnClock'
import { useUiState } from '../../store/uiState'
import { Kbd } from '../components/common'
import { Icon } from '../components/Icon'
import { useNow } from '../hooks/useNow'
import { apCurveText } from './describe'
import { COMMANDER_PORTRAITS } from '../theme'

function boostState(view: PlayerView): { readonly active: boolean; readonly text: string } {
  const round = view.turn?.round ?? 1
  const active = view.firstContactRound === null || round <= view.firstContactRound
  if (view.firstContactRound === null) return { active, text: `Approach boost ×${APPROACH_BOOST} · until first contact` }
  if (active) return { active, text: `First contact! Boost ends after round ${view.firstContactRound}` }
  return { active, text: `Contact in round ${view.firstContactRound}` }
}

function PlayerChip({ snap, seat }: { readonly snap: MatchSnapshot; readonly seat: Seat }) {
  const view = snap.view
  const me = seat === view.seat
  const commander = view.commanders[seat]
  const ap = me ? view.myAp : view.opponentAp
  const debt = me ? view.myApDebt : view.opponentApDebt
  const active = view.turn?.activeSeat === seat
  const bothBuildings = view.buildings.length === 2
  const siege = view.siegeTurns[seat]
  const presence = me ? snap.connection : snap.opponent.activity
  return (
    <div className={`player-chip ${me ? 'player-me' : 'player-opp'} ${active ? 'player-active' : ''}`}>
      <span className={`dot dot-${presence === 'connected' || presence === 'active' ? 'ok' : presence === 'unstable' || presence === 'hidden' ? 'warn' : 'bad'}`} title={me ? `You: ${snap.connection}` : `Opponent: ${snap.opponent.activity}`} />
      {commander !== null && <Icon name={COMMANDER_PORTRAITS[commander]} size={20} title={commanderDef(commander).name} />}
      <span className="player-name">{snap.names[seat]}</span>
      {ap !== null && (
        <span className="player-ap" title={me ? 'Your AP left this turn' : 'Opponent AP (R15: both totals are public)'}>
          <Icon name="lightning-helix" size={13} />
          {ap}
          {debt !== null && debt > 0 && <span className="debt" title="AP owed from a Cauldron return, taken from the next pool (R11)">−{debt}</span>}
        </span>
      )}
      {bothBuildings && (
        <span className={`siege ${siege > 0 ? 'siege-on' : ''}`} title={SIEGE_RULE_TEXT}>
          Siege {siege}/{SIEGE_TURNS}
        </span>
      )}
    </div>
  )
}

function Clock({ controller, snap }: { readonly controller: MatchController; readonly snap: MatchSnapshot }) {
  const now = useNow(500)
  const reading = clockDisplay(controller.session.clock, now)
  if (reading === null || snap.view.phase !== 'battle') return null
  const mine = reading.active === snap.view.seat
  const low = !reading.inBank && reading.turnLeftMs < 15000
  return (
    <span className={`turn-clock ${reading.inBank ? 'clock-bank' : ''} ${low || (reading.inBank && reading.bankLeftMs < 15000) ? 'clock-low' : ''}`} title="R29: the turn time runs first, then the player's bank; at zero the turn ends" role="timer">
      {reading.paused ? '⏸ ' : ''}
      {mine ? 'You' : snap.names[reading.active]} {reading.inBank ? `bank ${formatClock(reading.bankLeftMs)}` : formatClock(reading.turnLeftMs)}
      {!reading.inBank && <span className="muted small"> + {formatClock(reading.bankLeftMs)} bank</span>}
    </span>
  )
}

export function TopBar({ controller, snap, onMenu }: { readonly controller: MatchController; readonly snap: MatchSnapshot; readonly onMenu: () => void }) {
  const view = snap.view
  const cameraMode = useUiState((s) => s.cameraMode)
  const toggleCamera = useUiState((s) => s.toggleCamera)
  const setShortcuts = useUiState((s) => s.setShortcuts)
  const toggleThreat = useUiState((s) => s.toggleThreat)
  const threat = useUiState((s) => s.threat)
  const me = view.seat
  const other: Seat = me === 'host' ? 'guest' : 'host'
  const round = view.turn?.round ?? 1
  const mine = view.turn?.activeSeat === me
  const boost = boostState(view)
  const pool = view.apPool
  const next = apForRound(round + 1) * (view.firstContactRound === null ? APPROACH_BOOST : 1)
  return (
    <header className="match-topbar battle-topbar">
      <button type="button" className="btn btn-ghost btn-small" onClick={onMenu} aria-label="Game menu">
        ☰
      </button>
      <div className={`turn-indicator ${mine ? 'turn-mine' : ''}`} aria-live="polite">
        <span className="turn-round">Round {round}</span>
        <span className="turn-who">{view.phase === 'ended' ? 'Game over' : mine ? 'Your turn' : `${snap.names[other]}'s turn`}</span>
      </div>
      <Clock controller={controller} snap={snap} />
      <PlayerChip snap={snap} seat={me} />
      <PlayerChip snap={snap} seat={other} />
      <span className={`boost-chip ${boost.active ? 'boost-on' : ''}`} title={`${apCurveText()}\nThis round: ${pool} AP for each player (before the Market and Tribute). Next round: ${next}.`}>
        {boost.text} · {pool} AP
      </span>
      <span className="buildings-status">
        {view.buildings.map((b) => (
          <span key={b.kind} className={`building-chip building-${b.controller === null ? 'neutral' : b.controller === me ? 'me' : 'opp'}`} title={`${b.kind === 'keep' ? 'The Keep' : 'The Market'}: ${b.controller === null ? 'neutral' : b.controller === me ? 'yours' : snap.names[b.controller]}`}>
            <Icon name={b.kind === 'keep' ? 'white-tower' : 'shop'} size={14} /> {b.controller === null ? 'Neutral' : b.controller === me ? 'You' : 'Opp'}
          </span>
        ))}
      </span>
      <span className="topbar-tools">
        {snap.canReplay && (
          <button type="button" className="btn btn-small" onClick={() => controller.replayOpponentTurn()} title="Replay what you saw of the opponent's last turn">
            ⟲ Replay their turn
          </button>
        )}
        <button type="button" className={`btn btn-small ${threat ? 'btn-on' : ''}`} onClick={toggleThreat} title="Danger zone: where visible enemies could strike next turn (T)">
          Threats <Kbd>T</Kbd>
        </button>
        <button type="button" className="btn btn-small" onClick={toggleCamera} title="Switch between the top and the isometric view (V)">
          {cameraMode === 'top' ? 'Iso' : 'Top'} <Kbd>V</Kbd>
        </button>
        <button type="button" className="btn btn-small" onClick={() => setShortcuts(true)} aria-label="Keyboard shortcuts">
          <Kbd>?</Kbd>
        </button>
      </span>
    </header>
  )
}
