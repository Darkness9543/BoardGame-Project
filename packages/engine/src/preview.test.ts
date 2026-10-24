import { describe, expect, it } from 'vitest'
import { parseSquare, sameSquare, squareName } from './geometry'
import { legalActions, previewAttack, reachableSquares, targetOptions } from './preview'
import { act, buildBattle, sqs } from './testing/dsl'
import { projectView } from './view'

describe('reachableSquares (PX R1, A8-17)', () => {
  it('lists every square within Movement, through own units, never onto units', () => {
    const b = buildBattle({ south: ['paladin@M10:P', 'footman@M11'] })
    const reach = reachableSquares(projectView(b.state, b.south), b.id('P'))
    expect(reach).toHaveLength(24 - 1)
    expect(reach.some((r) => sameSquare(r.anchor, parseSquare('M11')))).toBe(false)
    expect(reach.find((r) => sameSquare(r.anchor, parseSquare('M12')))?.path.map(squareName)).toEqual(['M11', 'M12'])
  })

  it('prefers paths around known mines and flags the ones that must cross them', () => {
    const b = buildBattle({ south: ['paladin@M10:P'], mines: [{ owner: 'south', at: 'M11' }] })
    const reach = reachableSquares(projectView(b.state, b.south), b.id('P'))
    expect(reach.find((r) => sameSquare(r.anchor, parseSquare('N12')))).toMatchObject({ knownMines: 0, path: sqs('N10', 'N11', 'N12') })
    expect(reach.find((r) => sameSquare(r.anchor, parseSquare('M12')))).toMatchObject({ knownMines: 1 }) // only reachable through it
    expect(reach.find((r) => sameSquare(r.anchor, parseSquare('M11')))).toMatchObject({ knownMines: 1 })
  })

  it('knows nothing about unseen enemy mines (4.7)', () => {
    const b = buildBattle({ south: ['paladin@M10:P'], mines: [{ owner: 'north', at: 'M11' }] })
    expect(reachableSquares(projectView(b.state, b.south), b.id('P')).every((r) => r.knownMines === 0)).toBe(true)
  })
})

describe('legalActions', () => {
  it('reports costs and reasons the player can see', () => {
    const b = buildBattle({ south: ['rogue@M10:R'], north: ['footman@M12:F'] })
    const options = legalActions(projectView(b.state, b.south), b.id('R'))
    expect(options.map((o) => [o.kind, o.abilityId, o.cost, o.enabled])).toEqual([
      ['move', null, 2, true],
      ['attack', null, 2, false], // M12 is out of melee range
      ['defend', null, 2, true],
      ['charge', null, 3, true], // R26: step to M11 (Movement 2 - 1), then strike M12
      ['ability', 'rogue.stealth', 1, false],
    ])
    expect(options[4]?.reason).toBe('Stealth is not implemented yet')
    const moved = act(b.state, b.south, { kind: 'move', unitId: b.id('R'), path: sqs('L10') }).state
    expect(legalActions(projectView(moved, b.south), b.id('R')).every((o) => !o.enabled)).toBe(true)
  })

  it('disables everything outside your turn', () => {
    const b = buildBattle({ north: ['footman@M20:F'] })
    expect(legalActions(projectView(b.state, b.north), b.id('F')).every((o) => o.reason === 'Not your turn')).toBe(true)
  })
})

describe('previews', () => {
  it('forecasts a basic attack from the viewer’s knowledge', () => {
    const b = buildBattle({ south: ['berserker@M10:B'], north: [{ type: 'paladin', at: 'M11', label: 'P', defending: true }] })
    expect(previewAttack(projectView(b.state, b.south), b.id('B'), b.id('P'))?.amount).toBe(3) // ceil((8 - 2) / 2)
  })

  it('offers only squares the targeting spec allows', () => {
    const b = buildBattle({ south: ['ranger@M10:R'] })
    // Abilities that are still stubs offer nothing yet.
    expect(targetOptions(projectView(b.state, b.south), b.id('R'), 'rogue.stealth', 0, [])).toEqual([])
  })
})
