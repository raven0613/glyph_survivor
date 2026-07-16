import type { RunModifierCompositionAppearance } from '../content/visuals/combatVisualThemeTypes.ts'

export interface ModifierPresentationMotion {
  readonly offsetX: number
  readonly offsetY: number
  readonly rotation: number
}

/** Resolves the one bounded Persistent Motion channel before Pixi sees it. */
export function composeModifierPresentationMotion(
  disconnected: Readonly<ModifierPresentationMotion>,
  volatile: Readonly<ModifierPresentationMotion>,
  limits: Readonly<RunModifierCompositionAppearance>,
): ModifierPresentationMotion {
  const combinedX = disconnected.offsetX + volatile.offsetX
  const combinedY = disconnected.offsetY + volatile.offsetY
  const magnitude = Math.hypot(combinedX, combinedY)
  const scale = magnitude > limits.maximumOffset
    ? limits.maximumOffset / magnitude
    : 1
  return {
    offsetX: combinedX * scale,
    offsetY: combinedY * scale,
    rotation: Math.max(
      -limits.maximumRotation,
      Math.min(
        limits.maximumRotation,
        disconnected.rotation + volatile.rotation,
      ),
    ),
  }
}

/** OVERLOAD owns Transient Deformation while its directional squeeze is active. */
export function resolveVolatileSourceScaleMultiplier(
  volatileScaleMultiplier: number,
  hasActiveOverloadDeformation: boolean,
): number {
  return hasActiveOverloadDeformation ? 1 : volatileScaleMultiplier
}
