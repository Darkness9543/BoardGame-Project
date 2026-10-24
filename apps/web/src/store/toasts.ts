// Short notices (UX S-5.8): top right, fade after a few seconds, optional squares to show on the board.

import { create } from 'zustand'
import type { Square } from '@coinduel/engine'

export type ToastTone = 'info' | 'good' | 'warn' | 'bad'

export interface Toast {
  readonly id: number
  readonly text: string
  readonly tone: ToastTone
  readonly squares: readonly Square[]
}

export const TOAST_MS = 4200
const MAX_TOASTS = 5

interface ToastStore {
  readonly toasts: readonly Toast[]
  push(text: string, tone?: ToastTone, squares?: readonly Square[]): void
  dismiss(id: number): void
}

let nextId = 1

export const useToasts = create<ToastStore>()((set, get) => ({
  toasts: [],
  push(text, tone = 'info', squares = []) {
    const last = get().toasts[get().toasts.length - 1]
    if (last !== undefined && last.text === text) return
    const toast: Toast = { id: nextId++, text, tone, squares }
    set({ toasts: [...get().toasts, toast].slice(-MAX_TOASTS) })
    setTimeout(() => get().dismiss(toast.id), TOAST_MS)
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },
}))

export function toast(text: string, tone: ToastTone = 'info', squares: readonly Square[] = []): void {
  useToasts.getState().push(text, tone, squares)
}
