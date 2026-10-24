// Asset lookup for the 3D board (the table is documented in README.md). Symbols come from the theme, files from
// public/assets (listed in assets/manifest.json). Every lookup has a fallback: a letter glyph for a missing icon,
// procedural geometry for a missing model, so an absent or broken file never breaks the board.

import { useEffect, useState } from 'react'
import { unitDef, type BlockerKind, type BuildingKind, type CommanderId, type UnitTypeId } from '@coinduel/engine'
import { COMMANDER_PORTRAITS, UNIT_SYMBOLS, type KayKitColour } from '../theme'

/** Vite's base ('./' in this app), so the static build works from any sub-path. */
const BASE_URL: string = import.meta.env.BASE_URL

export function assetUrl(path: string): string {
  return `${BASE_URL}${path}`
}

export function iconPath(name: string): string {
  return `assets/icons/clean/${name}.svg`
}

const SYMBOLS: Readonly<Record<string, string>> = UNIT_SYMBOLS

/** Icon file name for a unit type, looked up by UnitDef.symbol. */
export function unitIcon(type: UnitTypeId): string | null {
  return SYMBOLS[unitDef(type).symbol] ?? null
}

/** The commander's face shows its portrait (research-art 4.3); an unknown commander falls back to the king. */
export function commanderIcon(commander: CommanderId | null): string {
  return commander === null ? UNIT_SYMBOLS.commander : COMMANDER_PORTRAITS[commander]
}

/** Fallback glyph: the initials of the unit's name ("Royal Wizard" -> "RW", "Footman" -> "F"). */
export function unitGlyph(type: UnitTypeId): string {
  const words = unitDef(type)
    .name.split(/[\s-]+/)
    .filter((w) => /^[A-Z]/.test(w))
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
}

const KAYKIT = 'assets/models/kaykit-medieval-hexagon'

/** KayKit Keep (K1b) and Market (M1) models in a team colour (research-art 9.1). */
export function buildingModelPath(kind: BuildingKind, colour: KayKitColour): string {
  switch (kind) {
    case 'keep':
      return `${KAYKIT}/building_castle_${colour}.gltf`
    case 'market':
      return `${KAYKIT}/building_market_${colour}.gltf`
  }
}

/** Blocker models (R36: tall blockers are drawn taller). */
export const BLOCKER_MODEL_PATHS: Readonly<Record<BlockerKind, string>> = {
  low: 'assets/models/kenney-castle-kit/rocks-large.glb',
  tall: 'assets/models/kenney-nature-kit/rock_tallA.glb',
}

let manifest: Promise<ReadonlySet<string>> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** The paths listed in public/assets/manifest.json (an empty set if it is missing or malformed). */
export function loadAssetManifest(): Promise<ReadonlySet<string>> {
  manifest ??= fetch(assetUrl('assets/manifest.json'))
    .then((res) => (res.ok ? res.json() : []))
    .then((json: unknown) => {
      const paths = new Set<string>()
      if (Array.isArray(json)) for (const entry of json) if (isRecord(entry) && typeof entry['path'] === 'string') paths.add(entry['path'])
      return paths
    })
    .catch(() => new Set<string>())
  return manifest
}

/** null while the manifest loads. */
export function useAssetManifest(): ReadonlySet<string> | null {
  const [paths, setPaths] = useState<ReadonlySet<string> | null>(null)
  useEffect(() => {
    let live = true
    void loadAssetManifest().then((p) => {
      if (live) setPaths(p)
    })
    return () => {
      live = false
    }
  }, [])
  return paths
}
