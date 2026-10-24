// S04 standalone: #/armies/<id> edits a saved army; a starter id or "new" starts a new one.

import { useEffect, useState } from 'react'
import { BUDGET } from '@coinduel/engine'
import { STARTER_ARMIES, defaultArmyName, newSavedArmy, sameArmy, useArmies } from '../../store/armies'
import { toast } from '../../store/toasts'
import { ArmyBuilder } from '../army/ArmyBuilder'
import { builderSettings, type BuilderDraft } from '../army/builderModel'
import { ScreenHeader } from '../components/common'
import { navigate } from '../router'

export function ArmyBuilderScreen({ id }: { readonly id: string }) {
  const armies = useArmies((s) => s.armies)
  const save = useArmies((s) => s.save)
  const update = useArmies((s) => s.update)
  const remove = useArmies((s) => s.remove)
  const saved = armies.find((a) => a.id === id)
  const starter = STARTER_ARMIES.find((s) => s.id === id)
  const initial = (): BuilderDraft =>
    saved !== undefined
      ? { name: saved.name, army: saved.army }
      : starter !== undefined
        ? { name: `${starter.name} (copy)`, army: starter.army }
        : { name: defaultArmyName('trill', armies), army: { faction: 'empire', commander: 'trill', units: {} } }
  const [draft, setDraft] = useState<BuilderDraft>(initial)
  const [leaving, setLeaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Another army opened in the same screen (after "Save to my armies" the route moves to the new id).
  useEffect(() => setDraft(initial()), [id])
  const budget = saved?.budget ?? BUDGET
  const dirty = saved === undefined ? Object.keys(draft.army.units).length > 0 || starter !== undefined : !sameArmy(saved.army, draft.army) || saved.name !== draft.name

  const saveDraft = (asNew: boolean) => {
    if (saved !== undefined && !asNew) {
      update(saved.id, { army: draft.army, name: draft.name })
      toast(`Saved "${draft.name}"`, 'good')
      return
    }
    const entry = save(newSavedArmy(draft.army, asNew && saved !== undefined ? `${draft.name} copy` : draft.name, budget, Date.now()))
    toast(`Saved "${entry.name}"`, 'good')
    navigate({ name: 'army', id: entry.id }, { replace: true })
  }

  return (
    <main className="screen builder-screen">
      <ScreenHeader title={saved !== undefined ? 'Edit army' : 'New army'} back={{ label: 'Armies', href: '#/armies' }}>
        {dirty && <span className="tag tag-warn">Unsaved changes</span>}
      </ScreenHeader>
      <ArmyBuilder
        draft={draft}
        onChange={setDraft}
        settings={builderSettings(budget)}
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => saveDraft(false)}>
              {saved !== undefined ? 'Save' : 'Save to my armies'}
            </button>
            {saved !== undefined && (
              <button type="button" className="btn" onClick={() => saveDraft(true)}>
                Save as a copy
              </button>
            )}
            {saved !== undefined && !confirmDelete && (
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
                Delete…
              </button>
            )}
            {saved !== undefined && confirmDelete && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  remove(saved.id)
                  toast(`Deleted "${saved.name}"`, 'info')
                  navigate({ name: 'armies' })
                }}
              >
                Really delete
              </button>
            )}
            {!leaving ? (
              <button type="button" className="btn btn-ghost" onClick={() => (dirty ? setLeaving(true) : navigate({ name: 'armies' }))}>
                Close
              </button>
            ) : (
              <span className="inline-confirm">
                Discard changes?{' '}
                <button type="button" className="btn btn-small btn-danger" onClick={() => navigate({ name: 'armies' })}>
                  Discard
                </button>
                <button type="button" className="btn btn-small" onClick={() => setLeaving(false)}>
                  Keep editing
                </button>
              </span>
            )}
          </>
        }
      />
    </main>
  )
}
