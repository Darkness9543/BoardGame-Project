// The combat log (PX BT-32, UX 15.2): one entry per visible event (moves collapsed per unit), worded from this
// player's knowledge. Events about unseen units are already filtered by the engine; wording stays neutral.

import {
  abilityData,
  buildingDef,
  hasAbilityData,
  squareName,
  type DamageStep,
  type GameResult,
  type PlayerView,
  type Seat,
  type Square,
  type VisibleEvent,
} from '@coinduel/engine'
import { labelWithSquare, ownedLabel, sentence, unitSquare, type UnitRegistry } from './naming'
import { sourceName } from './forecast'

export type LogCategory = 'combat' | 'movement' | 'objectives' | 'system'
export type LogTone = 'good' | 'bad' | 'neutral'

export interface LogLine {
  readonly category: LogCategory
  readonly actor: 'me' | 'opponent' | 'system'
  readonly text: string
  readonly squares: readonly Square[]
  readonly tone: LogTone
  /** A turn separator ("Round 3 · Your turn"). */
  readonly separator: boolean
}

export interface LogEntry extends LogLine {
  readonly id: number
  readonly turn: number
  readonly round: number
  /** Update batch the entry came from (a take-back strikes a whole batch through). */
  readonly batch: number
  readonly undone: boolean
}

export interface LogContext {
  readonly view: PlayerView
  readonly registry: UnitRegistry
  /** Display names per seat (the opponent's presence name when the session knows it). */
  readonly names: Readonly<Record<Seat, string>>
}

export function resultText(result: GameResult, me: Seat): { readonly headline: string; readonly reason: string } {
  const reason = RESULT_REASONS[result.reason]
  if (result.winner === null) return { headline: 'Draw', reason }
  return { headline: result.winner === me ? 'Victory' : 'Defeat', reason }
}

/** PX RS-01 wording. */
export const RESULT_REASONS: Readonly<Record<GameResult['reason'], string>> = {
  conquest: 'Commander defeated',
  domination: 'Commander reached the far side',
  siege: 'Siege: both buildings held',
  resignation: 'Resignation',
  agreement: 'Draw agreed',
  simultaneousCommanderDeath: 'Both commanders fell',
}

function seatWord(ctx: LogContext, seat: Seat): string {
  return seat === ctx.view.seat ? 'You' : ctx.names[seat]
}

function breakdownText(steps: readonly DamageStep[]): string {
  if (steps.length <= 1) return ''
  const parts = steps.map((s, i) => (i === 0 ? String(s.delta) : s.step === 'defend' ? 'halved' : `${s.delta >= 0 ? '+' : '−'} ${Math.abs(s.delta)} ${sourceName(s.source)}`))
  return ` (${parts.join(' ')} = ${steps[steps.length - 1]?.total ?? 0})`
}

function abilityName(id: string): string {
  return hasAbilityData(id) ? abilityData(id).name : id
}

const line = (category: LogCategory, actor: LogLine['actor'], text: string, squares: readonly (Square | null)[] = [], tone: LogTone = 'neutral'): LogLine => ({
  category,
  actor,
  text: sentence(text),
  squares: squares.filter((s): s is Square => s !== null),
  tone,
  separator: false,
})

const MOVE_END: Readonly<Record<string, string>> = {
  blocked: 'Blocked!',
  mine: 'Mine!',
  reaction: 'Ambushed!',
  died: 'lost on the way',
}

/** Turns one update's events into log lines. */
export function describeEvents(events: readonly VisibleEvent[], ctx: LogContext): LogLine[] {
  const { view, registry } = ctx
  const me = view.seat
  const out: LogLine[] = []
  const ownerOf = (id: string | null): LogLine['actor'] => {
    const owner = id === null ? undefined : registry.units[id]?.owner
    return owner === undefined ? 'system' : owner === me ? 'me' : 'opponent'
  }
  const label = (id: string | null): string => ownedLabel(registry, view, id)
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e === undefined) continue
    switch (e.type) {
      case 'unitMoved': {
        // Collapse the steps of one move into one line, with how it ended.
        let last = e
        while (i + 1 < events.length) {
          const next = events[i + 1]
          if (next?.type !== 'unitMoved' || next.unitId !== e.unitId) break
          last = next
          i++
        }
        const ended = events[i + 1]
        let suffix = ''
        if (ended?.type === 'moveEnded' && ended.unitId === e.unitId) {
          i++
          suffix = ended.reason === 'completed' ? '' : ` — ${MOVE_END[ended.reason] ?? ended.reason}`
        }
        out.push(line('movement', ownerOf(e.unitId), `${label(e.unitId)} moved ${squareName(e.from)} → ${squareName(last.to)}${suffix}`, [e.from, last.to], suffix === '' ? 'neutral' : 'bad'))
        break
      }
      case 'moveEnded':
        if (e.reason !== 'completed') out.push(line('movement', ownerOf(e.unitId), `${label(e.unitId)} stopped at ${squareName(e.at)} — ${MOVE_END[e.reason] ?? e.reason}`, [e.at], 'bad'))
        break
      case 'defendChanged':
        if (e.reason === 'action') out.push(line('combat', ownerOf(e.unitId), `${label(e.unitId)} is defending`, [unitSquare(registry, e.unitId)]))
        else if (e.reason === 'acted') out.push(line('combat', ownerOf(e.unitId), `${label(e.unitId)} stopped defending (acted again)`, [unitSquare(registry, e.unitId)]))
        break
      case 'unitAttacked': {
        const target = e.target.kind === 'unit' ? labelWithSquare(registry, view, e.target.unitId) : squareName(e.target.square)
        const targetSquare = e.target.kind === 'unit' ? unitSquare(registry, e.target.unitId) : e.target.square
        const how = e.source === 'attack' ? 'attacked' : `attacked (${abilityName(e.source)})`
        out.push(line('combat', ownerOf(e.attackerId), `${labelWithSquare(registry, view, e.attackerId)} ${how} ${target}`, [unitSquare(registry, e.attackerId), targetSquare]))
        break
      }
      case 'attackMissed':
        out.push(line('combat', 'me', `${label(e.attackerId)} fired at ${squareName(e.square)}: nothing there`, [e.square]))
        break
      case 'abilityUsed':
        out.push(line('combat', ownerOf(e.unitId), `${label(e.unitId)} used ${abilityName(e.abilityId)}`, [unitSquare(registry, e.unitId)]))
        break
      case 'abilityNote':
        out.push(line('combat', ownerOf(e.unitId), `${abilityName(e.abilityId)}: ${e.note}`, [unitSquare(registry, e.unitId)]))
        break
      case 'unitDamaged': {
        const from = e.dealerId === null ? (e.kind === 'mine' ? ' from a mine' : e.kind === 'tick' ? ` from ${sourceName(e.source)}` : ' from an unseen attacker') : ''
        const mine = registry.units[e.unitId]?.owner === me
        out.push(
          line('combat', ownerOf(e.unitId), `${label(e.unitId)} took ${e.amount} damage${from}${breakdownText(e.breakdown)} · ${e.toughness + e.amount} → ${Math.max(0, e.toughness)}`, [unitSquare(registry, e.unitId)], mine ? 'bad' : 'good'),
        )
        break
      }
      case 'unitHealed':
        out.push(line('combat', ownerOf(e.unitId), `${label(e.unitId)} regenerated ${e.amount} (${sourceName(e.source)}) · now ${e.toughness}`, [unitSquare(registry, e.unitId)], registry.units[e.unitId]?.owner === me ? 'good' : 'neutral'))
        break
      case 'toughnessLost':
        out.push(line('combat', ownerOf(e.unitId), `${label(e.unitId)} lost ${e.amount} toughness (${sourceName(e.source)}) · now ${e.toughness}`, [unitSquare(registry, e.unitId)]))
        break
      case 'maxToughnessChanged':
        out.push(line('combat', ownerOf(e.unitId), `${label(e.unitId)} max toughness ${e.delta > 0 ? '+' : '−'}${Math.abs(e.delta)} (${sourceName(e.source)})`, [unitSquare(registry, e.unitId)]))
        break
      case 'unitDied':
        out.push(line('combat', e.owner === me ? 'me' : 'opponent', `${label(e.unitId)} died at ${squareName(e.at)}`, [e.at], e.owner === me ? 'bad' : 'good'))
        break
      case 'unitRevived':
        out.push(line('combat', ownerOf(e.unitId), `${label(e.unitId)} returned at ${squareName(e.anchor)} with ${e.toughness} toughness`, [e.anchor], registry.units[e.unitId]?.owner === me ? 'good' : 'neutral'))
        break
      case 'unitCreated':
        out.push(line('combat', e.owner === me ? 'me' : 'opponent', `${label(e.unitId)} was created at ${squareName(e.anchor)}`, [e.anchor]))
        break
      case 'stealthChanged':
        out.push(line('combat', 'me', `${label(e.unitId)} ${e.stealthed ? 'is stealthed' : 'is visible again'}`, [unitSquare(registry, e.unitId)]))
        break
      case 'unitRevealed': {
        const mine = registry.units[e.unitId]?.owner === me
        const cause = e.cause === 'adjacency' ? 'next to an enemy' : e.cause === 'damage' ? 'hit inside enemy vision' : 'detected'
        out.push(line('combat', mine ? 'me' : 'opponent', `${label(e.unitId)} was revealed (${cause})`, [unitSquare(registry, e.unitId)], mine ? 'bad' : 'good'))
        break
      }
      case 'minePlaced':
        out.push(line('combat', 'me', `Your mine was placed at ${squareName(e.square)}`, [e.square]))
        break
      case 'mineRevealed':
        out.push(line('combat', e.owner === me ? 'me' : 'opponent', e.owner === me ? `Your mine at ${squareName(e.square)} was revealed` : `An enemy mine was revealed at ${squareName(e.square)}`, [e.square]))
        break
      case 'mineExploded': {
        const victim = e.victimId === null ? '' : `: ${label(e.victimId)} set it off`
        const whose = e.owner === me ? 'Your mine' : 'An enemy mine'
        out.push(line('combat', e.owner === me ? 'me' : 'opponent', `${whose} at ${squareName(e.square)} exploded${e.trigger === 'shot' ? ' (shot)' : ''}${victim}`, [e.square], 'bad'))
        break
      }
      case 'areaCreated':
        out.push(line('combat', e.owner === me ? 'me' : 'opponent', `${e.owner === me ? 'Your' : 'An enemy'} ${abilityName(e.abilityId)} covers ${e.squares.length} square${e.squares.length === 1 ? '' : 's'}`, e.squares))
        break
      case 'areaExpired':
        out.push(line('combat', 'system', 'An area effect ended'))
        break
      case 'buildingCaptured':
        out.push(line('objectives', e.seat === me ? 'me' : 'opponent', `${seatWord(ctx, e.seat)} captured ${buildingDef(e.building).name.replace(/^The /, 'the ')}`, [], e.seat === me ? 'good' : 'bad'))
        break
      case 'buildingContested':
        out.push(line('objectives', 'system', `${buildingDef(e.building).name} is contested`))
        break
      case 'buildingHeld':
        break
      case 'turnStarted': {
        const ap = events.slice(0, i).reverse().find((x) => x.type === 'apChanged' && x.seat === e.seat)
        const apText = ap?.type === 'apChanged' ? ` · ${ap.ap} AP` : ''
        out.push({ ...line('system', e.seat === me ? 'me' : 'opponent', `Round ${e.round} · ${e.seat === me ? 'Your turn' : `${ctx.names[e.seat]}'s turn`}${apText}`), separator: true })
        break
      }
      case 'apChanged':
      case 'turnEnded':
      case 'preferenceChanged':
      case 'matchSummary':
      case 'unitPlaced':
      case 'unitUnplaced':
        break
      case 'battleStarted':
        out.push(line('system', 'system', `The battle begins: ${seatWord(ctx, e.southSeat)} ${e.southSeat === me ? 'move' : 'moves'} first`))
        break
      case 'coinFlipped':
        out.push(line('system', 'system', `Coin flip: ${seatWord(ctx, e.southSeat)} ${e.southSeat === me ? 'play' : 'plays'} South and ${e.southSeat === me ? 'move' : 'moves'} first`))
        break
      case 'settingsChanged':
        out.push(line('system', 'system', 'The host changed the match settings'))
        break
      case 'armyChosen':
        out.push(line('system', 'system', `${seatWord(ctx, e.seat)} chose an army`))
        break
      case 'readyChanged':
        out.push(line('system', 'system', `${seatWord(ctx, e.seat)} ${e.ready ? (e.seat === me ? 'are ready' : 'is ready') : (e.seat === me ? 'are not ready' : 'is not ready')}`))
        break
      case 'deploymentStarted':
        out.push(line('system', 'system', 'Deployment begins'))
        break
      case 'deploymentConfirmed':
        out.push(line('system', 'system', `${seatWord(ctx, e.seat)} ${e.confirmed ? 'confirmed the deployment' : 'withdrew the confirmation'}`))
        break
      case 'decisionRequested':
        out.push(line('system', e.seat === me ? 'me' : 'opponent', e.seat === me ? 'A reaction needs your answer' : `${ctx.names[e.seat]} is deciding`))
        break
      case 'decisionResolved':
        out.push(line('system', e.seat === me ? 'me' : 'opponent', `${seatWord(ctx, e.seat)} answered "${e.choice}"${e.automatic ? ' (automatic)' : ''}`))
        break
      case 'takebackRequested':
        out.push(line('system', e.seat === me ? 'me' : 'opponent', e.seat === me ? 'You asked to take back your last action' : `${ctx.names[e.seat]} asks to take back their last action`))
        break
      case 'takebackDeclined':
        out.push(line('system', 'system', `The take-back was declined`, [], 'bad'))
        break
      case 'takebackApplied':
        out.push(line('system', 'system', `The take-back was accepted: the action is undone`))
        break
      case 'drawOffered':
        out.push(line('system', 'system', `${seatWord(ctx, e.seat)} offered a draw`))
        break
      case 'drawDeclined':
        out.push(line('system', 'system', `The draw offer was declined`))
        break
      case 'gameEnded': {
        const text = resultText(e.result, me)
        out.push(line('system', 'system', `${text.headline}: ${text.reason}`, [], e.result.winner === me ? 'good' : e.result.winner === null ? 'neutral' : 'bad'))
        break
      }
    }
  }
  return out
}

export function logAsText(entries: readonly LogEntry[]): string {
  return entries.map((e) => (e.separator ? `--- ${e.text} ---` : `R${e.round} ${e.actor === 'me' ? 'You' : e.actor === 'opponent' ? 'Opp' : '   '}  ${e.undone ? '(taken back) ' : ''}${e.text}`)).join('\n')
}

export function matchesFilter(entry: LogEntry, filter: 'all' | LogCategory): boolean {
  return filter === 'all' || entry.separator || entry.category === filter
}
