// The sandbox's "quick skirmish": a small battle already in contact on Open Field, built with the engine's scenario
// DSL, so combat and abilities can be tried at once without army building and deployment. The record goes straight
// into createSession({ mode: 'local', record }); the UI never touches its state.

import { buildBattle, startRecord, type MatchRecord, type Seat } from '@coinduel/engine'

export function skirmishRecord(names: Readonly<Record<Seat, string>>, seed: string): MatchRecord {
  const battle = buildBattle({
    south: ['commander@M2', 'paladin@K8', 'footman@J8', 'footman@I8', 'ranger@M7', 'berserker@N8', 'priestess@L7', 'soldier@O8', 'royalWizard@L5'],
    north: ['commander@M24', 'berserker@K10', 'mercenary@L9', 'mercenary@J10', 'rogue@N9', 'soldier@M11', 'paladin@O11', 'beast@P13'],
    mines: [{ owner: 'south', at: 'M9' }],
    commanders: { south: 'trill', north: 'ratasius' },
    settings: { scenarioId: 'openField', turnTimerSeconds: null, timeBankSeconds: null, devContent: false },
    seed,
  })
  const seats = { host: { ...battle.state.seats.host, name: names.host }, guest: { ...battle.state.seats.guest, name: names.guest } }
  return startRecord({ ...battle.state, seats })
}
