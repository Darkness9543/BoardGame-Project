// The shortcut sheet (?), the in-game menu (PX BT-34: options subset, offer a draw, resign, leave).

import { useState } from 'react'
import type { MatchController, MatchSnapshot } from '../../store/matchController'
import { useSettings, type ConfirmMode } from '../../store/settings'
import { toast } from '../../store/toasts'
import { leaveMatch } from '../actions'
import { Kbd, Modal, Segmented, Toggle } from '../components/common'
import { SHORTCUTS } from './shortcuts'

export function ShortcutSheet({ onClose }: { readonly onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} className="modal-wide" labelledActions={<button type="button" className="btn btn-primary" onClick={onClose}>Close</button>}>
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
    </Modal>
  )
}

export function GameMenu({ controller, snap, onClose }: { readonly controller: MatchController; readonly snap: MatchSnapshot; readonly onClose: () => void }) {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const [resigning, setResigning] = useState(false)
  const view = snap.view
  const battle = view.phase === 'battle'
  return (
    <Modal title="Game menu" onClose={onClose} labelledActions={<button type="button" className="btn btn-primary" onClick={onClose}>Resume</button>}>
      <div className="menu-options">
        <div className="setting-row">
          <span className="setting-label">Action confirmation</span>
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
        </div>
        <Toggle label="Warn before walking into known mines" checked={settings.mineWarning} onChange={(mineWarning) => update({ mineWarning })} />
        <Toggle label="Show last-seen enemies" checked={settings.lastSeenMarkers} onChange={(lastSeenMarkers) => update({ lastSeenMarkers })} />
        <Toggle label="Clarity mode (colour-blind palette)" checked={settings.clarityMode} onChange={(clarityMode) => update({ clarityMode })} />
        <Toggle label="Coordinates" checked={settings.coordinates} onChange={(coordinates) => update({ coordinates })} />
        <a className="small" href="#/options">
          All options…
        </a>
      </div>
      {battle && (
        <div className="row menu-danger">
          <button
            type="button"
            className="btn"
            disabled={view.drawOffer !== null}
            onClick={() =>
              void controller.session.dispatch({ kind: 'offerDraw' }).then((r) => {
                toast(r.ok ? 'Draw offered' : r.message, r.ok ? 'info' : 'warn')
                onClose()
              })
            }
          >
            Offer a draw
          </button>
          {!resigning ? (
            <button type="button" className="btn btn-ghost" onClick={() => setResigning(true)}>
              Resign…
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() =>
                void controller.session.dispatch({ kind: 'resign' }).then((r) => {
                  if (!r.ok) toast(r.message, 'warn')
                  onClose()
                })
              }
            >
              Really resign (a loss)
            </button>
          )}
        </div>
      )}
      <p className="small muted">Leaving keeps the match open in this browser: rejoin it from the main menu. Closing the host's tab pauses the game for both players.</p>
      <div className="row">
        <a className="btn btn-ghost" href="#/">
          Main menu (keep the match open)
        </a>
        {!battle && (
          <button type="button" className="btn btn-ghost" onClick={leaveMatch}>
            Close this game
          </button>
        )}
      </div>
    </Modal>
  )
}
