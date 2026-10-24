// Hash routes (PX 1.4, NC 7.4): a static host needs no rewrites, and an invite fragment never reaches a server.

import { useSyncExternalStore } from 'react'

export type Route =
  | { readonly name: 'menu' }
  | { readonly name: 'armies' }
  | { readonly name: 'army'; readonly id: string }
  | { readonly name: 'achievements' }
  | { readonly name: 'options' }
  | { readonly name: 'lobby'; readonly roomId: string }
  | { readonly name: 'join'; readonly roomId: string; readonly secret: string }
  | { readonly name: 'play'; readonly roomId: string }
  | { readonly name: 'sandbox' }
  | { readonly name: 'render' }
  | { readonly name: 'notFound'; readonly path: string }

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/'
  const parts = path.split('/').filter((p) => p !== '').map(decodeURIComponent)
  const [first, second, third] = parts
  switch (first) {
    case undefined:
      return { name: 'menu' }
    case 'armies':
      return second === undefined ? { name: 'armies' } : { name: 'army', id: second }
    case 'achievements':
      return { name: 'achievements' }
    case 'options':
      return { name: 'options' }
    case 'lobby':
    case 'host':
      return second === undefined ? { name: 'notFound', path } : { name: 'lobby', roomId: second }
    case 'join':
      return second === undefined || third === undefined ? { name: 'notFound', path } : { name: 'join', roomId: second, secret: third }
    case 'play':
      return second === undefined ? { name: 'notFound', path } : { name: 'play', roomId: second }
    case 'dev':
      if (second === 'sandbox') return { name: 'sandbox' }
      if (second === 'render') return { name: 'render' }
      return { name: 'notFound', path }
    default:
      return { name: 'notFound', path }
  }
}

export function routeHash(route: Route): string {
  switch (route.name) {
    case 'menu':
      return '#/'
    case 'armies':
      return '#/armies'
    case 'army':
      return `#/armies/${encodeURIComponent(route.id)}`
    case 'achievements':
      return '#/achievements'
    case 'options':
      return '#/options'
    case 'lobby':
      return `#/lobby/${route.roomId}`
    case 'join':
      return `#/join/${route.roomId}/${route.secret}`
    case 'play':
      return `#/play/${route.roomId}`
    case 'sandbox':
      return '#/dev/sandbox'
    case 'render':
      return '#/dev/render'
    case 'notFound':
      return `#${route.path}`
  }
}

export function navigate(route: Route, options: { readonly replace?: boolean } = {}): void {
  const hash = routeHash(route)
  if (location.hash === hash) return
  if (options.replace === true) history.replaceState(null, '', hash)
  else location.hash = hash
  if (options.replace === true) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash, () => '')
  return parseRoute(hash)
}
