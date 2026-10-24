import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, ROSTER_IDS, availableRoster, checkArmy, type ArmyList } from '@coinduel/engine'
import { withBanner, withUnits } from './builderModel'

describe('army builder model (R43: mixed armies, cosmetic banner)', () => {
  it('offers every one of the 14 units under either banner', () => {
    expect(availableRoster('empire')).toEqual(ROSTER_IDS)
    expect(availableRoster('lojrar')).toEqual(ROSTER_IDS)
  })

  it('builds a mixed army that the engine accepts, and keeps its units when the banner changes', () => {
    let army: ArmyList = { faction: 'empire', commander: 'trill', units: {} }
    army = withUnits(withUnits(army, 'footman', 2), 'mercenary', 2)
    expect(checkArmy(army, DEFAULT_SETTINGS).ok).toBe(true)
    const lojrar = withBanner(army, 'lojrar')
    expect(lojrar).toEqual({ faction: 'lojrar', commander: 'trill', units: { footman: 2, mercenary: 2 } })
    expect(checkArmy(lojrar, DEFAULT_SETTINGS).ok).toBe(true)
    expect(withBanner(lojrar, 'lojrar')).toBe(lojrar)
  })
})
