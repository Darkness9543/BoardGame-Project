// Battle keyboard (UX 17.2, adapted to the brief: Tab / Shift+Tab cycle the units that can still act). Keys are
// ignored while typing and while a dialog has focus; the take-back Accept button deliberately has no key.

import { useEffect } from 'react'
import type { MarchDirection, Side } from '@coinduel/engine'
import type { CommandEvent, CommandState } from '../../store/command'
import { useCommandStore } from '../../store/commandStore'
import type { MatchController } from '../../store/matchController'
import { myCommander, ownUnit } from '../../store/rules'
import { useUiState } from '../../store/uiState'
import { actionButtons } from './actionButtons'

/** Screen arrows to absolute directions: North sees the board rotated 180 degrees (A1-15). */
export function arrowDirection(key: string, side: Side | null): MarchDirection | null {
  const screen: Readonly<Record<string, MarchDirection>> = { ArrowUp: 'north', ArrowDown: 'south', ArrowLeft: 'west', ArrowRight: 'east' }
  const flip: Readonly<Record<MarchDirection, MarchDirection>> = { north: 'south', south: 'north', east: 'west', west: 'east' }
  const direction = screen[key]
  if (direction === undefined) return null
  return side === 'north' ? flip[direction] : direction
}

/**
 * Enter and Space on a focused button are that button's own click, except on the action bar: there they confirm the
 * preview the button opened, rather than clicking it again (S-12.3).
 */
export function keyBelongsToButton(target: EventTarget | null): boolean {
  const element = target as { readonly tagName?: unknown; closest?(selector: string): unknown } | null
  return element?.tagName === 'BUTTON' && element.closest?.('[data-action-button]') == null
}

/** Typing in a field, or inside a modal dialog; the board's own popovers (preview, mine prompt) let keys through. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true
  return target.closest('[role="dialog"], [role="alertdialog"]') !== null && target.closest('[data-keys-pass]') === null
}

export function useBattleKeys(controller: MatchController, state: CommandState, overlayOpen: boolean): void {
  const send = useCommandStore((s) => s.send)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUiState.getState()
      const snap = controller.snapshot
      const view = snap.view
      // A focused button handles Enter and Space itself (its click), so they aren't sent twice.
      if ((e.key === 'Enter' || e.key === ' ') && !e.ctrlKey && !e.metaKey && keyBelongsToButton(e.target)) return
      if (e.key === '?' && !typing(e.target)) {
        ui.setShortcuts(!ui.shortcutsOpen)
        e.preventDefault()
        return
      }
      if (overlayOpen || typing(e.target)) return
      const fire = (event: CommandEvent) => {
        e.preventDefault()
        send(event)
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') {
          e.preventDefault()
          document.querySelector<HTMLButtonElement>('[data-end-turn]')?.click()
        } else if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault()
          document.querySelector<HTMLButtonElement>('[data-takeback]')?.click()
        }
        return
      }
      if (e.altKey) return
      if (snap.playback.playing && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        controller.skipPlayback()
        return
      }
      const working = state.t === 'targeting' || state.t === 'confirming' ? state : null
      if (working !== null && working.action.kind === 'march') {
        const direction = arrowDirection(e.key, view.side)
        if (direction !== null) return fire({ t: 'marchDirection', direction })
      }
      switch (e.key) {
        case 'Escape':
          return fire({ t: 'cancel' })
        case 'Enter':
        case ' ':
          return fire({ t: 'confirm' })
        case 'Tab':
          return fire({ t: 'cycleUnit', delta: e.shiftKey ? -1 : 1 })
        case 'Backspace':
          return fire({ t: 'back' })
        case '[':
          return fire({ t: 'cycleTarget', delta: -1 })
        case ']':
          return fire({ t: 'cycleTarget', delta: 1 })
        case 'v':
        case 'V':
          e.preventDefault()
          return ui.toggleCamera()
        case 't':
        case 'T':
          e.preventDefault()
          return ui.toggleThreat()
        case 'l':
        case 'L':
          e.preventDefault()
          return ui.toggleSide()
        case 'n':
        case 'N':
          return fire({ t: 'cycleUnit', delta: 1 })
        case 'h':
        case 'H':
        case 'Home': {
          const commander = myCommander(view)
          if (commander !== undefined) fire({ t: 'select', unitId: commander.id })
          if (commander?.anchor != null) ui.setFocus(commander.anchor)
          return
        }
        case 'f':
        case 'F': {
          const id = state.t === 'idle' || state.t === 'inspect' ? null : state.unitId
          const unit = ownUnit(view, id)
          if (unit?.anchor != null) ui.setFocus(unit.anchor)
          return
        }
        default:
          break
      }
      if (state.t === 'hazard' && (e.key === 'm' || e.key === 'M')) return fire({ t: 'hazardAccept' })
      const unitId = state.t === 'idle' || state.t === 'inspect' ? null : state.unitId
      const unit = ownUnit(view, unitId)
      if (unit === undefined) return
      const button = actionButtons(view, unit).find((b) => b.key === e.key.toUpperCase())
      if (button !== undefined) fire({ t: 'action', action: button.action })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [controller, state, overlayOpen, send])
}
