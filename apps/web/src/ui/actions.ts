// Navigation-level actions shared by several screens (Play, join, leave, rematch).

import type { Intent } from '@coinduel/engine'
import type { Session } from '../contracts'
import { parseInviteText } from '../net'
import { profileName } from '../store/profile'
import { sessionProvider } from '../store/sessionProvider'
import { useSessionStore } from '../store/sessionStore'
import { toast } from '../store/toasts'
import { navigate } from './router'

/** Sends intents one after another; stops at the first refusal and says why. */
export async function sendAll(session: Session, intents: readonly Intent[]): Promise<boolean> {
  for (const intent of intents) {
    const result = await session.dispatch(intent)
    if (!result.ok) {
      toast(result.message, 'warn')
      return false
    }
  }
  return true
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

/** MM-04: Play creates a lobby at once and shows its invite link. */
export async function hostGame(): Promise<void> {
  try {
    const { roomId, session } = await sessionProvider().host({ name: profileName() })
    useSessionStore.getState().attachOnline(roomId, session)
    navigate({ name: 'lobby', roomId })
  } catch (error) {
    toast(`Could not create a game: ${message(error)}`, 'bad')
  }
}

/** MM-03: a pasted link, "#/join/ROOM/SECRET" or "ROOM/SECRET" opens the join screen. */
export function openInvite(text: string): boolean {
  const invite = parseInviteText(text)
  if (invite === null) return false
  navigate({ name: 'join', roomId: invite.roomId, secret: invite.secret })
  return true
}

export function leaveMatch(): void {
  const { roomId, mode } = useSessionStore.getState()
  if (mode === 'online' && roomId !== null) sessionProvider().leave(roomId)
  useSessionStore.getState().detach()
  navigate({ name: mode === 'sandbox' ? 'sandbox' : 'menu' })
}

/** PX LB-12: a new match with the same players and settings: the host's room online, or the sandbox. */
export async function rematch(): Promise<boolean> {
  const { roomId, controller, mode, sandbox } = useSessionStore.getState()
  if (controller === null) return false
  try {
    if (mode === 'sandbox' && sandbox !== null) {
      const result = await sandbox.session.rematch()
      if (!result.ok) toast(result.message, 'warn')
      return result.ok
    }
    if (mode !== 'online' || roomId === null) return false
    if (controller.session.mode !== 'host') {
      toast('Ask the host to start a rematch', 'info')
      return false
    }
    await sessionProvider().rematch(roomId)
    navigate({ name: 'lobby', roomId })
    return true
  } catch (error) {
    toast(message(error), 'warn')
    return false
  }
}
