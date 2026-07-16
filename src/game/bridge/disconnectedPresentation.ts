import type {
  DisconnectedAmbientAppearance,
  DisconnectedHitShakeAppearance,
  EffectBeatTiming,
} from '../content/visuals/combatVisualThemeTypes.ts'

export interface DisconnectedMotion {
  readonly offsetX: number
  readonly offsetY: number
  readonly rotation: number
}

export interface DisconnectedAmbientInput {
  readonly presentationTimeMs: number
  readonly seedHash: number
  readonly componentId: number
  readonly glyphId: number
  readonly severity: number
  readonly topologyX: number
  readonly topologyY: number
  readonly centroidTopologyX: number
  readonly centroidTopologyY: number
  readonly suppressBurst?: boolean
}

const UINT_RANGE = 0x1_0000_0000
const FULL_TURN_RADIANS = Math.PI * 2

function mixUint(value: number): number {
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return (value ^ (value >>> 15)) >>> 0
}

function sampleUnit(...values: readonly number[]): number {
  let mixed = 0x811c9dc5
  for (const value of values) {
    mixed = mixUint(mixed ^ Math.imul(value, 0x9e3779b1))
  }
  return mixed / UINT_RANGE
}

function calculateBeatIntensity(
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

export function calculateDisconnectedAmbientMotion(
  input: Readonly<DisconnectedAmbientInput>,
  appearance: Readonly<DisconnectedAmbientAppearance>,
): DisconnectedMotion {
  if (input.severity <= 0) {
    return { offsetX: 0, offsetY: 0, rotation: 0 }
  }
  const centroidDeltaX = input.topologyX - input.centroidTopologyX
  const centroidDeltaY = input.topologyY - input.centroidTopologyY
  const centroidDistance = Math.hypot(centroidDeltaX, centroidDeltaY)
  const spacingOffset = appearance.maximumSpacingOffset * input.severity
  const spacingX =
    centroidDistance > 0 ? (centroidDeltaX / centroidDistance) * spacingOffset : 0
  const spacingY =
    centroidDistance > 0 ? (centroidDeltaY / centroidDistance) * spacingOffset : 0
  const staggerMs =
    sampleUnit(input.seedHash, input.componentId) * appearance.intervalMs
  const cycleAgeMs =
    (input.presentationTimeMs + staggerMs) % appearance.intervalMs
  const burstIntensity = calculateBeatIntensity(cycleAgeMs, appearance)
  const resolvedBurstIntensity = input.suppressBurst ? 0 : burstIntensity
  const angle =
    sampleUnit(input.seedHash, input.componentId, input.glyphId) *
    FULL_TURN_RADIANS
  const jitter =
    appearance.maximumJitterOffset * input.severity * resolvedBurstIntensity
  const rotationSign =
    sampleUnit(input.glyphId, input.componentId, input.seedHash) < 0.5 ? -1 : 1
  return {
    offsetX: spacingX + Math.cos(angle) * jitter,
    offsetY: spacingY + Math.sin(angle) * jitter,
    rotation:
      rotationSign *
      appearance.maximumRotation *
      input.severity *
      resolvedBurstIntensity,
  }
}

export function calculateDisconnectedHitMotion(
  ageMs: number,
  glyphId: number,
  directionX: number,
  directionY: number,
  severity: number,
  appearance: Readonly<DisconnectedHitShakeAppearance>,
): DisconnectedMotion {
  const commonIntensity = calculateBeatIntensity(ageMs, appearance)
  const settleStartMs =
    appearance.attackDurationMs + appearance.holdDurationMs
  const settleProgress = Math.max(
    0,
    Math.min(1, (ageMs - settleStartMs) / appearance.settleDurationMs),
  )
  const residualIntensity =
    settleProgress <= 0
      ? 0
      : settleProgress < 0.35
        ? settleProgress / 0.35
        : Math.max(0, (1 - settleProgress) / 0.65)
  const commonOffset = appearance.maximumOffset * severity * commonIntensity
  const residualOffset =
    appearance.maximumOffset *
    appearance.residualOffsetRatio *
    severity *
    residualIntensity
  const residualAngle = sampleUnit(glyphId, 0x51ed270b) * FULL_TURN_RADIANS
  const rotationSign = sampleUnit(glyphId, 0x68e31da4) < 0.5 ? -1 : 1
  return {
    offsetX: directionX * commonOffset + Math.cos(residualAngle) * residualOffset,
    offsetY: directionY * commonOffset + Math.sin(residualAngle) * residualOffset,
    rotation:
      rotationSign *
      appearance.maximumRotation *
      severity *
      residualIntensity,
  }
}
