// The army builder (PX S04, AB-04..AB-17): commander first (it changes prices and tiers), then the 7 tiers x 2
// factions grid (R43: any of the 14 units, grouped by home faction only for presentation; the faction is the army's
// cosmetic banner), with the engine's checkArmy as the only judge.

import { useMemo, useState, type ReactNode } from 'react'
import { FACTIONS, ROSTER, TIERS, availableRoster, checkArmy, type ArmyList, type FactionId, type MatchSettings, type RosterUnitId } from '@coinduel/engine'
import { ARMY_NAME_MAX, defaultArmyName, useArmies } from '../../store/armies'
import { armyToText, parseArmyText } from '../../store/armyText'
import { previewArmy } from '../../store/armyPreview'
import { useSettings } from '../../store/settings'
import { toast } from '../../store/toasts'
import { CopyButton, Modal } from '../components/common'
import { Icon } from '../components/Icon'
import { FACTION_EMBLEMS } from '../theme'
import { repriceNote, withBanner, withCommander, withUnits, type BuilderDraft } from './builderModel'
import { ArmySummary, CommanderPicker, UnitTile } from './parts'

export function ArmyBuilder({
  draft,
  onChange,
  settings,
  actions,
}: {
  readonly draft: BuilderDraft
  readonly onChange: (draft: BuilderDraft) => void
  /** The lobby's settings when built inside a lobby (AB-09), else defaults with the army's budget. */
  readonly settings: MatchSettings
  readonly actions: ReactNode
}) {
  const clarity = useSettings((s) => s.settings.clarityMode)
  const saved = useArmies((s) => s.armies)
  const { army, name } = draft
  const check = useMemo(() => checkArmy(army, settings), [army, settings])
  const preview = previewArmy(army.commander, army.variant ?? null).units
  const roster = availableRoster(army.faction)
  const [textOpen, setTextOpen] = useState<'export' | 'import' | null>(null)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  const setArmy = (next: ArmyList) => onChange({ name, army: next })
  const setBanner = (faction: FactionId) => {
    const next = withBanner(army, faction)
    if (next !== army) setArmy(next)
  }

  return (
    <div className="builder">
      <div className="builder-bar">
        <label className="field builder-name">
          <span className="field-label">Army name</span>
          <input value={name} maxLength={ARMY_NAME_MAX} onChange={(e) => onChange({ name: e.target.value, army })} />
        </label>
        <div className="faction-tabs" role="radiogroup" aria-label="Banner" title="The army's crest and colours; it fields units of both factions">
          {FACTIONS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={f.id === army.faction} className={f.id === army.faction ? 'faction-tab faction-on' : 'faction-tab'} onClick={() => setBanner(f.id)}>
              <Icon name={FACTION_EMBLEMS[f.id]} size={20} /> {f.name}
            </button>
          ))}
        </div>
        <div className="builder-tools">
          <button type="button" className="btn btn-small" onClick={() => setTextOpen('export')}>
            Export as text
          </button>
          <button type="button" className="btn btn-small" onClick={() => setTextOpen('import')}>
            Import text
          </button>
        </div>
      </div>
      <div className="builder-body">
        <CommanderPicker
          faction={army.faction}
          commander={army.commander}
          variant={army.variant ?? null}
          onPick={(commander, variant) => {
            const next = withCommander(army, commander, variant)
            const note = repriceNote(army, next, settings.budget)
            if (note !== null) toast(note, 'info')
            // A name the player never changed follows the commander ("Baba Yaga army 1", not "Trill army 1").
            const renamed = name === defaultArmyName(army.commander, saved) ? defaultArmyName(commander, saved) : name
            onChange({ name: renamed, army: next })
          }}
        />
        <section className="unit-grid-wrap" aria-label="Units">
          <h2 className="section-title">2 · Units</h2>
          <div className="unit-grid">
            <div className="unit-grid-head" />
            {FACTIONS.map((f) => (
              <button key={f.id} type="button" className={f.id === army.faction ? 'unit-grid-faction faction-on' : 'unit-grid-faction'} onClick={() => setBanner(f.id)} title={`Use the ${f.name} banner`}>
                <Icon name={FACTION_EMBLEMS[f.id]} size={16} /> {f.name}
              </button>
            ))}
            {TIERS.map((tier) => (
              <div key={tier} className="unit-grid-row">
                <div className="unit-grid-tier" aria-label={`Tier ${tier}`}>
                  <span className={`tier-chip tier-${tier}`}>{tier}</span>
                </div>
                {FACTIONS.map((f) => {
                  const def = ROSTER.find((u) => u.faction === f.id && u.tier === tier)
                  if (def === undefined) return <div key={f.id} />
                  const type = def.id as RosterUnitId
                  const p = preview.get(type)
                  if (p === undefined) return <div key={f.id} />
                  return (
                    <UnitTile
                      key={f.id}
                      preview={p}
                      count={army.units[type] ?? 0}
                      enabled={roster.includes(type)}
                      commander={army.commander}
                      clarity={clarity}
                      onChange={(n) => setArmy(withUnits(army, type, n))}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </section>
        <aside className="builder-side">
          <ArmySummary army={army} check={check} settings={settings} />
          <div className="builder-actions">{actions}</div>
        </aside>
      </div>
      {textOpen === 'export' && (
        <Modal title="Army as text" onClose={() => setTextOpen(null)} labelledActions={<><CopyButton text={armyToText(name, army)} label="Copy text" className="btn btn-primary" /><button type="button" className="btn" onClick={() => setTextOpen(null)}>Close</button></>}>
          <p className="muted small">Paste this into a chat; anyone can import it from their army builder.</p>
          <textarea className="code-box" readOnly rows={7} value={armyToText(name, army)} onFocus={(e) => e.target.select()} />
        </Modal>
      )}
      {textOpen === 'import' && (
        <Modal
          title="Import an army"
          onClose={() => setTextOpen(null)}
          labelledActions={
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const parsed = parseArmyText(importText)
                  if (!parsed.ok) {
                    setImportError(parsed.error)
                    return
                  }
                  onChange({ name: parsed.name ?? name, army: parsed.army })
                  setTextOpen(null)
                  setImportText('')
                  setImportError(null)
                  toast('Army imported: check it before saving', 'good')
                }}
              >
                Import
              </button>
              <button type="button" className="btn" onClick={() => setTextOpen(null)}>
                Cancel
              </button>
            </>
          }
        >
          <p className="muted small">Paste an exported army (or a JSON army list). The builder checks it with the current rules.</p>
          <textarea className="code-box" rows={7} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'Coin Duel army\nname: ...\nfaction: empire\ncommander: trill\nunits: footman 10, paladin 2'} />
          {importError !== null && <p className="field-error">{importError}</p>}
        </Modal>
      )}
    </div>
  )
}
