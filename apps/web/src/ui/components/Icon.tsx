// Inline icons for HTML (currentColor) and inside SVG scenes (any fill).

import { EMPTY_ICON, useIcon } from './icons'

export function Icon({ name, size = 16, title, className }: { readonly name: string; readonly size?: number; readonly title?: string; readonly className?: string }) {
  const shape = useIcon(name)
  return (
    <svg
      className={className === undefined ? 'icon' : `icon ${className}`}
      viewBox={shape?.viewBox ?? EMPTY_ICON.viewBox}
      width={size}
      height={size}
      role={title === undefined ? undefined : 'img'}
      aria-hidden={title === undefined ? true : undefined}
      focusable="false"
    >
      {title !== undefined && <title>{title}</title>}
      {shape?.paths.map((d, i) => <path key={i} d={d} fill="currentColor" />)}
    </svg>
  )
}

/** An icon inside an SVG scene, centred on (x, y). */
export function Glyph({ name, x, y, size, fill, opacity }: { readonly name: string; readonly x: number; readonly y: number; readonly size: number; readonly fill: string; readonly opacity?: number }) {
  const shape = useIcon(name)
  if (shape === null || shape.paths.length === 0) return null
  return (
    <svg x={x - size / 2} y={y - size / 2} width={size} height={size} viewBox={shape.viewBox} opacity={opacity} overflow="visible" pointerEvents="none">
      {shape.paths.map((d, i) => (
        <path key={i} d={d} fill={fill} />
      ))}
    </svg>
  )
}
