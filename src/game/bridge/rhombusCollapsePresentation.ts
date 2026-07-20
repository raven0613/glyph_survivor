import type { RhombusCollapseProfile } from '../content/bosses/rhombusBoss.ts'
import type { RhombusCollapseAppearance } from '../content/visuals/combatVisualThemeTypes.ts'
import type { RhombusCollapseGlyphPlan } from '../runtime/rhombusCollapseState.ts'

export interface RhombusCollapsePose {
  x: number
  y: number
  rotation: number
  alpha: number
  tint: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

function mixTint(from: number, to: number, progress: number): number {
  const fromRed = (from >>> 16) & 0xff
  const fromGreen = (from >>> 8) & 0xff
  const fromBlue = from & 0xff
  const toRed = (to >>> 16) & 0xff
  const toGreen = (to >>> 8) & 0xff
  const toBlue = to & 0xff
  return (
    (Math.round(mix(fromRed, toRed, progress)) << 16) |
    (Math.round(mix(fromGreen, toGreen, progress)) << 8) |
    Math.round(mix(fromBlue, toBlue, progress))
  )
}

export function writeRhombusCollapsePose(
  output: RhombusCollapsePose,
  plan: Readonly<RhombusCollapseGlyphPlan>,
  elapsedMs: number,
  profile: Readonly<RhombusCollapseProfile>,
  appearance: Readonly<RhombusCollapseAppearance>,
): void {
  const fallElapsedMs =
    elapsedMs - appearance.brightnessLiftDurationMs - plan.fallDelayMs
  const fallProgress = clamp01(fallElapsedMs / profile.fallDurationMs)
  const fallMotionProgress = fallProgress ** 2
  const settleProgress = clamp01(
    (fallElapsedMs - profile.fallDurationMs) / profile.settleDurationMs,
  )
  const settleMotionProgress = easeOutCubic(settleProgress)
  const presentationProgress = clamp01(
    (elapsedMs - appearance.brightnessLiftDurationMs) /
      (profile.maximumFallDelayMs +
        profile.fallDurationMs +
        profile.settleDurationMs),
  )

  if (fallProgress < 1) {
    output.x = mix(plan.startX, plan.landingX, fallMotionProgress)
    output.y = mix(plan.startY, plan.landingY, fallMotionProgress)
    output.rotation = mix(
      plan.startRotation,
      plan.targetRotation,
      fallMotionProgress * 0.88,
    )
  } else {
    output.x = mix(plan.landingX, plan.targetX, settleMotionProgress)
    output.y = mix(plan.landingY, plan.targetY, settleMotionProgress)
    output.rotation = mix(
      mix(plan.startRotation, plan.targetRotation, 0.88),
      plan.targetRotation,
      settleMotionProgress,
    )
  }
  output.alpha = mix(
    appearance.brightnessLift.alpha,
    appearance.settledPile.alpha,
    presentationProgress,
  )
  output.tint = mixTint(
    appearance.brightnessLift.tint,
    appearance.settledPile.tint,
    presentationProgress,
  )
}
