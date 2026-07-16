import type {
  OverloadCompressionAppearance,
  OverloadShockwaveAppearance,
} from '../content/visuals/combatVisualThemeTypes.ts'

export interface OverloadCompressionScale {
  readonly parallelScale: number
  readonly perpendicularScale: number
}

export interface OverloadShockwavePresentation {
  readonly radius: number
  readonly alpha: number
  readonly scale: number
}

function getTotalDurationMs(profile: {
  readonly attackDurationMs: number
  readonly holdDurationMs: number
  readonly settleDurationMs: number
}): number {
  return (
    profile.attackDurationMs +
    profile.holdDurationMs +
    profile.settleDurationMs
  )
}

function calculateBeatIntensity(
  ageMs: number,
  profile: {
    readonly attackDurationMs: number
    readonly holdDurationMs: number
    readonly settleDurationMs: number
  },
): number {
  const clampedAgeMs = Math.max(0, Math.min(ageMs, getTotalDurationMs(profile)))
  if (clampedAgeMs < profile.attackDurationMs) {
    const progress = clampedAgeMs / profile.attackDurationMs
    return 1 - (1 - progress) ** 3
  }
  const settleStartMs = profile.attackDurationMs + profile.holdDurationMs
  if (clampedAgeMs <= settleStartMs) {
    return 1
  }
  const settleProgress =
    (clampedAgeMs - settleStartMs) / profile.settleDurationMs
  return Math.max(0, (1 - settleProgress) ** 3)
}

export function calculateOverloadCompression(
  ageMs: number,
  profile: Readonly<OverloadCompressionAppearance>,
): OverloadCompressionScale {
  const intensity = calculateBeatIntensity(ageMs, profile)
  return {
    parallelScale: 1 + (profile.parallelScale - 1) * intensity,
    perpendicularScale:
      1 + (profile.perpendicularScale - 1) * intensity,
  }
}

export function calculateOverloadShockwave(
  ageMs: number,
  profile: Readonly<OverloadShockwaveAppearance>,
): OverloadShockwavePresentation {
  const totalDurationMs = getTotalDurationMs(profile)
  const progress = Math.max(0, Math.min(1, ageMs / totalDurationMs))
  const intensity = calculateBeatIntensity(ageMs, profile)
  return {
    radius:
      profile.startRadius +
      (profile.endRadius - profile.startRadius) * (1 - (1 - progress) ** 2),
    alpha: profile.alpha * intensity,
    scale: profile.glyphScale * (0.9 + progress * 0.1),
  }
}
