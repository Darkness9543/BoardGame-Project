// On-demand shadow maps. The key light is fixed in world space and the board never moves, so the shadow map only
// changes when scene CONTENT changes (tokens move, lift, appear or die; models load), never when the camera pans,
// zooms or switches between top and iso. Rendering the 1024x1024 depth pass on every frame was the single largest
// GPU cost during camera tweens; callers mark the map dirty and Lighting re-renders it on the next frame only.

let dirty = true

/** Call whenever something that casts or receives a shadow changed (or may have). Cheap; safe to call per frame. */
export function markShadowsDirty(): void {
  dirty = true
}

/** Lighting's frame hook: returns true once per dirty period and clears the flag. */
export function takeShadowsDirty(): boolean {
  if (!dirty) return false
  dirty = false
  return true
}
