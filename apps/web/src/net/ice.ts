// Network settings: the Trystero appId and optional TURN relays (NC 3.1). By default only Trystero's built-in
// STUN servers are used, which connects most home networks; a pair behind symmetric NATs (a phone on mobile
// data is the classic case) needs TURN.
//
// Where a free TURN key goes: sign up at metered.ca (free plan, 500 MB/month, no card), create an app, and put
// its name and API key in `apps/web/.env.local` (not committed):
//
//   VITE_METERED_APP=<app name>        e.g. coinduel  ->  https://coinduel.metered.live
//   VITE_METERED_KEY=<api key>
//
// The key is client-side by Metered's design, so it ships in the bundle; the worst case is someone using up the
// monthly quota, after which direct connections still work. Static TURN credentials can be given instead:
//
//   VITE_TURN_URLS=turn:turn.example.org:3478,turns:turn.example.org:443   VITE_TURN_USERNAME=...   VITE_TURN_CREDENTIAL=...

import { DEFAULT_APP_ID } from './constants'
import type { IceServer } from './transport'

export interface MeteredTurn {
  readonly appName: string
  readonly apiKey: string
}

export interface NetSettings {
  readonly appId: string
  /** TURN (or extra STUN) servers added to Trystero's defaults. */
  readonly iceServers: readonly IceServer[]
  /** Fetch short-lived TURN credentials from Metered when connecting. */
  readonly metered: MeteredTurn | null
}

export interface TurnEnv {
  readonly VITE_METERED_APP: string | undefined
  readonly VITE_METERED_KEY: string | undefined
  readonly VITE_TURN_URLS: string | undefined
  readonly VITE_TURN_USERNAME: string | undefined
  readonly VITE_TURN_CREDENTIAL: string | undefined
}

function viteEnv(): TurnEnv {
  const env = import.meta.env
  const read = (key: keyof TurnEnv): string | undefined => {
    const value: unknown = env[key]
    return typeof value === 'string' ? value : undefined
  }
  return {
    VITE_METERED_APP: read('VITE_METERED_APP'),
    VITE_METERED_KEY: read('VITE_METERED_KEY'),
    VITE_TURN_URLS: read('VITE_TURN_URLS'),
    VITE_TURN_USERNAME: read('VITE_TURN_USERNAME'),
    VITE_TURN_CREDENTIAL: read('VITE_TURN_CREDENTIAL'),
  }
}

function staticTurn(env: TurnEnv): IceServer[] {
  const urls = (env.VITE_TURN_URLS ?? '').split(',').map((u) => u.trim()).filter((u) => u.length > 0)
  if (urls.length === 0) return []
  return [
    {
      urls,
      ...(env.VITE_TURN_USERNAME === undefined ? {} : { username: env.VITE_TURN_USERNAME }),
      ...(env.VITE_TURN_CREDENTIAL === undefined ? {} : { credential: env.VITE_TURN_CREDENTIAL }),
    },
  ]
}

/** Settings from the build environment (see the header), overridden by `override`. */
export function netSettings(override: Partial<NetSettings> = {}, env: TurnEnv = viteEnv()): NetSettings {
  const app = env.VITE_METERED_APP
  const key = env.VITE_METERED_KEY
  return {
    appId: DEFAULT_APP_ID,
    iceServers: staticTurn(env),
    metered: app !== undefined && key !== undefined && app.length > 0 && key.length > 0 ? { appName: app, apiKey: key } : null,
    ...override,
  }
}

function isIceServer(value: unknown): value is IceServer {
  if (typeof value !== 'object' || value === null || !('urls' in value)) return false
  const urls = value.urls
  return typeof urls === 'string' || (Array.isArray(urls) && urls.every((u: unknown) => typeof u === 'string'))
}

/** Metered's credentials endpoint (callable from the browser by design). Failures fall back to STUN only. */
export async function fetchMeteredIceServers(turn: MeteredTurn): Promise<IceServer[]> {
  try {
    const url = `https://${encodeURIComponent(turn.appName)}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(turn.apiKey)}`
    const response = await fetch(url)
    if (!response.ok) return []
    const body: unknown = await response.json()
    return Array.isArray(body) ? body.filter(isIceServer) : []
  } catch {
    return []
  }
}

/** Every ICE server to hand to the transport for this connection attempt. */
export async function resolveIceServers(settings: NetSettings): Promise<IceServer[]> {
  const fetched = settings.metered === null ? [] : await fetchMeteredIceServers(settings.metered)
  return [...settings.iceServers, ...fetched]
}
