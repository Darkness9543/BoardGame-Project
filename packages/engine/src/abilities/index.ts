// Every ability definition, one file per unit and per commander. Adding a file here is the only wiring an
// ability needs; registry.ts indexes this list by id.

import { babaYagaAbilities } from './commanders/babaYaga'
import { kulegaAbilities } from './commanders/kulega'
import { quesoAbilities } from './commanders/queso'
import { ratasiusAbilities } from './commanders/ratasius'
import { sabrinaAbilities } from './commanders/sabrina'
import { trillAbilities } from './commanders/trill'
import type { AbilityDefinition } from './types'
import { artificerAbilities } from './units/artificer'
import { beastAbilities } from './units/beast'
import { berserkerAbilities } from './units/berserker'
import { emissaryAbilities } from './units/emissary'
import { footmanAbilities } from './units/footman'
import { juliomancerAbilities } from './units/juliomancer'
import { mercenaryAbilities } from './units/mercenary'
import { paladinAbilities } from './units/paladin'
import { priestessAbilities } from './units/priestess'
import { rangerAbilities } from './units/ranger'
import { rogueAbilities } from './units/rogue'
import { royalWizardAbilities } from './units/royalWizard'
import { scourgeAbilities } from './units/scourge'
import { soldierAbilities } from './units/soldier'

export const ABILITY_DEFINITIONS: readonly AbilityDefinition[] = [
  ...footmanAbilities,
  ...mercenaryAbilities,
  ...soldierAbilities,
  ...rangerAbilities,
  ...berserkerAbilities,
  ...rogueAbilities,
  ...priestessAbilities,
  ...juliomancerAbilities,
  ...paladinAbilities,
  ...artificerAbilities,
  ...royalWizardAbilities,
  ...beastAbilities,
  ...emissaryAbilities,
  ...scourgeAbilities,
  ...trillAbilities,
  ...kulegaAbilities,
  ...sabrinaAbilities,
  ...babaYagaAbilities,
  ...ratasiusAbilities,
  ...quesoAbilities,
]
