// The combat log (PX BT-32, UX 15.2): grouped by turn, filterable, hover highlights the squares, click focuses
// them, taken-back actions stay struck through, and the whole log copies as text.

import { useEffect, useRef } from 'react'
import { logAsText, matchesFilter, type LogEntry } from '../../store/logText'
import { useSettings, type LogFilter } from '../../store/settings'
import { useUiState } from '../../store/uiState'
import { CopyButton, Segmented } from '../components/common'

const FILTERS: readonly { readonly value: LogFilter; readonly label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'combat', label: 'Combat' },
  { value: 'movement', label: 'Moves' },
  { value: 'objectives', label: 'Objectives' },
  { value: 'system', label: 'System' },
]

export function EventLog({ entries }: { readonly entries: readonly LogEntry[] }) {
  const filter = useSettings((s) => s.settings.logFilter)
  const update = useSettings((s) => s.update)
  const setHighlight = useUiState((s) => s.setHighlight)
  const setFocus = useUiState((s) => s.setFocus)
  const listRef = useRef<HTMLOListElement>(null)
  const pinned = useRef(true)
  const shown = entries.filter((e) => matchesFilter(e, filter))

  useEffect(() => {
    const list = listRef.current
    if (list !== null && pinned.current) list.scrollTop = list.scrollHeight
  }, [shown.length])

  return (
    <section className="event-log" aria-label="Battle log">
      <div className="event-log-head">
        <Segmented label="Log filter" value={filter} options={FILTERS} onChange={(logFilter) => update({ logFilter })} />
        <CopyButton text={logAsText(entries)} label="Copy" className="btn btn-small btn-ghost" />
      </div>
      <ol
        ref={listRef}
        className="event-log-list"
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
        onPointerLeave={() => setHighlight([])}
      >
        {shown.length === 0 && <li className="muted small">Nothing yet.</li>}
        {shown.map((e) =>
          e.separator ? (
            <li key={e.id} className="log-separator">
              {e.text}
            </li>
          ) : (
            <li
              key={e.id}
              className={`log-entry log-${e.actor} log-${e.tone}${e.undone ? ' log-undone' : ''}`}
              onPointerEnter={() => setHighlight(e.squares)}
              onClick={() => {
                const first = e.squares[0]
                if (first !== undefined) setFocus(first)
              }}
              title={e.undone ? 'Taken back' : undefined}
            >
              <span className="log-round">R{e.round}</span> {e.text}
            </li>
          ),
        )}
      </ol>
    </section>
  )
}
