import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, checkArmy, type ArmyList } from '@coinduel/engine'
import {
  STARTER_ARMIES,
  defaultArmyName,
  deleteArmy,
  duplicateArmy,
  loadArmies,
  markArmyUsed,
  newSavedArmy,
  parseArmyList,
  sameArmy,
  saveArmies,
  sortArmies,
  updateArmy,
  upsertArmy,
} from './armies'
import { armyToText, parseArmyText } from './armyText'
import { memoryStore, STORAGE_PREFIX } from './storage'

const ARMY: ArmyList = { faction: 'lojrar', commander: 'babaYaga', variant: 'hex-ward', units: { mercenary: 12, ranger: 4, beast: 1 } }

describe('saved armies', () => {
  it('round-trips through storage and survives corrupt entries', () => {
    const store = memoryStore()
    const a = newSavedArmy(ARMY, '  My   swarm ', 200, 1, 'army-a')
    const b = newSavedArmy({ faction: 'empire', commander: 'trill', units: { footman: 3 } }, 'Wall', 200, 2, 'army-b')
    saveArmies([a, b], store)
    expect(loadArmies(store)).toEqual([a, b])
    expect(a.name).toBe('My swarm')
    store.set(`${STORAGE_PREFIX}armies.v1`, JSON.stringify([a, { id: 'x', army: { faction: 'nope' } }, 'junk']))
    expect(loadArmies(store)).toEqual([a])
    store.set(`${STORAGE_PREFIX}armies.v1`, '{not json')
    expect(loadArmies(store)).toEqual([])
  })

  it('creates, renames, duplicates, deletes and sorts by last use', () => {
    const a = newSavedArmy(ARMY, 'A', 200, 1, 'a')
    const b = newSavedArmy(ARMY, 'B', 200, 2, 'b')
    let list = upsertArmy(upsertArmy([], a), b)
    expect(list.map((x) => x.id)).toEqual(['b', 'a'])
    list = updateArmy(list, 'a', { name: 'Renamed', army: { ...ARMY, units: { mercenary: 1 } } }, 5)
    expect(list.find((x) => x.id === 'a')).toMatchObject({ name: 'Renamed', updatedAt: 5 })
    list = duplicateArmy(list, 'a', 6, 'c')
    expect(list.map((x) => x.id)).toEqual(['b', 'a', 'c'])
    expect(list.find((x) => x.id === 'c')?.name).toBe('Renamed copy')
    list = markArmyUsed(list, 'c', 10)
    expect(sortArmies(list).map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(deleteArmy(list, 'a').map((x) => x.id)).toEqual(['b', 'c'])
    expect(defaultArmyName('babaYaga', [{ ...a, name: 'Baba Yaga army 1' }])).toBe('Baba Yaga army 2')
  })

  it('parses only well-formed army lists and compares them by content', () => {
    expect(parseArmyList({ faction: 'empire', commander: 'kulega', units: { footman: 2, bogus: 3, soldier: -1, paladin: 0 } })).toEqual({ faction: 'empire', commander: 'kulega', units: { footman: 2 } })
    expect(parseArmyList({ faction: 'empire', commander: 'nobody', units: {} })).toBeNull()
    expect(sameArmy(ARMY, { ...ARMY, units: { ranger: 4, beast: 1, mercenary: 12 } })).toBe(true)
    expect(sameArmy(ARMY, { ...ARMY, variant: 'mend' })).toBe(false)
  })

  it('every starter army is legal at the default budget on both scenarios (AB-01)', () => {
    for (const starter of STARTER_ARMIES) {
      for (const scenarioId of ['crossroads', 'openField'] as const) {
        const check = checkArmy(starter.army, { ...DEFAULT_SETTINGS, scenarioId })
        expect(check.errors, `${starter.name} on ${scenarioId}`).toEqual([])
      }
    }
  })
})

describe('army text import and export', () => {
  it('round-trips, variant included', () => {
    const text = armyToText('Hexed', ARMY)
    expect(text).toContain('variant: hex-ward')
    expect(parseArmyText(text)).toEqual({ ok: true, name: 'Hexed', army: ARMY })
  })

  it('accepts names, loose separators and pasted JSON', () => {
    const text = 'faction: Lojrar Clan\ncommander: Baba Yaga\nvariant: Hex Ward\nunits: 12 x Mercenary; Beast of Knorund 1, ranger: 4'
    expect(parseArmyText(text)).toEqual({ ok: true, name: null, army: ARMY })
    expect(parseArmyText(JSON.stringify(ARMY))).toEqual({ ok: true, name: null, army: ARMY })
  })

  it('explains what is wrong', () => {
    expect(parseArmyText('')).toEqual({ ok: false, error: 'Paste an army first' })
    expect(parseArmyText('commander: trill')).toEqual({ ok: false, error: 'Missing "faction:" line' })
    expect(parseArmyText('faction: empire\ncommander: trill\nunits: dragon 3')).toEqual({ ok: false, error: 'Unknown unit "dragon"' })
    expect(parseArmyText('faction: empire\ncommander: trill\nunits: footman')).toEqual({ ok: false, error: 'Can\'t read "footman" (write it as "footman 10")' })
  })
})
