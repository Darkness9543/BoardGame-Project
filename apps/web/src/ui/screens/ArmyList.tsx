// S03 army list (PX S03): starter armies (AB-01), the player's armies with their status, and the actions
// New, Edit, Duplicate, Rename, Delete (with undo), copy as text and import from text.

import { useState, type ReactNode } from 'react'
import { BUDGET, DEFAULT_SETTINGS, FACTIONS, RULES_VERSION, armyUnitCount, checkArmy, commanderDef, type ArmyList as Army } from '@coinduel/engine'
import { STARTER_ARMIES, newSavedArmy, sortArmies, useArmies, type SavedArmy } from '../../store/armies'
import { armyToText, parseArmyText } from '../../store/armyText'
import { toast } from '../../store/toasts'
import { CopyButton, Modal, ScreenHeader } from '../components/common'
import { Icon } from '../components/Icon'
import { COMMANDER_PORTRAITS, FACTION_EMBLEMS } from '../theme'
import { navigate } from '../router'

function armyStatus(army: Army, budget: number, rulesVersion: number): { readonly label: string; readonly tone: 'ok' | 'bad' | 'warn' } {
  const check = checkArmy(army, { ...DEFAULT_SETTINGS, budget })
  if (check.ok) return check.warnings.length > 0 ? { label: 'Valid (empty)', tone: 'warn' } : { label: 'Valid', tone: 'ok' }
  if (rulesVersion !== RULES_VERSION) return { label: 'Needs update', tone: 'warn' }
  const first = check.errors[0] ?? 'Invalid'
  return { label: first.startsWith('Over budget') ? 'Over budget' : first, tone: 'bad' }
}

function ArmyCard({ name, army, budget, children, status }: { readonly name: string; readonly army: Army; readonly budget: number; readonly children: ReactNode; readonly status: ReturnType<typeof armyStatus> }) {
  const cost = checkArmy(army, { ...DEFAULT_SETTINGS, budget }).cost
  const commander = commanderDef(army.commander)
  const variant = commander.variants.find((v) => v.id === army.variant)
  return (
    <article className="army-card">
      <header className="army-card-head">
        <Icon name={COMMANDER_PORTRAITS[army.commander]} size={34} />
        <div>
          <h3>{name}</h3>
          <span className="muted small">
            <Icon name={FACTION_EMBLEMS[army.faction]} size={12} /> {FACTIONS.find((f) => f.id === army.faction)?.name} · {commander.name}
            {variant !== undefined ? ` (${variant.name})` : ''}
          </span>
        </div>
        <span className={`tag tag-${status.tone}`}>{status.label}</span>
      </header>
      <p className="small">
        <Icon name="crown-coin" size={12} /> {cost} / {budget} · {armyUnitCount(army)} units
      </p>
      <div className="army-card-actions">{children}</div>
    </article>
  )
}

export function ArmyList() {
  const armies = useArmies((s) => s.armies)
  const save = useArmies((s) => s.save)
  const update = useArmies((s) => s.update)
  const duplicate = useArmies((s) => s.duplicate)
  const remove = useArmies((s) => s.remove)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [exporting, setExporting] = useState<SavedArmy | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  const [deleted, setDeleted] = useState<SavedArmy | null>(null)
  const deleteWithUndo = (army: SavedArmy) => {
    remove(army.id)
    setDeleted(army)
  }

  return (
    <main className="screen">
      <ScreenHeader title="Army compositions" back={{ label: 'Menu', href: '#/' }}>
        <button type="button" className="btn" onClick={() => setImportOpen(true)}>
          Import from text
        </button>
        <a className="btn btn-primary" href="#/armies/new">
          + New army
        </a>
      </ScreenHeader>
      {deleted !== null && (
        <div className="banner banner-info">
          Deleted "{deleted.name}".{' '}
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              save(deleted)
              setDeleted(null)
            }}
          >
            Undo
          </button>
        </div>
      )}
      <section aria-label="My armies">
        <h2 className="section-title">My armies</h2>
        {armies.length === 0 && <p className="muted">No armies yet. Start from a starter army below, or build one from scratch.</p>}
        <div className="army-cards">
          {sortArmies(armies).map((a) => (
            <ArmyCard key={a.id} name={a.name} army={a.army} budget={a.budget} status={armyStatus(a.army, a.budget, a.rulesVersion)}>
              {renaming?.id === a.id ? (
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    update(a.id, { name: renaming.name })
                    setRenaming(null)
                  }}
                >
                  <input autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: a.id, name: e.target.value })} aria-label="New name" />
                  <button className="btn btn-small" type="submit">
                    OK
                  </button>
                </form>
              ) : (
                <>
                  <a className="btn btn-small btn-primary" href={`#/armies/${a.id}`}>
                    Edit
                  </a>
                  <button type="button" className="btn btn-small" onClick={() => setRenaming({ id: a.id, name: a.name })}>
                    Rename
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => duplicate(a.id)}>
                    Duplicate
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => setExporting(a)}>
                    Share
                  </button>
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => deleteWithUndo(a)}>
                    Delete
                  </button>
                </>
              )}
            </ArmyCard>
          ))}
        </div>
      </section>
      <section aria-label="Starter armies">
        <h2 className="section-title">Starter armies</h2>
        <p className="muted small">Ready to play, one per commander. Use them as they are in a lobby, or copy one to edit.</p>
        <div className="army-cards">
          {STARTER_ARMIES.map((s) => (
            <ArmyCard key={s.id} name={s.name} army={s.army} budget={BUDGET} status={armyStatus(s.army, BUDGET, RULES_VERSION)}>
              <p className="muted small army-blurb">{s.blurb}</p>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  const entry = save(newSavedArmy(s.army, s.name, BUDGET, Date.now()))
                  navigate({ name: 'army', id: entry.id })
                }}
              >
                Copy and edit
              </button>
            </ArmyCard>
          ))}
        </div>
      </section>
      {exporting !== null && (
        <Modal title={`Share "${exporting.name}"`} onClose={() => setExporting(null)} labelledActions={<><CopyButton text={armyToText(exporting.name, exporting.army)} label="Copy text" className="btn btn-primary" /><button type="button" className="btn" onClick={() => setExporting(null)}>Close</button></>}>
          <textarea className="code-box" readOnly rows={7} value={armyToText(exporting.name, exporting.army)} onFocus={(e) => e.target.select()} />
        </Modal>
      )}
      {importOpen && (
        <Modal
          title="Import an army"
          onClose={() => setImportOpen(false)}
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
                  const entry = save(newSavedArmy(parsed.army, parsed.name ?? 'Imported army', BUDGET, Date.now()))
                  setImportOpen(false)
                  setImportText('')
                  toast(`Imported "${entry.name}"`, 'good')
                }}
              >
                Import
              </button>
              <button type="button" className="btn" onClick={() => setImportOpen(false)}>
                Cancel
              </button>
            </>
          }
        >
          <textarea className="code-box" rows={7} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste the army text here" />
          {importError !== null && <p className="field-error">{importError}</p>}
        </Modal>
      )}
    </main>
  )
}
