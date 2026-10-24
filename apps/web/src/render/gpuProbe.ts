// Detects a browser that renders WebGL in software (no hardware acceleration). On such a machine the 3D board
// draws every frame on the CPU: a camera glide drops to about 20 frames per second and the fans spin up, and no
// renderer setting can fix it. The player is told, once, and pointed at the fix (browser acceleration) or the
// 2D board. The probe asks for a context that must not carry a major performance caveat; browsers refuse one
// when only a software rasterizer is available.

let cached: { readonly software: boolean; readonly renderer: string } | null = null

export function probeGpu(): { readonly software: boolean; readonly renderer: string } {
  if (cached !== null) return cached
  let software = false
  let renderer = 'unknown'
  try {
    const canvas = document.createElement('canvas')
    const strict = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
    if (strict === null) {
      software = true
      const lax = document.createElement('canvas').getContext('webgl2')
      if (lax !== null) {
        const info = lax.getExtension('WEBGL_debug_renderer_info')
        const value: unknown = info === null ? lax.getParameter(lax.RENDERER) : lax.getParameter(info.UNMASKED_RENDERER_WEBGL)
        if (typeof value === 'string') renderer = value
        lax.getExtension('WEBGL_lose_context')?.loseContext()
      }
    } else {
      const info = strict.getExtension('WEBGL_debug_renderer_info')
      const value: unknown = info === null ? strict.getParameter(strict.RENDERER) : strict.getParameter(info.UNMASKED_RENDERER_WEBGL)
      if (typeof value === 'string') renderer = value
      strict.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    // A failed probe must never break the board; treat it as hardware.
  }
  cached = { software, renderer }
  return cached
}
