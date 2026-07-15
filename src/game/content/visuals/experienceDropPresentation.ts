import type {
  CombatVisualTheme,
  VisualColor,
} from './combatVisualTheme.ts'

export interface ExperienceDropPresentation extends VisualColor {
  readonly scale: number
}

function mixChannel(start: number, end: number, progress: number): number {
  return Math.round(start + (end - start) * progress)
}

function mixVisualColor(
  start: VisualColor,
  end: VisualColor,
  progress: number,
): VisualColor {
  const startRed = (start.tint >> 16) & 0xff
  const startGreen = (start.tint >> 8) & 0xff
  const startBlue = start.tint & 0xff
  const endRed = (end.tint >> 16) & 0xff
  const endGreen = (end.tint >> 8) & 0xff
  const endBlue = end.tint & 0xff
  const red = mixChannel(startRed, endRed, progress)
  const green = mixChannel(startGreen, endGreen, progress)
  const blue = mixChannel(startBlue, endBlue, progress)
  return {
    tint: (red << 16) | (green << 8) | blue,
    alpha: start.alpha + (end.alpha - start.alpha) * progress,
  }
}

function getStableFlashOffset(dropId: number, intervalMs: number): number {
  const hashedId = Math.imul(dropId, 0x9e3779b1) >>> 0
  return hashedId % intervalMs
}

/** Resolves XP color from simulation age without consuming RNG or wall time. */
export function resolveExperienceDropPresentation(
  theme: CombatVisualTheme,
  ageMs: number,
  dropId: number,
): ExperienceDropPresentation {
  const appearance = theme.drops.experience
  const normalizedAgeMs = Math.max(0, ageMs)
  if (normalizedAgeMs <= appearance.freshDurationMs) {
    return { ...appearance.fresh, scale: appearance.scale }
  }

  const transitionAgeMs = normalizedAgeMs - appearance.freshDurationMs
  if (transitionAgeMs < appearance.settleTransitionMs) {
    const progress = transitionAgeMs / appearance.settleTransitionMs
    return {
      ...mixVisualColor(appearance.fresh, appearance.settled, progress),
      scale: appearance.scale,
    }
  }

  const settledAgeMs = transitionAgeMs - appearance.settleTransitionMs
  const flashPhaseMs =
    (settledAgeMs +
      getStableFlashOffset(dropId, appearance.flashIntervalMs)) %
    appearance.flashIntervalMs
  if (flashPhaseMs >= appearance.flashDurationMs) {
    return { ...appearance.settled, scale: appearance.scale }
  }

  const flashProgress = flashPhaseMs / appearance.flashDurationMs
  const intensity = Math.sin(flashProgress * Math.PI) ** 2
  return {
    ...mixVisualColor(appearance.settled, appearance.flash, intensity),
    scale: appearance.scale,
  }
}
