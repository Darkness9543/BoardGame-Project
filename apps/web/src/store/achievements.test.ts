import { describe, expect, it } from 'vitest'
import { act, buildBattle, parseSquare, projectView, type ArmyList, type GameResult, type PlayerView, type VisibleEvent } from '@coinduel/engine'
import {
  EMPTY_ACHIEVEMENTS,
  KEEP_STREAK_TARGET,
  finishMatch,
  lineFormationPrevented,
  loadScratch,
  parseAchievements,
  progressOf,
  saveScratch,
  scratchFromView,
  startScratch,
  trackUpdate,
  type MatchScratch,
} from './achievements'
import { memoryStore } from './storage'

const ARMY: ArmyList = { faction: 'empire', commander: 'trill', units: { footman: 20, soldier: 15, berserker: 6, priestess: 2, paladin: 5 } }
const SMALL: ArmyList = { faction: 'empire', commander: 'trill', units: { footman: 10, soldier: 5 } }
const WIN: GameResult = { winner: 'host', reason: 'conquest', turnNumber: 12 }

function setup() {
  const b = buildBattle({ south: ['commander@E1:C', 'footman@E5:F'], north: ['commander@U25:EC', 'emissary@E6:E', 'footman@F6:G'] })
  const view = projectView(b.state, 'host')
  return { b, view: { ...view, myArmy: ARMY } satisfies PlayerView }
}

function track(scratch: MatchScratch, view: PlayerView, ...events: VisibleEvent[]): MatchScratch {
  return trackUpdate(scratch, view, events)
}

describe('achievements', () => {
  it('a long enough win unlocks First Coin, Regicide, Untouchable and Exact Change', () => {
    const { view } = setup()
    const scratch = track(startScratch('host', true), view)
    const { state, unlocked } = finishMatch(EMPTY_ACHIEVEMENTS, scratch, WIN, 6, 1000)
    expect(unlocked).toEqual(['ACH-01', 'ACH-02', 'ACH-05', 'ACH-06'])
    expect(state.stats).toMatchObject({ matchesCompleted: 1, wins: 1, winsByCommander: { trill: 1 } })
    expect(state.unlocked['ACH-02']).toBe(1000)
    expect(finishMatch(state, scratch, WIN, 6, 2000).unlocked).toEqual([])
  })

  it('a win before round 3 only counts as a finished match (AC-01); the sandbox never counts', () => {
    const { view } = setup()
    expect(finishMatch(EMPTY_ACHIEVEMENTS, track(startScratch('host', true), view), WIN, 2, 1).unlocked).toEqual(['ACH-01'])
    expect(finishMatch(EMPTY_ACHIEVEMENTS, track(startScratch('host', false), view), WIN, 9, 1)).toEqual({ state: EMPTY_ACHIEVEMENTS, unlocked: [] })
  })

  it('Small Change needs only tier 1, 2 and 5 units; Untouchable is lost when the commander is hurt', () => {
    const { b, view } = setup()
    const small: PlayerView = { ...view, myArmy: SMALL }
    let scratch = track(startScratch('host', true), small)
    scratch = track(scratch, small, { type: 'unitDamaged', unitId: b.id('C'), amount: 1, toughness: 4, kind: 'attack', source: 'attack', dealerId: null, breakdown: [] })
    const { unlocked } = finishMatch(EMPTY_ACHIEVEMENTS, scratch, WIN, 5, 1)
    expect(unlocked).toContain('ACH-04')
    expect(unlocked).not.toContain('ACH-06')
  })

  it('Watch Your Step: a mine of mine kills an enemy; a take-back of that action rolls it back (TB-8)', () => {
    const { b, view } = setup()
    const base = track(startScratch('host', true), view)
    const boom = track(
      base,
      view,
      { type: 'unitMoved', unitId: b.id('G'), from: parseSquare('F6'), to: parseSquare('F5') },
      { type: 'mineExploded', mineId: 'm-1', owner: 'host', square: parseSquare('F5'), victimId: b.id('G'), trigger: 'entered' },
      { type: 'unitDied', unitId: b.id('G'), unitType: 'footman', owner: 'guest', at: parseSquare('F5'), cause: 'damage' },
    )
    expect(boom.mineKill).toBe(true)
    const undone = track(boom, view, { type: 'takebackApplied', seat: 'guest', actionSeq: 3 })
    expect(undone.mineKill).toBe(false)
    expect(undone.takebacksAccepted).toBe(1)
  })

  it('David and Goliath: a tier-1 attack finishes a tier-100 unit', () => {
    const { b, view } = setup()
    const scratch = track(
      startScratch('host', true),
      view,
      { type: 'unitDamaged', unitId: b.id('E'), amount: 1, toughness: 0, kind: 'attack', source: 'attack', dealerId: b.id('F'), breakdown: [] },
      { type: 'unitDied', unitId: b.id('E'), unitType: 'emissary', owner: 'guest', at: parseSquare('E6'), cause: 'damage' },
    )
    expect(scratch.davidAndGoliath).toBe(true)
  })

  it('King of the Hill counts own turn ends with the Keep held, and resets when it is lost', () => {
    const { view } = setup()
    const held: PlayerView = { ...view, buildings: view.buildings.map((bd) => (bd.kind === 'keep' ? { ...bd, controller: 'host' } : bd)) }
    let scratch = track(startScratch('host', true), held)
    for (let i = 0; i < KEEP_STREAK_TARGET - 1; i++) scratch = track(scratch, held, { type: 'turnEnded', seat: 'host' })
    scratch = track(scratch, view, { type: 'turnEnded', seat: 'host' })
    expect(scratch.keepStreak).toBe(0)
    scratch = track(scratch, held, { type: 'turnEnded', seat: 'host' })
    expect(scratch.bestKeepStreak).toBe(KEEP_STREAK_TARGET - 1)
    for (let i = 0; i < KEEP_STREAK_TARGET; i++) scratch = track(scratch, held, { type: 'turnEnded', seat: 'host' })
    expect(finishMatch(EMPTY_ACHIEVEMENTS, scratch, { winner: 'guest', reason: 'conquest', turnNumber: 30 }, 15, 1).unlocked).toContain('ACH-07')
  })

  it('Shield Wall adds Line Formation reductions across matches; progress and storage round-trip', () => {
    const { b, view } = setup()
    const blocked = (amount: number): VisibleEvent => ({
      type: 'unitDamaged',
      unitId: b.id('F'),
      amount: 1,
      toughness: 1,
      kind: 'attack',
      source: 'attack',
      dealerId: null,
      breakdown: [
        { step: 'base', source: 'base', delta: 1 + amount, total: 1 + amount },
        { step: 'reduction', source: 'footman.lineFormation', delta: -amount, total: 1 },
      ],
    })
    let state = EMPTY_ACHIEVEMENTS
    for (let match = 0; match < 3; match++) {
      let scratch = track(startScratch('host', true), view)
      for (let i = 0; i < 9; i++) scratch = track(scratch, view, blocked(2))
      state = finishMatch(state, scratch, { winner: 'guest', reason: 'conquest', turnNumber: 9 }, 5, 1).state
    }
    expect(state.stats.lineFormationPrevented).toBe(54)
    expect(state.unlocked['ACH-10']).toBe(1)
    expect(progressOf(state, 'ACH-10')).toEqual({ value: 50, target: 50 })
    expect(parseAchievements(JSON.parse(JSON.stringify(state)))).toEqual(state)
    expect(parseAchievements({ nonsense: true })).toEqual(EMPTY_ACHIEVEMENTS)
  })
})

describe('achievement counting fixes', () => {
  it('Shield Wall counts only what Line Formation really kept off: nothing when the floor of 1 gives it back (ACH-10)', () => {
    const b = buildBattle({ south: ['footman@E5:F', 'footman@D5', 'footman@F5'], north: ['mercenary@E6:M'], active: 'north' })
    const r = act(b.state, b.north, { kind: 'attack', unitId: b.id('M'), target: { kind: 'unit', unitId: b.id('F') } })
    const hit = r.events.find((e) => e.type === 'unitDamaged')
    const breakdown = hit?.type === 'unitDamaged' ? hit.breakdown : []
    expect(breakdown.map((s) => s.total)).toEqual([2, 0, 1]) // Mercenary 2, -2 Line Formation, floor 1
    expect(lineFormationPrevented(breakdown)).toBe(1)
    expect(lineFormationPrevented([{ step: 'base', source: 'attack', delta: 1, total: 1 }, { step: 'reduction', source: 'footman.lineFormation', delta: -2, total: -1 }, { step: 'reduction', source: 'floor', delta: 2, total: 1 }])).toBe(0)
    expect(lineFormationPrevented([{ step: 'base', source: 'attack', delta: 8, total: 8 }, { step: 'reduction', source: 'footman.lineFormation', delta: -2, total: 6 }])).toBe(2)
  })

  it('Hall of Commanders needs a real win: a round-1 resignation does not count (ACH-15, AC-01)', () => {
    const { view } = setup()
    const quick: GameResult = { winner: 'host', reason: 'resignation', turnNumber: 1 }
    const { state } = finishMatch(EMPTY_ACHIEVEMENTS, track(startScratch('host', true), view), quick, 1, 1)
    expect(state.stats).toMatchObject({ wins: 1, winsByCommander: {} })
  })

  it('credits a mine kill whose victim the explosion could not name (ACH-09, 4.8)', () => {
    const { b, view } = setup()
    const scratch = track(
      startScratch('host', true),
      view,
      { type: 'mineExploded', mineId: 'm-1', owner: 'host', square: parseSquare('E6'), victimId: null, trigger: 'entered' },
      { type: 'unitDamaged', unitId: b.id('G'), amount: 2, toughness: 0, kind: 'mine', source: 'mine', dealerId: null, breakdown: [] },
      { type: 'unitDied', unitId: b.id('G'), unitType: 'footman', owner: 'guest', at: parseSquare('F6'), cause: 'damage' },
    )
    expect(scratch.mineKill).toBe(true)
  })

  it('keeps the scratch across a reload, so Untouchable is not won after a hurt commander (ACH-06)', () => {
    const { b, view } = setup()
    const store = memoryStore()
    const hurt = track(startScratch('host', true), view, { type: 'unitDamaged', unitId: b.id('C'), amount: 1, toughness: 4, kind: 'attack', source: 'attack', dealerId: null, breakdown: [] })
    saveScratch(store, 'room-1', hurt)
    const restored = loadScratch(store, 'room-1', view)
    expect(restored?.commanderHurt).toBe(true)
    expect(loadScratch(store, 'room-2', view)).toBeNull()
    expect(loadScratch(store, 'room-1', { ...view, units: [] })).toBeNull() // another match in the same room
    const commander = view.units.find((u) => u.id === b.id('C'))
    const reloaded = { ...view, units: view.units.map((u) => (u.id === b.id('C') ? { ...u, toughness: (commander?.maxToughness ?? 5) - 1 } : u)) }
    expect(scratchFromView('host', true, reloaded).commanderHurt).toBe(true) // no saved scratch: the view tells
    expect(finishMatch(EMPTY_ACHIEVEMENTS, restored ?? hurt, WIN, 6, 1).unlocked).not.toContain('ACH-06')
  })
})
