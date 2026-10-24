// S09 achievements and stats (PX 9): the 15 with progress and unlock dates, profile stats, and the local match
// log (R38: armies, commanders, winner, rounds and how it was won, per unit type for R39).

import { COMMANDERS, commanderDef, type Seat } from '@coinduel/engine'
import { ACHIEVEMENTS, progressOf, useAchievements } from '../../store/achievements'
import { RESULT_REASONS } from '../../store/logText'
import { useMatchLog } from '../../store/matchLog'
import { ScreenHeader } from '../components/common'
import { Icon } from '../components/Icon'
import { COMMANDER_PORTRAITS } from '../theme'

export function Achievements() {
  const state = useAchievements((s) => s.state)
  const entries = useMatchLog((s) => s.entries)
  const s = state.stats
  const unlockedCount = ACHIEVEMENTS.filter((a) => state.unlocked[a.id] !== undefined).length
  const ordered = [...ACHIEVEMENTS].sort((a, b) => Number(state.unlocked[b.id] !== undefined) - Number(state.unlocked[a.id] !== undefined))
  const winRate = s.matchesCompleted === 0 ? null : Math.round((s.wins / s.matchesCompleted) * 100)
  return (
    <main className="screen">
      <ScreenHeader title="Achievements" back={{ label: 'Menu', href: '#/' }}>
        <span className="tag">
          {unlockedCount} / {ACHIEVEMENTS.length} unlocked
        </span>
      </ScreenHeader>
      <section className="stats-panel card" aria-label="Statistics">
        <div className="stat-big">
          <span className="stat-big-value">{s.matchesCompleted}</span>
          <span className="muted small">matches</span>
        </div>
        <div className="stat-big">
          <span className="stat-big-value ok">{s.wins}</span>
          <span className="muted small">wins</span>
        </div>
        <div className="stat-big">
          <span className="stat-big-value bad">{s.losses}</span>
          <span className="muted small">losses</span>
        </div>
        <div className="stat-big">
          <span className="stat-big-value">{s.draws}</span>
          <span className="muted small">draws</span>
        </div>
        <div className="stat-big">
          <span className="stat-big-value">{winRate === null ? '–' : `${winRate}%`}</span>
          <span className="muted small">win rate</span>
        </div>
        <div className="stat-big">
          <span className="stat-big-value">{s.longestMatchRounds}</span>
          <span className="muted small">longest match (rounds)</span>
        </div>
        <ul className="commander-wins">
          {COMMANDERS.filter((c) => c.selectable).map((c) => (
            <li key={c.id} title={`${c.name}: ${s.winsByCommander[c.id] ?? 0} wins`}>
              <Icon name={COMMANDER_PORTRAITS[c.id]} size={18} /> {s.winsByCommander[c.id] ?? 0}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Achievements">
        <ul className="achievement-grid">
          {ordered.map((a) => {
            const at = state.unlocked[a.id]
            const progress = progressOf(state, a.id)
            return (
              <li key={a.id} className={`achievement ${at === undefined ? 'achievement-locked' : 'achievement-unlocked'}`}>
                <Icon name="laurels-trophy" size={30} />
                <div>
                  <h3>{a.name}</h3>
                  <p className="small">{a.description}</p>
                  {progress !== null && at === undefined && (
                    <div className="progress" role="meter" aria-valuemin={0} aria-valuemax={progress.target} aria-valuenow={progress.value} aria-label={`${a.name} progress`}>
                      <span style={{ width: `${(progress.value / progress.target) * 100}%` }} />
                      <em>
                        {progress.value} / {progress.target}
                      </em>
                    </div>
                  )}
                  {at !== undefined && <p className="muted small">Unlocked {new Date(at).toLocaleDateString()}</p>}
                </div>
              </li>
            )
          })}
        </ul>
        <p className="muted small">Only finished online matches count; wins need at least 3 full rounds. Sandbox games never count.</p>
      </section>
      <section aria-label="Match history">
        <h2 className="section-title">Match history</h2>
        {entries.length === 0 && <p className="muted">No finished matches yet.</p>}
        <ul className="match-history">
          {entries.map((e) => {
            const me: Seat = e.seat
            const other: Seat = me === 'host' ? 'guest' : 'host'
            const outcome = e.summary.winner === null ? 'Draw' : e.summary.winner === me ? 'Win' : 'Loss'
            const mine = e.summary.commanders[me]
            const theirs = e.summary.commanders[other]
            return (
              <li key={e.id} className={`history-item history-${outcome.toLowerCase()}`}>
                <span className="strong">{outcome}</span>
                <span>{RESULT_REASONS[e.summary.reason]}</span>
                <span className="muted small">
                  {mine === null ? '?' : commanderDef(mine).name} vs {e.names[other]} ({theirs === null ? '?' : commanderDef(theirs).name}) · {e.summary.rounds} rounds · {new Date(e.finishedAt).toLocaleString()}
                  {e.mode === 'local' ? ' · sandbox' : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}
