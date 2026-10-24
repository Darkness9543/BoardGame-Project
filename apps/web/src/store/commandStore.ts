// Runs state machine A against the active match: builds the context from the latest view and the player's
// options, applies the pure reducer and carries out its effects (sending intents, showing hints).

import { create } from 'zustand'
import type { Square, UnitId } from '@coinduel/engine'
import { IDLE, commandGate, reduceCommand, type CommandContext, type CommandEvent, type CommandState } from './command'
import { ghostAt } from './ghosts'
import type { MatchController } from './matchController'
import { useSessionStore } from './sessionStore'
import { useSettings } from './settings'
import { toast } from './toasts'

export interface Notice {
  readonly text: string
  readonly at: number
}

interface CommandStore {
  readonly state: CommandState
  readonly hover: Square | null
  readonly hoverUnit: UnitId | null
  readonly notice: Notice | null
  send(event: CommandEvent): void
  setHoverUnit(unitId: UnitId | null): void
  reset(): void
}

/** How long to wait for the authority's new view after an acknowledged intent before carrying on. */
const VIEW_WAIT_MS = 1500

export function contextFor(controller: MatchController, hover: Square | null = null, now = Date.now()): CommandContext {
  const snap = controller.snapshot
  const settings = useSettings.getState().settings
  const connected = snap.connection === 'connected' || snap.connection === 'unstable'
  return {
    view: snap.view,
    prefs: { confirmMode: settings.confirmMode, mineWarning: settings.mineWarning, autoSelectNext: settings.autoSelectNext, autoCharge: settings.autoCharge, autoMarch: settings.autoMarch },
    gate: commandGate(snap.view, connected),
    now,
    ghostAt: (square) => (settings.lastSeenMarkers ? (ghostAt(snap.ghosts, square)?.unitId ?? null) : null),
    hover,
  }
}

function waitForNewView(controller: MatchController, before: unknown): Promise<void> {
  if (controller.snapshot.view !== before) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop()
      resolve()
    }, VIEW_WAIT_MS)
    const stop = controller.subscribe(() => {
      if (controller.snapshot.view === before) return
      clearTimeout(timer)
      stop()
      resolve()
    })
  })
}

export const useCommandStore = create<CommandStore>()((set, get) => ({
  state: IDLE,
  hover: null,
  hoverUnit: null,
  notice: null,

  send(event) {
    const controller = useSessionStore.getState().controller
    if (controller === null) return
    const result = reduceCommand(get().state, event, contextFor(controller, event.t === 'hoverSquare' ? event.square : get().hover))
    const patch: { state: CommandState; hover?: Square | null; notice?: Notice } = { state: result.state }
    if (event.t === 'hoverSquare') patch.hover = event.square
    for (const effect of result.effects) {
      switch (effect.t) {
        case 'hint':
          patch.notice = { text: effect.text, at: Date.now() }
          if (event.t === 'reject') toast(effect.text, 'warn')
          break
        case 'send': {
          const before = controller.snapshot.view
          void controller.session.dispatch(effect.intent).then(async (answer) => {
            if (answer.ok) await waitForNewView(controller, before)
            if (useSessionStore.getState().controller !== controller) return
            get().send(answer.ok ? { t: 'ack' } : { t: 'reject', message: answer.message })
          })
          break
        }
      }
    }
    if (result.state !== get().state || patch.notice !== undefined || patch.hover !== undefined) set(patch)
  },

  setHoverUnit(unitId) {
    if (get().hoverUnit !== unitId) set({ hoverUnit: unitId })
  },

  reset() {
    set({ state: IDLE, hover: null, hoverUnit: null, notice: null })
  },
}))

// Keep the command state valid as views arrive (the selected unit died, the gate closed) and reset it when the
// active match changes (the sandbox switching seats).
let watched: { controller: MatchController; stop: () => void } | null = null

useSessionStore.subscribe((store) => {
  if (watched?.controller === store.controller) return
  watched?.stop()
  watched = null
  useCommandStore.getState().reset()
  const controller = store.controller
  if (controller === null) return
  let lastView = controller.snapshot.view
  const stop = controller.subscribe(() => {
    if (controller.snapshot.view === lastView) return
    lastView = controller.snapshot.view
    useCommandStore.getState().send({ t: 'sync' })
  })
  watched = { controller, stop }
})
