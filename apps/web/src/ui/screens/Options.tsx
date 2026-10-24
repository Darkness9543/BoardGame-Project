// S10 options (PX 10, UX 22.1): per player, applied at once, and never a rule (A13-01).

import type { ReactNode } from 'react'
import { REACTION_PROMPT_TIMEOUT_S, TIERS, type PreferenceValue } from '@coinduel/engine'
import { useAchievements } from '../../store/achievements'
import { useSettings, type AnimationSpeed, type BoardChoice, type ConfirmMode, type EndTurnConfirm, type MotionPreference, type TakebackAnswer, type ViewMode } from '../../store/settings'
import { toast } from '../../store/toasts'
import { SHORTCUTS } from '../battle/shortcuts'
import { BOARD_RENDERERS } from '../board/registry'
import { Coin } from '../components/Coin'
import { Kbd, ScreenHeader, Segmented, Toggle } from '../components/common'

function Row({ label, hint, children }: { readonly label: string; readonly hint?: string; readonly children: ReactNode }) {
  return (
    <div className="option-row">
      <div>
        <span className="setting-label">{label}</span>
        {hint !== undefined && <p className="muted small">{hint}</p>}
      </div>
      <div className="option-control">{children}</div>
    </div>
  )
}

export function Options() {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const reset = useSettings((s) => s.reset)
  const resetAchievements = useAchievements((s) => s.reset)
  return (
    <main className="screen options">
      <ScreenHeader title="Options" back={{ label: 'Menu', href: '#/' }} />
      <section className="card" aria-label="Gameplay">
        <h2 className="section-title">Gameplay</h2>
        <Row label="Action confirmation" hint="Preview first, then confirm with a second click or Enter. Mine prompts and attacks on your own units always ask.">
          <Segmented<ConfirmMode>
            label="Action confirmation"
            value={settings.confirmMode}
            options={[
              { value: 'always', label: 'Always' },
              { value: 'attacksAbilities', label: 'Attacks & abilities' },
              { value: 'never', label: 'Never' },
            ]}
            onChange={(confirmMode) => update({ confirmMode })}
          />
        </Row>
        <Row label="Warn before walking into known mines" hint="Paths avoid your mines anyway; this asks when one can't be avoided. Your commander always asks (R34).">
          <Toggle label={settings.mineWarning ? 'On' : 'Off'} checked={settings.mineWarning} onChange={(mineWarning) => update({ mineWarning })} />
        </Row>
        <Row label="Confirm end turn" hint="A two-step button: the first click arms it for a few seconds.">
          <Segmented<EndTurnConfirm>
            label="Confirm end turn"
            value={settings.endTurnConfirm}
            options={[
              { value: 'whenCanAct', label: 'When units can act' },
              { value: 'always', label: 'Always' },
              { value: 'never', label: 'Never' },
            ]}
            onChange={(endTurnConfirm) => update({ endTurnConfirm })}
          />
        </Row>
        <Row label="Reactions on your opponent's turn" hint={`Queso's revive and Baba Yaga's Cauldron. "Ask" shows a ${REACTION_PROMPT_TIMEOUT_S} s prompt (your opponent notices the pause); Always and Never answer at once.`}>
          <Segmented<PreferenceValue>
            label="Reaction preference"
            value={settings.revivePreference}
            options={[
              { value: 'ask', label: 'Ask each time' },
              { value: 'always', label: 'Always yes' },
              { value: 'never', label: 'Never' },
            ]}
            onChange={(revivePreference) => update({ revivePreference })}
          />
        </Row>
        <Row label="Take-back requests from your opponent">
          <Segmented<TakebackAnswer>
            label="Take-back requests"
            value={settings.takebackAnswer}
            options={[
              { value: 'ask', label: 'Ask me' },
              { value: 'autoAccept', label: 'Accept all' },
              { value: 'autoDecline', label: 'Decline all' },
            ]}
            onChange={(takebackAnswer) => update({ takebackAnswer })}
          />
        </Row>
        <Row label="After a unit is done, select the next one">
          <Toggle label={settings.autoSelectNext ? 'On' : 'Off'} checked={settings.autoSelectNext} onChange={(autoSelectNext) => update({ autoSelectNext })} />
        </Row>
        <Row label="Highlight units that can still act">
          <Toggle label={settings.highlightReady ? 'On' : 'Off'} checked={settings.highlightReady} onChange={(highlightReady) => update({ highlightReady })} />
        </Row>
        <Row label="Show last-seen enemies" hint="Faded markers where enemies left your vision: a memory of what you saw, never live data.">
          <Toggle label={settings.lastSeenMarkers ? 'On' : 'Off'} checked={settings.lastSeenMarkers} onChange={(lastSeenMarkers) => update({ lastSeenMarkers })} />
        </Row>
      </section>
      <section className="card" aria-label="Display">
        <h2 className="section-title">Display</h2>
        <Row label="Board" hint="The 3D board, or a light 2D board for slow devices. Both show exactly the same game.">
          <Segmented<BoardChoice> label="Board" value={settings.board} options={BOARD_RENDERERS.map((r) => ({ value: r.id, label: r.label }))} onChange={(board) => update({ board })} />
        </Row>
        <Row label="Default view">
          <Segmented<ViewMode> label="Default view" value={settings.defaultView} options={[{ value: 'top', label: 'Top' }, { value: 'iso', label: 'Isometric' }]} onChange={(defaultView) => update({ defaultView })} />
        </Row>
        <Row label="Clarity mode" hint="A colour-blind safe grade palette (warm/cool ramp) with rank pips on every coin.">
          <Toggle label={settings.clarityMode ? 'On' : 'Off'} checked={settings.clarityMode} onChange={(clarityMode) => update({ clarityMode })} />
        </Row>
        <div className="palette-preview" aria-label="Grade colours">
          {TIERS.map((tier) => (
            <Coin key={tier} look={{ type: 'footman', tier, mine: true, commander: null, clarity: settings.clarityMode }} size={40} title={`Tier ${tier}`} />
          ))}
        </div>
        <Row label="Coordinates">
          <Toggle label={settings.coordinates ? 'On' : 'Off'} checked={settings.coordinates} onChange={(coordinates) => update({ coordinates })} />
        </Row>
        <Row label="Animation speed">
          <Segmented<AnimationSpeed>
            label="Animation speed"
            value={settings.animationSpeed}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
              { value: 'instant', label: 'Instant' },
            ]}
            onChange={(animationSpeed) => update({ animationSpeed })}
          />
        </Row>
        <Row label="Follow the action with the camera" hint="While animations play, bring the acting unit into view if it is off screen.">
          <Toggle label={settings.followEnemyActions ? 'On' : 'Off'} checked={settings.followEnemyActions} onChange={(followEnemyActions) => update({ followEnemyActions })} />
        </Row>
        <Row label="Reduce motion" hint="Follows your system setting unless you choose here.">
          <Segmented<MotionPreference>
            label="Reduce motion"
            value={settings.motion}
            options={[
              { value: 'system', label: 'System' },
              { value: 'reduce', label: 'Reduce' },
              { value: 'full', label: 'Full motion' },
            ]}
            onChange={(motion) => update({ motion })}
          />
        </Row>
      </section>
      <section className="card" aria-label="Notifications">
        <h2 className="section-title">Notifications</h2>
        <Row label="Notify me when it's my turn" hint="The tab title always changes; this adds a system notification while the tab is hidden.">
          <Toggle
            label={settings.notifyTurn ? 'On' : 'Off'}
            checked={settings.notifyTurn}
            onChange={(on) => {
              if (!on) return update({ notifyTurn: false })
              if (typeof Notification === 'undefined') return toast('This browser has no notifications', 'warn')
              void Notification.requestPermission().then((p) => {
                update({ notifyTurn: p === 'granted' })
                if (p !== 'granted') toast('Notifications were not allowed', 'warn')
              })
            }}
          />
        </Row>
      </section>
      <section className="card" aria-label="Keyboard">
        <h2 className="section-title">Keyboard</h2>
        <table className="shortcut-table">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.action}>
                <td>
                  {s.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </td>
                <td>{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card" aria-label="Data">
        <h2 className="section-title">Data</h2>
        <p className="muted small">Your profile, armies, options and achievements live in this browser only.</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => { reset(); toast('Options reset', 'info') }}>
            Reset options
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => { resetAchievements(); toast('Achievements reset', 'info') }}>
            Reset achievements
          </button>
        </div>
      </section>
    </main>
  )
}
