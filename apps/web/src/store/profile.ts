// The local profile (PX G-05): a display name and a random id, created on first run. No accounts.

import { create } from 'zustand'
import { randomId } from './ids'
import { appStore, isRecord, numberOr, readJson, writeJson, type KeyValueStore } from './storage'

export interface Profile {
  readonly id: string
  readonly name: string
  readonly createdAt: number
}

const KEY = 'profile.v1'
export const NAME_MIN = 2
export const NAME_MAX = 20

/** 2 to 20 characters: letters, digits, spaces, '-' and '_' (G-05). */
export function nameProblem(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < NAME_MIN) return `At least ${NAME_MIN} characters`
  if (trimmed.length > NAME_MAX) return `At most ${NAME_MAX} characters`
  if (!/^[\p{L}\p{N} _-]+$/u.test(trimmed)) return 'Letters, digits, spaces, - and _ only'
  return null
}

const ADJECTIVES = ['Copper', 'Silver', 'Gilded', 'Iron', 'Argent', 'Azure', 'Gules', 'Sable', 'Minted', 'Milled', 'Bronze', 'Golden']
const NOUNS = ['Duke', 'Baron', 'Marshal', 'Warden', 'Herald', 'Sentinel', 'Captain', 'Regent', 'Squire', 'Reeve', 'Knight', 'Envoy']

export function suggestName(random: () => number = Math.random): string {
  const pick = (list: readonly string[]): string => list[Math.floor(random() * list.length) % list.length] ?? list[0] ?? 'Player'
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`
}

function parseProfile(raw: unknown): Profile | null {
  if (!isRecord(raw) || typeof raw['id'] !== 'string' || typeof raw['name'] !== 'string') return null
  if (nameProblem(raw['name']) !== null) return null
  return { id: raw['id'], name: raw['name'].trim(), createdAt: numberOr(raw['createdAt'], 0) }
}

export function loadProfile(store: KeyValueStore = appStore()): Profile | null {
  return readJson<Profile | null>(store, KEY, parseProfile, null)
}

export function saveProfile(profile: Profile, store: KeyValueStore = appStore()): void {
  writeJson(store, KEY, profile)
}

interface ProfileStore {
  readonly profile: Profile | null
  /** Creates the profile on first use. */
  setName(name: string): void
}

export const useProfile = create<ProfileStore>()((set, get) => ({
  profile: loadProfile(),
  setName(name) {
    const current = get().profile
    const profile: Profile = current === null ? { id: randomId('p'), name: name.trim(), createdAt: Date.now() } : { ...current, name: name.trim() }
    saveProfile(profile)
    set({ profile })
  },
}))

export function profileName(): string {
  return useProfile.getState().profile?.name ?? 'Player'
}
