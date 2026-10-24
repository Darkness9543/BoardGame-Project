import { describe, expect, it } from 'vitest'
import { act, buildBattle, projectView } from '@coinduel/engine'
import { ownUnit } from '../../store/rules'
import { actionButtons, costParts, hoveredButton, hoverHintOf } from './actionButtons'
import { keyBelongsToButton } from './useBattleKeys'

describe('action bar buttons', () => {
  it('price a Charge as its base plus the surcharge, not the total plus it again (S-11.6)', () => {
    const b = buildBattle({ south: ['paladin@E5:P'], north: ['soldier@E8:S'] })
    const view = projectView(b.state, b.south)
    const paladin = ownUnit(view, b.id('P'))
    if (paladin === undefined) throw new Error('no paladin')
    const charge = actionButtons(view, paladin).find((x) => x.action.kind === 'charge')
    expect(charge).toMatchObject({ cost: 3, surcharge: 1 })
    expect(charge === undefined ? null : costParts(charge)).toEqual({ base: 2, surcharge: 1 })
  })

  it("show Holy Fervor's surcharge on the Emissary's second action, abilities included", () => {
    const b = buildBattle({ south: ['emissary@E5:E'], north: ['soldier@E8:S'] })
    const state = act(b.state, b.south, { kind: 'defend', unitId: b.id('E') }).state
    const view = projectView(state, b.south)
    const emissary = ownUnit(view, b.id('E'))
    if (emissary === undefined) throw new Error('no emissary')
    const buttons = actionButtons(view, emissary)
    const move = buttons.find((x) => x.action.kind === 'move')
    const smite = buttons.find((x) => x.action.kind === 'ability' && x.action.abilityId === 'emissary.smite')
    expect(move === undefined ? null : costParts(move)).toEqual({ base: 4, surcharge: 1 })
    expect(smite === undefined ? null : costParts(smite)).toEqual({ base: 3, surcharge: 1 })
  })

  it('read the hovered button from the current bar: nothing once the unit or the button is gone', () => {
    const b = buildBattle({ south: ['rogue@E5:R', 'soldier@G5:S'], north: ['soldier@E7:W'] })
    const view = projectView(b.state, b.south)
    const hovered = { unitId: b.id('R'), action: { kind: 'ability', abilityId: 'rogue.stealth' } } as const
    expect(hoverHintOf(hoveredButton(view, b.id('R'), hovered))).toBe('Stealth: An enemy can see this unit')
    expect(hoveredButton(view, b.id('S'), hovered)).toBeNull() // another unit on the bar
    expect(hoveredButton(view, null, hovered)).toBeNull() // nothing selected
    expect(hoveredButton(view, b.id('S'), { unitId: b.id('S'), action: { kind: 'ability', abilityId: 'rogue.stealth' } })).toBeNull() // no such button
  })

  it('leave Enter and Space to a focused button, except an action-bar button (S-12.3)', () => {
    const button = (onBar: boolean) => ({ tagName: 'BUTTON', closest: (selector: string) => (onBar && selector === '[data-action-button]' ? {} : null) })
    expect(keyBelongsToButton(button(false) as unknown as EventTarget)).toBe(true)
    expect(keyBelongsToButton(button(true) as unknown as EventTarget)).toBe(false)
    expect(keyBelongsToButton(null)).toBe(false)
  })
})
