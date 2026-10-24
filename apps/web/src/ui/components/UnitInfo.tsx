// Stat lines and ability lists, worded from the content tables (R35: text from data, S26 fixes applied).

import { abilityData, abilityText, hasAbilityData, type AbilityData } from '@coinduel/engine'
import { UI_ICONS, type UiIcon } from '../theme'
import { Icon } from './Icon'

export interface StatItem {
  readonly icon: UiIcon
  readonly label: string
  readonly value: string | number
  /** The value differs from the printed one (a commander passive, an aura). */
  readonly changed?: 'up' | 'down'
  readonly title?: string
}

export function StatLine({ items, compact }: { readonly items: readonly StatItem[]; readonly compact?: boolean }) {
  return (
    <ul className={compact === true ? 'stats stats-compact' : 'stats'}>
      {items.map((s) => (
        <li key={s.label} className={s.changed === undefined ? 'stat' : `stat stat-${s.changed}`} title={s.title ?? s.label}>
          <Icon name={UI_ICONS[s.icon]} size={compact === true ? 13 : 15} />
          <span className="stat-value">{s.value}</span>
          {compact !== true && <span className="stat-label">{s.label}</span>}
        </li>
      ))}
    </ul>
  )
}

/** The AP price tag, or null for abilities that are never declared (passives, automatic triggers). */
function costText(data: AbilityData, unitAp: number): string | null {
  if (data.apCost === null) return null
  const ap = data.apCost === 'unit' ? unitAp : data.apCost
  return ap === 0 ? 'Free' : `${ap} AP`
}

const KIND_LABEL: Readonly<Record<AbilityData['kind'], string>> = { passive: 'Passive', active: 'Active', triggered: 'Triggered' }

export function AbilityList({
  abilities,
  unitAp,
  revoked = [],
  granted = [],
  grantedBy,
  status,
}: {
  readonly abilities: readonly string[]
  readonly unitAp: number
  readonly revoked?: readonly string[]
  readonly granted?: readonly string[]
  readonly grantedBy?: string
  /** A live state line per ability (cooldown, used this turn), battle only. */
  readonly status?: (id: string) => string | null
}) {
  const ids = [...abilities, ...revoked.filter((r) => !abilities.includes(r))]
  if (ids.length === 0) return <p className="muted small">No abilities.</p>
  return (
    <ul className="abilities">
      {ids.map((id) => {
        if (!hasAbilityData(id)) return null
        const data = abilityData(id)
        const off = revoked.includes(id)
        const line = status?.(id) ?? null
        const cost = costText(data, unitAp)
        return (
          <li key={id} className={off ? 'ability ability-off' : 'ability'}>
            <div className="ability-head">
              <span className="ability-name">{data.name}</span>
              <span className={`tag tag-${data.kind}`}>{KIND_LABEL[data.kind]}</span>
              {cost !== null && <span className="tag">{cost}</span>}
              {data.cooldown > 0 && <span className="tag">CD {data.cooldown}</span>}
              {granted.includes(id) && <span className="tag tag-granted">{grantedBy === undefined ? 'Granted' : `From ${grantedBy}`}</span>}
              {off && <span className="tag tag-off">{grantedBy === undefined ? 'Disabled' : `Disabled by ${grantedBy}`}</span>}
            </div>
            <p className="ability-text">{abilityText(id)}</p>
            {line !== null && <p className="ability-status">{line}</p>}
          </li>
        )
      })}
    </ul>
  )
}
