// Both army lists (R33: public from the start of deployment; the whole truth at the end).

import { ROSTER_IDS, SEATS, commanderDef, tierFor, unitDef, type ArmyList, type PlayerView, type Seat } from '@coinduel/engine'
import { useSettings } from '../../store/settings'
import { COMMANDER_PORTRAITS } from '../theme'
import { Coin } from './Coin'
import { Icon } from './Icon'

export function ArmyListing({ army, title, mine }: { readonly army: ArmyList; readonly title: string; readonly mine: boolean }) {
  const clarity = useSettings((s) => s.settings.clarityMode)
  const commander = commanderDef(army.commander)
  const variant = commander.variants.find((v) => v.id === army.variant)
  return (
    <div className="army-listing">
      <h3 className="army-listing-title">{title}</h3>
      <p className="army-listing-commander" title={variant?.text ?? commander.text}>
        <Icon name={COMMANDER_PORTRAITS[army.commander]} size={18} /> {commander.name} <span className="muted small">“{commander.title}”</span>
        {variant !== undefined && <span className="tag">{variant.name}</span>}
      </p>
      <ul className="army-listing-units">
        {ROSTER_IDS.filter((t) => (army.units[t] ?? 0) > 0).map((t) => (
          <li key={t}>
            <Coin look={{ type: t, tier: tierFor(t, army.commander), mine, commander: army.commander, clarity }} size={22} />
            <span>{unitDef(t).name}</span>
            <span className="muted">×{army.units[t]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ArmiesPanel({ view, names }: { readonly view: PlayerView; readonly names: Readonly<Record<Seat, string>> }) {
  const armies = view.armies
  if (armies === null) return <p className="muted small">Both army lists are shown from the start of deployment (R33).</p>
  return (
    <div className="armies-panel">
      {[view.seat, ...SEATS.filter((s) => s !== view.seat)].map((seat) => {
        const army = armies[seat]
        return army === null ? null : <ArmyListing key={seat} army={army} title={seat === view.seat ? 'Your army' : `${names[seat]}'s army`} mine={seat === view.seat} />
      })}
    </div>
  )
}
