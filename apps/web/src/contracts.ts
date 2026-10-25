// Shared app contracts, owned by the engine kernel. The session layer implements Session (for both the host,
// over a loopback, and the guest, over the network), the UI consumes it, and every board renderer accepts
// BoardRendererProps. Game data only ever arrives as a PlayerView plus filtered events, never a GameState.

import type {
  ArmyList,
  DecisionView,
  Intent,
  MatchSettings,
  Phase,
  PlayerView,
  RejectionCode,
  Seat,
  Square,
  TakebackView,
  UnitId,
  VisibleEvent,
} from '@coinduel/engine'

// ---------------------------------------------------------------- session

/** The authority's answer to a dispatched intent. */
export type DispatchResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: RejectionCode | 'NOT_CONNECTED' | 'TIMEOUT'; readonly message: string }

/** Transport health (NC 7.5): unstable after 15 s of silence, lost on close or after 90 s. */
export type ConnectionStatus = 'connecting' | 'connected' | 'unstable' | 'lost'

export interface OpponentPresence {
  /** Someone holds the other seat. */
  readonly joined: boolean
  /** Their display name, once known. */
  readonly name: string | null
  /** Tab visible, tab hidden, or disconnected. */
  readonly activity: 'active' | 'hidden' | 'away'
}

export interface LobbyOperations {
  /** Choose or change this seat's army (un-readies it). */
  setArmy(army: ArmyList): Promise<DispatchResult>
  setReady(ready: boolean): Promise<DispatchResult>
  /** Host only; un-readies both seats. */
  updateSettings(patch: Partial<MatchSettings>): Promise<DispatchResult>
  /** The invite link to share (host), or null. */
  readonly inviteLink: string | null
}

export interface TakebackOperations {
  /** Ask to undo this seat's most recent action (view.takeback.canRequest). */
  request(): Promise<DispatchResult>
  /** Answer the opponent's request (auto-declines after TAKEBACK_TIMEOUT_S on the session clock). */
  respond(accept: boolean): Promise<DispatchResult>
  /** Current request and limits (= view.takeback). */
  readonly state: TakebackView
}

/** What the UI consumes, whatever the transport (host loopback, peer-to-peer guest, relay). */
export interface Session {
  /** The seat this client controls. */
  readonly seat: Seat
  /** Shortcut for view.phase. */
  readonly phase: Phase
  /** The latest projection for this seat; the only game state a client ever holds. */
  readonly view: PlayerView
  /** Events since the previous view, already filtered for this seat (animations, log, achievements). */
  readonly events: readonly VisibleEvent[]
  /** Sends any intent; resolves once the authority accepted or rejected it. */
  dispatch(intent: Intent): Promise<DispatchResult>
  readonly lobby: LobbyOperations
  readonly takeback: TakebackOperations
  readonly connection: ConnectionStatus
  readonly opponent: OpponentPresence
  /** A reaction prompt this seat must answer (= view.decision); answer with dispatch({ kind: 'respondDecision' }). */
  readonly pendingReaction: DecisionView | null
  /** Epoch ms when the pending prompt answers itself with its default (session clock), or null. */
  readonly reactionDeadline: number | null
  /** Called after any change above; returns an unsubscribe function (fits useSyncExternalStore). */
  subscribe(listener: () => void): () => void
}

// ---------------------------------------------------------------- board renderer

export type PointerButton = 'primary' | 'secondary'

export interface BoardSelection {
  /** The selected unit, if any. */
  readonly unitId: UnitId | null
  /** The selected square, if any (deployment target, ability pick). */
  readonly square: Square | null
}

/** Squares to highlight; the UI computes them with the engine's preview helpers, never itself. */
export interface BoardOverlays {
  /** Move destinations (reachableSquares). */
  readonly reachable: readonly Square[]
  /** The previewed path, anchor positions in order (bestPath). */
  readonly path: readonly Square[]
  /** Squares the selected unit can attack (attackTargets). */
  readonly attackRange: readonly Square[]
  /** Squares the pending ability pick accepts (targetOptions). */
  readonly abilityTargets: readonly Square[]
  /** This seat's deployment zones during deployment (deploymentSquares), else null. */
  readonly deploymentZones: { readonly normal: readonly Square[]; readonly extended: readonly Square[] } | null
}

/** The only props a board renderer receives (top or isometric, R3F or a 2D debug renderer). */
export interface BoardRendererProps {
  /** What to draw: terrain, buildings, visible units, known mines and areas, fog (view.visibility). */
  readonly view: PlayerView
  /** This client's seat; its back row is drawn at the bottom (A1-15, view.side). */
  readonly mySeat: Seat
  readonly selection: BoardSelection
  readonly overlays: BoardOverlays
  /** Top view by default; presentation only (A1-16). */
  readonly cameraMode: 'top' | 'iso'
  /** Draw the extended deployment rows (Vanguard units being placed). */
  readonly showExtendedZone: boolean
  /**
   * While true, a drag with the primary button paints squares (onSquareHover keeps reporting them) instead of
   * panning the camera; other buttons, the wheel and pinch still pan and zoom. Deployment sets it while a unit
   * type is armed, so a drag places many units at once.
   */
  readonly paintDrag?: boolean
  /** Pointer over a square (null when it leaves the board). */
  onSquareHover(square: Square | null): void
  onSquareClick(square: Square, button: PointerButton): void
  /** Pointer over a unit token (null when it leaves). */
  onUnitHover(unitId: UnitId | null): void
  onUnitClick(unitId: UnitId, button: PointerButton): void
}
