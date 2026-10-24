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
      ['ability', 'rogue.stealth', 1, true],
    ])
    expect(options[4]?.reason).toBeNull() // no enemy LOV reaches M10 (A4-05)
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
    // A unit without the ability, or an ability with no picks, offers nothing.
    expect(targetOptions(projectView(b.state, b.south), b.id('R'), 'rogue.stealth', 0, [])).toEqual([])
  })

  it("filters the last pick through the ability's own checks once the earlier picks are known", () => {
    const b = buildBattle({ south: ['priestess@M10:P', 'soldier@M11:S'] })
    const view = projectView(b.state, b.south)
    const ids = (targets: readonly { kind: string; unitId?: string }[]) => targets.map((t) => t.unitId).sort()
    // The spec alone (no picks yet): the Priestess and her neighbour, for either pick.
    expect(ids(targetOptions(view, b.id('P'), 'priestess.sharedWounds', 1, []))).toEqual([b.id('P'), b.id('S')].sort())
    // With the donor picked, the recipient must be another unit (PRI-12).
    expect(ids(targetOptions(view, b.id('P'), 'priestess.sharedWounds', 1, [{ kind: 'unit', unitId: b.id('S') }]))).toEqual([b.id('P')])
  })
})

describe('two-pick abilities need a legal pair before the action bar enables them', () => {
  const option = (b: ReturnType<typeof buildBattle>, label: string, abilityId: string) =>
    legalActions(projectView(b.state, b.south), b.id(label)).find((o) => o.kind === 'ability' && o.abilityId === abilityId)

  it('Shared wounds: a Priestess alone has no donor-recipient pair; with a neighbour she has', () => {
    const alone = buildBattle({ south: [{ type: 'priestess', at: 'M10', label: 'P', toughness: 5 }] })
    expect(option(alone, 'P', 'priestess.sharedWounds')).toMatchObject({ enabled: false, reason: 'No valid target' })
    const pair = buildBattle({ south: ['priestess@M10:P', { type: 'soldier', at: 'M11', label: 'S', toughness: 3 }] })
    expect(option(pair, 'P', 'priestess.sharedWounds')).toMatchObject({ enabled: true })
  })

  it('Julio Vernification: the only unit in range is the one it would sacrifice', () => {
    const b = buildBattle({ south: ['juliomancer@J5:J', 'footman@J6:F'] })
    expect(option(b, 'J', 'juliomancer.julioVernification')).toMatchObject({ enabled: false, reason: 'No valid target' })
    const target = buildBattle({ south: ['juliomancer@J5:J', 'footman@J6:F'], north: ['berserker@J7:B'] })
    expect(option(target, 'J', 'juliomancer.julioVernification')).toMatchObject({ enabled: true })
  })
})
