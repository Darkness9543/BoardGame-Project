// Small shared pieces: keys, copy buttons, countdowns, modals and the toast stack.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useToasts } from '../../store/toasts'
import { useNow } from '../hooks/useNow'
import { copyText } from './clipboard'

export function Kbd({ children }: { readonly children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

export function CopyButton({ text, label = 'Copy', className }: { readonly text: string; readonly label?: string; readonly className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(timer)
  }, [state])
  return (
    <button type="button" className={className ?? 'btn'} onClick={() => void copyText(text).then((ok) => setState(ok ? 'copied' : 'failed'))}>
      {state === 'copied' ? 'Copied ✓' : state === 'failed' ? 'Select and copy' : label}
    </button>
  )
}

function secondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

export function Countdown({ deadline, total }: { readonly deadline: number; readonly total: number }) {
  const now = useNow(250)
  const left = secondsLeft(deadline, now)
  const fraction = total > 0 ? Math.min(1, Math.max(0, (deadline - now) / (total * 1000))) : 0
  return (
    <span className={`countdown ${left <= 5 ? 'countdown-low' : ''}`} role="timer" aria-label={`${left} seconds left`}>
      <span className="countdown-bar" style={{ width: `${fraction * 100}%` }} />
      <span className="countdown-text">0:{String(left).padStart(2, '0')}</span>
    </span>
  )
}

/** A dialog: focus moves inside, Esc closes when allowed, the backdrop never closes it by accident. */
export function Modal({
  title,
  children,
  onClose,
  className,
  labelledActions,
}: {
  readonly title: string
  readonly children: ReactNode
  readonly onClose?: () => void
  readonly className?: string
  readonly labelledActions?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  // The latest onClose, so a parent's inline callback does not re-run the focus effect on every render.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = ref.current
    const first = root?.querySelector<HTMLElement>('[data-autofocus]') ?? root?.querySelector<HTMLElement>('button, [href], input, select, textarea')
    // preventScroll: a long sheet opens at its top even when its first button is at the bottom.
    first?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      const onEscape = close.current
      if (e.key === 'Escape' && onEscape !== undefined) {
        e.stopPropagation()
        onEscape()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      previous?.focus({ preventScroll: true })
    }
  }, [])
  return (
    <div className="modal-backdrop">
      <div ref={ref} className={`modal ${className ?? ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="modal-title">{title}</h2>
        <div className="modal-body">{children}</div>
        {labelledActions !== undefined && <div className="modal-actions">{labelledActions}</div>}
      </div>
    </div>
  )
}

export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} type="button" className={`toast toast-${t.tone}`} onClick={() => dismiss(t.id)}>
          {t.text}
        </button>
      ))}
    </div>
  )
}

/** A segmented choice (options, lobby settings). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  readonly value: T
  readonly options: readonly { readonly value: T; readonly label: string; readonly disabled?: boolean; readonly title?: string }[]
  readonly onChange: (value: T) => void
  readonly disabled?: boolean
  readonly label: string
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'seg seg-on' : 'seg'}
          disabled={disabled === true || o.disabled === true}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, disabled }: { readonly checked: boolean; readonly onChange: (on: boolean) => void; readonly label: string; readonly disabled?: boolean }) {
  return (
    <label className={`toggle ${disabled === true ? 'toggle-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span className="toggle-label">{label}</span>
    </label>
  )
}

export function ScreenHeader({ title, back, children }: { readonly title: string; readonly back?: { readonly label: string; readonly href: string }; readonly children?: ReactNode }) {
  return (
    <header className="screen-header">
      {back !== undefined && (
        <a className="btn btn-ghost" href={back.href}>
          ← {back.label}
        </a>
      )}
      <h1 className="screen-title">{title}</h1>
      <div className="screen-header-extra">{children}</div>
    </header>
  )
}
