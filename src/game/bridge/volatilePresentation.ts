import type {
  EffectBeatTiming,
  VolatileNeighborJoltAppearance,
  VolatileReleaseAppearance,
  VolatileSourceClampAppearance,
} from '../content/visuals/combatVisualThemeTypes.ts'

export interface VolatileReleasePresentation {
  readonly distance: number
  readonly scale: number
  readonly alpha: number
}

export interface VolatileNeighborJolt {
  readonly offsetX: number
  readonly offsetY: number
  readonly rotation: number
}

function totalDurationMs(timing: Readonly<EffectBeatTiming>): number {
  return (
    timing.attackDurationMs +
    timing.holdDurationMs +
    timing.settleDurationMs
  )
}

function beatIntensity(
  ageMs: number,
  timing: Readonly<EffectBeatTiming>,
): number {
  if (ageMs < 0) {
    return 0
  }
  if (ageMs < timing.attackDurationMs) {
    const progress = ageMs / timing.attackDurationMs
    return 1 - (1 - progress) ** 3
  }
  const settleStartMs = timing.attackDurationMs + timing.holdDurationMs
  if (ageMs <= settleStartMs) {
    return 1
  }
  const progress = (ageMs - settleStartMs) / timing.settleDurationMs
  return progress < 1 ? (1 - progress) ** 3 : 0
}

export function calculateVolatileSourceScale(
  ageMs: number,
  profile: Readonly<VolatileSourceClampAppearance>,
): number {
  return 1 - (1 - profile.minimumScale) * beatIntensity(ageMs, profile)
}

export function calculateVolatileRelease(
  ageMs: number,
  profile: Readonly<VolatileReleaseAppearance>,
): VolatileReleasePresentation {
  const localAgeMs = ageMs - profile.delayMs
  if (localAgeMs < 0) {
    return { distance: profile.startDistance, scale: profile.glyphScale, alpha: 0 }
  }
  const progress = Math.max(
    0,
    Math.min(1, localAgeMs / totalDurationMs(profile)),
  )
  return {
    distance:
      profile.startDistance +
      (profile.endDistance - profile.startDistance) *
        (1 - (1 - progress) ** 2),
    scale: profile.glyphScale * (0.9 + progress * 0.1),
    alpha: profile.alpha * beatIntensity(localAgeMs, profile),
  }
}

export function calculateVolatileNeighborJolt(
  ageMs: number,
  directionX: number,
  directionY: number,
  glyphId: number,
  profile: Readonly<VolatileNeighborJoltAppearance>,
): VolatileNeighborJolt {
  const intensity = beatIntensity(ageMs - profile.delayMs, profile)
  const rotationSign = glyphId % 2 === 0 ? -1 : 1
  return {
    offsetX: directionX * profile.maximumOffset * intensity,
    offsetY: directionY * profile.maximumOffset * intensity,
    rotation: rotationSign * profile.maximumRotation * intensity,
  }
}
