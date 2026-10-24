// The app's online session provider (net/provider.ts: host, join, resume, leave, rematch), created once with the
// app's storage. main.tsx registers it with the deployed build id; tests may register one on a fake network.

import { netProvider, type NetProvider } from '../net'
import { appStore } from './storage'

let current: NetProvider | null = null

export function setSessionProvider(provider: NetProvider): void {
  current = provider
}

export function sessionProvider(): NetProvider {
  current ??= netProvider({ storage: appStore() })
  return current
}
