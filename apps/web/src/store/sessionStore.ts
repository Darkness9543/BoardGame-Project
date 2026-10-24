// The current match: one online NetSession, or the sandbox (one person, both seats of a LocalSession; R29: no turn
// timer there unless the lobby turns it on). Each sandbox seat has its own controller on its own endpoint, so each
// keeps only that seat's memory (log, ghosts); the screens show the seat the LocalSession follows.

import { create } from 'zustand'
import { SEATS, type ArmyList, type MatchSettings, type Seat } from '@coinduel/engine'
import { createSession, skirmishRecord, type LocalSession, type NetSession } from '../net'
import { randomCode } from './ids'
import { MatchController } from './matchController'
import { appStore } from './storage'

export type MatchMode = 'online' | 'sandbox'

export interface SandboxMatch {
  readonly session: LocalSession
  readonly controllers: Readonly<Record<Seat, MatchController>>
  /** The seat on screen. */
  readonly seat: Seat
  /** Switch to whoever must act: the active seat, a prompt's decider, the seat still choosing or deploying. */
  readonly followTurn: boolean
}

export interface SandboxSetup {
  readonly names: Readonly<Record<Seat, string>>
  readonly settings: Partial<MatchSettings>
  /** Skip the lobby: each seat takes this army and gets ready, so the match opens in the deployment. */
  readonly armies?: Readonly<Record<Seat, ArmyList>>
}

interface SessionStore {
  readonly mode: MatchMode | null
  readonly roomId: string | null
  readonly controller: MatchController | null
  readonly sandbox: SandboxMatch | null
  attachOnline(roomId: string, session: NetSession): MatchController
  startSandbox(setup: SandboxSetup): void
  /** A battle already in contact (the engine's scenario DSL), to try combat at once. */
  startSkirmish(names: Readonly<Record<Seat, string>>): void
  playAs(seat: Seat): void
  setFollowTurn(on: boolean): void
  detach(): void
}

type Get = () => SessionStore
type Set = (patch: Partial<SessionStore>) => void

let stopFollow: (() => void) | null = null

/** Shows one seat of the sandbox; only that seat's controller raises toasts. */
function showSeat(set: Set, sandbox: SandboxMatch, seat: Seat): void {
  for (const s of SEATS) sandbox.controllers[s].setForeground(s === seat)
  set({ sandbox: { ...sandbox, seat }, controller: sandbox.controllers[seat] })
}

function openSandbox(get: Get, set: Set, session: LocalSession): void {
  get().detach()
  const roomId = `sandbox-${randomCode(6)}`
  const controllers = {
    host: new MatchController(session.endpoint('host'), { roomId, sandbox: true }),
    guest: new MatchController(session.endpoint('guest'), { roomId, sandbox: true }),
  }
  set({ mode: 'sandbox', roomId })
  showSeat(set, { session, controllers, seat: session.seat, followTurn: session.followTurn }, session.seat)
  // The session notifies after both endpoints have delivered, so the controllers are up to date when the seat flips.
  stopFollow = session.subscribe(() => {
    const sandbox = get().sandbox
    if (sandbox?.session !== session) return
    if (sandbox.seat !== session.seat || sandbox.followTurn !== session.followTurn) showSeat(set, { ...sandbox, followTurn: session.followTurn }, session.seat)
  })
}

async function takeArmies(session: LocalSession, armies: Readonly<Record<Seat, ArmyList>>): Promise<void> {
  for (const seat of SEATS) {
    const endpoint = session.endpoint(seat)
    const chosen = await endpoint.lobby.setArmy(armies[seat])
    if (chosen.ok) await endpoint.lobby.setReady(true)
  }
}

export const useSessionStore = create<SessionStore>()((set, get) => ({
  mode: null,
  roomId: null,
  controller: null,
  sandbox: null,

  attachOnline(roomId, session) {
    const current = get()
    if (current.controller?.session === session) return current.controller
    get().detach()
    const controller = new MatchController(session, { roomId, sandbox: false })
    set({ mode: 'online', roomId, controller, sandbox: null })
    return controller
  },

  startSandbox(setup) {
    const session = createSession({ mode: 'local', names: setup.names, settings: setup.settings, storage: appStore() })
    openSandbox(get, set, session)
    if (setup.armies !== undefined) void takeArmies(session, setup.armies)
  },

  startSkirmish(names) {
    openSandbox(get, set, createSession({ mode: 'local', record: skirmishRecord(names, randomCode(12)), storage: appStore() }))
  },

  playAs(seat) {
    get().sandbox?.session.setSeat(seat)
  },

  setFollowTurn(on) {
    get().sandbox?.session.setFollowTurn(on)
  },

  detach() {
    stopFollow?.()
    stopFollow = null
    const { controller, sandbox } = get()
    if (sandbox !== null) {
      for (const seat of SEATS) sandbox.controllers[seat].dispose()
      sandbox.session.close()
    } else {
      controller?.dispose()
    }
    set({ mode: null, roomId: null, controller: null, sandbox: null })
  },
}))
