// Army builder pieces (PX S04): unit tiles with steppers, the commander picker (R7: any commander leads either
// faction; R11: Baba Yaga needs a variant) and the live summary (budget, 50-unit cap, zone fit, AP needs).

import { useState } from 'react'
import {
  APPROACH_BOOST,
  ARMY_UNIT_CAP,
  abilityData,
  hasAbilityData,
  COMMANDERS,
  COMMANDER_FACTION_LOCK,
  apForRound,
  armyUnitCount,
  commanderDef,
  groupFaction,
  unitDef,
  zoneCapacity,
  type ArmyCheck,
  type ArmyList,
  type CommanderId,
  type FactionId,
  type MatchSettings,
  type RosterUnitId,
} from '@coinduel/engine'
import { previewArmy, type UnitPreview } from '../../store/armyPreview'
import { Coin } from '../components/Coin'
import { Icon } from '../components/Icon'
import { AbilityList, StatLine, type StatItem } from '../components/UnitInfo'
import { COMMANDER_PORTRAITS } from '../theme'

export function Stepper({ value, onChange, disabled, label }: { readonly value: number; readonly onChange: (n: number) => void; readonly disabled: boolean; readonly label: string }) {
  const step = (delta: number, shift: boolean) => onChange(Math.max(0, value + delta * (shift ? 5 : 1)))
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper-btn" disabled={disabled || value === 0} onClick={(e) => step(-1, e.shiftKey)} aria-label={`One fewer ${label}`} title="Shift+click: 5 at a time">
        −
      </button>
      <input
        className="stepper-input"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        aria-label={`${label} count`}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value.replace(/\D/g, ''), 10)
          onChange(Number.isFinite(n) ? Math.min(999, n) : 0)
        }}
        onFocus={(e) => e.target.select()}
      />
      <button type="button" className="stepper-btn" disabled={disabled} onClick={(e) => step(1, e.shiftKey)} aria-label={`One more ${label}`} title="Shift+click: 5 at a time">
        +
      </button>
    </div>
  )
}

/** Marks a stat that differs from the printed line (a commander passive). */
function changed(now: number, printed: number): { readonly changed?: 'up' | 'down' } {
  return now > printed ? { changed: 'up' } : now < printed ? { changed: 'down' } : {}
}

function statsOf(p: UnitPreview): StatItem[] {
  const def = unitDef(p.type)
  const items: StatItem[] = [
    { icon: 'power', label: 'Power', value: p.power, ...changed(p.power, def.power) },
    { icon: 'toughness', label: 'Toughness', value: p.toughness, ...changed(p.toughness, def.toughness) },
    { icon: 'lov', label: 'Vision (LOV)', value: p.lov, ...changed(p.lov, def.lov) },
    { icon: 'movement', label: 'Movement', value: p.movement, ...changed(p.movement, def.movement) },
    { icon: 'ap', label: 'AP per action', value: p.ap },
  ]
  if (p.attackRange > 1) items.push({ icon: 'range', label: 'Attack range', value: p.attackRange })
  return items
}

export function UnitTile({
  preview,
  count,
  onChange,
  enabled,
  commander,
  clarity,
}: {
  readonly preview: UnitPreview
  readonly count: number
  readonly onChange: (n: number) => void
  readonly enabled: boolean
  readonly commander: CommanderId
  readonly clarity: boolean
}) {
  const def = unitDef(preview.type)
  const [open, setOpen] = useState(false)
  const repriced = preview.cost !== preview.baseCost
  return (
    <article className={`unit-tile${enabled ? '' : ' unit-tile-off'}${count > 0 ? ' unit-tile-picked' : ''}`} aria-label={def.name}>
      <header className="unit-tile-head">
        <Coin look={{ type: preview.type, tier: preview.tier, mine: true, commander, clarity }} size={46} />
        <div className="unit-tile-title">
          <h3>{def.name}</h3>
          <span className="muted small">
            Tier {preview.tier ?? '–'} ·{' '}
            {repriced ? (
              <span className="repriced" title={`${commanderDef(commander).name} changes this unit's cost`}>
                <s>{preview.baseCost}</s> → {preview.cost}
              </span>
            ) : (
              preview.cost
            )}{' '}
            coins
          </span>
        </div>
        {count > 0 && <span className="unit-tile-count">×{count}</span>}
      </header>
      <StatLine items={statsOf(preview)} compact />
      <div className="unit-tile-tags">
        {def.size === 2 && <span className="tag">Size 2 (2×2)</span>}
        {def.vanguard && <span className="tag tag-granted" title="May also deploy in the 2 extended rows (A5-04)">Vanguard</span>}
        {preview.abilities.map((id) => (
          <button key={id} type="button" className="tag tag-link" onClick={() => setOpen((o) => !o)}>
            {hasAbilityData(id) ? abilityData(id).name : id}
          </button>
        ))}
      </div>
      {open && <AbilityList abilities={preview.abilities} unitAp={preview.ap} revoked={preview.revoked} granted={preview.granted} grantedBy={commanderDef(commander).name} />}
      <footer className="unit-tile-foot">
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide abilities' : 'Abilities'}
        </button>
        <Stepper value={count} onChange={onChange} disabled={!enabled} label={def.name} />
      </footer>
    </article>
  )
}

function selectableCommanders(faction: FactionId): readonly CommanderId[] {
  // R7: COMMANDER_FACTION_LOCK is off, so every selectable commander leads either faction.
  return COMMANDERS.filter((c) => c.selectable && (!COMMANDER_FACTION_LOCK || groupFaction(c.group) === faction)).map((c) => c.id)
}

export function CommanderPicker({
  faction,
  commander,
  variant,
  onPick,
}: {
  readonly faction: FactionId
  readonly commander: CommanderId
  readonly variant: string | null
  readonly onPick: (commander: CommanderId, variant: string | null) => void
}) {
  const def = commanderDef(commander)
  const stats = previewArmy(commander, variant).commander
  return (
    <section className="commander-picker" aria-label="Commander">
      <h2 className="section-title">1 · Commander</h2>
      <div className="commander-grid" role="radiogroup" aria-label="Commander">
        {selectableCommanders(faction).map((id) => {
          const c = commanderDef(id)
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === commander}
              className={id === commander ? 'commander-option commander-on' : 'commander-option'}
              onClick={() => onPick(id, id === commander ? variant : (c.variants[0]?.id ?? null))}
              title={`${c.name} "${c.title}"`}
            >
              <Icon name={COMMANDER_PORTRAITS[id]} size={30} />
              <span>{c.name}</span>
            </button>
          )
        })}
      </div>
      <div className="commander-card">
        <h3 className="display">
          {def.name} <span className="muted">“{def.title}”</span>
        </h3>
        <StatLine
          items={[
            { icon: 'power', label: 'Power', value: stats.power },
            { icon: 'toughness', label: 'Toughness', value: stats.toughness },
            { icon: 'lov', label: 'Vision (LOV)', value: stats.lov },
            { icon: 'movement', label: 'Movement', value: stats.movement },
            { icon: 'ap', label: 'AP per action', value: stats.ap },
          ]}
          compact
        />
        <p className="small">{def.text}</p>
        {def.variants.length > 0 && (
          <div className="variant-picker" role="radiogroup" aria-label={`${def.name} variant`}>
            <p className="small strong">Choose a variant (R11): it is shown to your opponent with your commander.</p>
            {def.variants.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={variant === v.id} className={variant === v.id ? 'variant variant-on' : 'variant'} onClick={() => onPick(commander, v.id)}>
                <span className="strong">{v.name}</span>
                <span className="small muted">{v.text}</span>
              </button>
            ))}
          </div>
        )}
        <p className="muted small">The commander costs nothing and must survive: if it falls, the battle is lost.</p>
      </div>
    </section>
  )
}

export function ArmySummary({ army, check, settings }: { readonly army: ArmyList; readonly check: ArmyCheck; readonly settings: MatchSettings }) {
  const preview = previewArmy(army.commander, army.variant ?? null).units
  const count = armyUnitCount(army)
  const capacity = zoneCapacity(settings)
  const area = Object.entries(army.units).reduce((sum, [type, n]) => sum + unitDef(type as RosterUnitId).size ** 2 * (n ?? 0), 1)
  const apAll = Object.entries(army.units).reduce((sum, [type, n]) => sum + (preview.get(type as RosterUnitId)?.ap ?? 0) * (n ?? 0), 0) + previewArmy(army.commander, army.variant ?? null).commander.ap
  const left = settings.budget - check.cost
  const histogram = new Map<number, number>()
  for (const [type, n] of Object.entries(army.units)) {
    const ap = preview.get(type as RosterUnitId)?.ap ?? 0
    if ((n ?? 0) > 0) histogram.set(ap, (histogram.get(ap) ?? 0) + (n ?? 0))
  }
  const maxBar = Math.max(1, ...histogram.values())
  return (
    <section className="army-summary" aria-label="Army summary">
      <h2 className="section-title">3 · Your army</h2>
      <div className={`budget-bar ${left < 0 ? 'budget-over' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={settings.budget} aria-valuenow={check.cost} aria-label="Budget used">
        <div className="budget-fill" style={{ width: `${Math.min(100, (check.cost / settings.budget) * 100)}%` }} />
        <span className="budget-text">
          <Icon name="crown-coin" size={14} /> {check.cost} / {settings.budget} {left >= 0 ? `· ${left} left` : `· ${-left} over`}
        </span>
      </div>
      <dl className="summary-grid">
        <dt>Units</dt>
        <dd className={ARMY_UNIT_CAP !== null && count > ARMY_UNIT_CAP ? 'bad' : undefined}>
          {count}
          {ARMY_UNIT_CAP !== null ? ` / ${ARMY_UNIT_CAP}` : ''} <span className="muted small">(+ commander)</span>
        </dd>
        <dt>Deployment space</dt>
        <dd className={area > capacity.normal + capacity.extended ? 'bad' : undefined}>
          {area} of {capacity.normal} squares <span className="muted small">(+{capacity.extended} Vanguard rows)</span>
        </dd>
        <dt>AP to act with everything once</dt>
        <dd>
          {apAll} <span className="muted small">(round 1: {apForRound(1) * APPROACH_BOOST} with the approach boost; round 11: {apForRound(11)})</span>
        </dd>
      </dl>
      {histogram.size > 0 && (
        <div className="ap-histogram" aria-label="Units by AP cost">
          {[...histogram.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([ap, n]) => (
              <div key={ap} className="ap-col" title={`${n} unit(s) costing ${ap} AP per action`}>
                <span className="ap-bar" style={{ height: `${(n / maxBar) * 100}%` }} />
                <span className="small">{ap} AP</span>
              </div>
            ))}
        </div>
      )}
      <ul className="army-lines">
        <li className="army-line">
          <Icon name={COMMANDER_PORTRAITS[army.commander]} size={16} /> {commanderDef(army.commander).name} <span className="muted">free</span>
        </li>
        {Object.entries(army.units)
          .filter(([, n]) => (n ?? 0) > 0)
          .map(([type, n]) => (
            <li key={type} className="army-line">
              {unitDef(type as RosterUnitId).name} ×{n}
              <span className="muted">{(preview.get(type as RosterUnitId)?.cost ?? 0) * (n ?? 0)}</span>
            </li>
          ))}
      </ul>
      {(check.errors.length > 0 || check.warnings.length > 0) && (
        <ul className="problems" aria-label="Problems">
          {check.errors.map((e) => (
            <li key={e} className="problem problem-error">
              ⛔ {e}
            </li>
          ))}
          {check.warnings.map((w) => (
            <li key={w} className="problem problem-warning">
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}
      {check.errors.length === 0 && <p className="ok small">✓ Ready to field</p>}
    </section>
  )
}
