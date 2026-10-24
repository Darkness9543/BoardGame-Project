import { describe, expect, it } from 'vitest'
import { unitDef } from '@coinduel/engine'
import { previewArmy } from './armyPreview'

describe('army preview', () => {
  it('reads every unit from a scratch board and applies the commander price rules', () => {
    const trill = previewArmy('trill', null)
    expect(trill.units.size).toBe(14)
    expect(trill.units.get('paladin')).toMatchObject({ cost: 20, power: unitDef('paladin').power })
    const sabrina = previewArmy('sabrina', null)
    expect(sabrina.units.get('artificer')).toMatchObject({ cost: 10, tier: 10, revoked: ['artificer.tripMine'] })
    expect(sabrina.units.get('paladin')?.cost).toBe(24)
    expect(previewArmy('kulega', null).units.get('paladin')?.granted).toEqual(['kulega.finePrint'])
    expect(previewArmy('babaYaga', 'mend').units.get('mercenary')?.granted).toEqual(['babaYaga.mend'])
    expect(previewArmy('queso', null).commander.ap).toBe(2)
  })
})
