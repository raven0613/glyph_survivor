import {
  CREATURE_BODY_MOTION_BEHAVIOR,
  type CreatureDefinition,
  type SnakeSqueezeBodyMotionDefinition,
} from '../content/creatures/creatureDefinition.ts'
import type { GlyphCell } from '../glyph/glyphStore.ts'
import type {
  EnemyState,
  HorizontalFacing,
} from '../runtime/worldEntities.ts'
import type { WorldState } from '../runtime/worldState.ts'

const LEFT_FACING: HorizontalFacing = -1
const HALF_TURN_RADIANS = Math.PI
const MOTION_EPSILON = 0.000_001
const SNA_MOTION_GROUP = 0
const K_MOTION_GROUP = 1
const E_MOTION_GROUP = 2

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function smoothStep(value: number): number {
  const clampedValue = clampUnit(value)
  return clampedValue * clampedValue * (3 - 2 * clampedValue)
}

function wrapUnit(value: number): number {
  return value - Math.floor(value)
}

function getMovementIntensity(
  enemy: EnemyState,
  definition: CreatureDefinition,
): number {
  if (definition.maximumSpeed <= 0) {
    return 0
  }
  return Math.min(
    1,
    Math.hypot(enemy.velocityX, enemy.velocityY) / definition.maximumSpeed,
  )
}

function getDesiredFacing(
  enemy: EnemyState,
  definition: CreatureDefinition,
  profile: SnakeSqueezeBodyMotionDefinition,
): HorizontalFacing | null {
  if (definition.maximumSpeed <= 0) {
    return null
  }
  const horizontalIntensity =
    Math.abs(enemy.velocityX) / definition.maximumSpeed
  if (horizontalIntensity <= profile.horizontalDirectionDeadZoneRatio) {
    return null
  }
  return enemy.velocityX < 0 ? LEFT_FACING : 1
}

function reverseSnakeTurn(enemy: EnemyState): void {
  const previousFacing = enemy.bodyMotionFacing
  enemy.bodyMotionFacing = enemy.bodyMotionTargetFacing
  enemy.bodyMotionTargetFacing = previousFacing
  enemy.bodyMotionTurnProgress = 1 - enemy.bodyMotionTurnProgress
}

function updateSnakeTurn(
  enemy: EnemyState,
  desiredFacing: HorizontalFacing | null,
  profile: SnakeSqueezeBodyMotionDefinition,
  deltaMs: number,
): boolean {
  const wasTurning =
    enemy.bodyMotionFacing !== enemy.bodyMotionTargetFacing

  if (desiredFacing !== null) {
    if (!wasTurning && desiredFacing !== enemy.bodyMotionFacing) {
      enemy.bodyMotionTargetFacing = desiredFacing
      enemy.bodyMotionTurnProgress = 0
      enemy.bodyMotionProgress = 0
    } else if (wasTurning && desiredFacing === enemy.bodyMotionFacing) {
      reverseSnakeTurn(enemy)
    }
  }

  if (enemy.bodyMotionFacing === enemy.bodyMotionTargetFacing) {
    return false
  }

  enemy.bodyMotionTurnProgress = Math.min(
    1,
    enemy.bodyMotionTurnProgress + Math.max(0, deltaMs) / profile.turnDurationMs,
  )
  if (enemy.bodyMotionTurnProgress === 1) {
    enemy.bodyMotionFacing = enemy.bodyMotionTargetFacing
    enemy.bodyMotionTurnProgress = 0
    enemy.bodyMotionProgress = 0
  }
  return true
}

function advanceSnakeSqueezeProgress(
  enemy: EnemyState,
  movementIntensity: number,
  profile: SnakeSqueezeBodyMotionDefinition,
  deltaMs: number,
): number {
  let progress = wrapUnit(enemy.bodyMotionProgress)
  if (movementIntensity > 0) {
    progress = wrapUnit(
      progress +
        (Math.max(0, deltaMs) / profile.cycleDurationMs) * movementIntensity,
    )
  } else if (
    progress >= profile.squeezeStartRatio &&
    progress < profile.squeezeEndRatio
  ) {
    progress += Math.max(0, deltaMs) / profile.cycleDurationMs
    if (progress >= profile.squeezeEndRatio) {
      progress = 0
    }
  } else {
    progress = 0
  }
  enemy.bodyMotionProgress = progress
  return progress
}

function sampleSqueezeAmount(
  progress: number,
  profile: SnakeSqueezeBodyMotionDefinition,
): number {
  if (
    progress < profile.squeezeStartRatio ||
    progress >= profile.squeezeEndRatio
  ) {
    return 0
  }
  if (progress < profile.squeezePeakRatio) {
    return smoothStep(
      (progress - profile.squeezeStartRatio) /
        (profile.squeezePeakRatio - profile.squeezeStartRatio),
    )
  }
  if (progress <= profile.squeezeHoldEndRatio) {
    return 1
  }
  return 1 - smoothStep(
    (progress - profile.squeezeHoldEndRatio) /
      (profile.squeezeEndRatio - profile.squeezeHoldEndRatio),
  )
}

function getGroupCompression(
  motionGroup: number,
  profile: SnakeSqueezeBodyMotionDefinition,
  squeezeAmount: number,
): number {
  if (motionGroup === SNA_MOTION_GROUP) {
    return profile.snaCompressionDistance * squeezeAmount
  }
  if (motionGroup === E_MOTION_GROUP) {
    return -profile.eCompressionDistance * squeezeAmount
  }
  return 0
}

function setSnakeGlyphMotion(
  world: WorldState,
  glyph: GlyphCell,
  targetX: number,
  targetY: number,
): void {
  const offsetX = targetX - glyph.localX
  const offsetY = targetY - glyph.localY
  world.glyphStore.setGlyphBodyMotion(
    glyph.id,
    Math.abs(offsetX) <= MOTION_EPSILON ? 0 : offsetX,
    Math.abs(offsetY) <= MOTION_EPSILON ? 0 : offsetY,
    0,
  )
}

function applySnakeSqueezePose(
  world: WorldState,
  enemy: EnemyState,
  profile: SnakeSqueezeBodyMotionDefinition,
  orientationCos: number,
  orientationSin: number,
  squeezeAmount: number,
): void {
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index]
    const motionGroup = profile.groupBySlotId[glyph.bodySlotId]
    const bodyAxisX =
      glyph.localX +
      getGroupCompression(motionGroup, profile, squeezeAmount)
    const kLift =
      motionGroup === K_MOTION_GROUP
        ? profile.kLiftDistance * squeezeAmount
        : 0
    setSnakeGlyphMotion(
      world,
      glyph,
      bodyAxisX * orientationCos,
      bodyAxisX * orientationSin + glyph.localY - kLift,
    )
  }
}

function applySnakeTurnPose(
  world: WorldState,
  enemy: EnemyState,
  profile: SnakeSqueezeBodyMotionDefinition,
): void {
  const easedProgress = smoothStep(enemy.bodyMotionTurnProgress)
  const startsFacingLeft = enemy.bodyMotionFacing === LEFT_FACING
  const orientationRadians = startsFacingLeft
    ? HALF_TURN_RADIANS * easedProgress
    : HALF_TURN_RADIANS * (1 - easedProgress)
  const squeezeAmount = Math.sin(
    HALF_TURN_RADIANS * enemy.bodyMotionTurnProgress,
  )
  applySnakeSqueezePose(
    world,
    enemy,
    profile,
    Math.cos(orientationRadians),
    Math.sin(orientationRadians),
    squeezeAmount,
  )
}

function applySnakeLocomotionPose(
  world: WorldState,
  enemy: EnemyState,
  profile: SnakeSqueezeBodyMotionDefinition,
  progress: number,
): void {
  const isFacingLeft = enemy.bodyMotionFacing === LEFT_FACING
  applySnakeSqueezePose(
    world,
    enemy,
    profile,
    isFacingLeft ? 1 : -1,
    0,
    sampleSqueezeAmount(progress, profile),
  )
}

export function runSnakeSqueezeBodyMotion(
  world: WorldState,
  enemy: EnemyState,
  definition: CreatureDefinition,
  deltaMs: number,
): void {
  const profile = definition.bodyMotion
  if (profile.behaviorId !== CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE) {
    throw new Error(
      'SNAKE squeeze strategy requires a SNAKE_SQUEEZE profile.',
    )
  }
  const desiredFacing = getDesiredFacing(enemy, definition, profile)
  if (updateSnakeTurn(enemy, desiredFacing, profile, deltaMs)) {
    applySnakeTurnPose(world, enemy, profile)
    return
  }
  const movementIntensity = getMovementIntensity(enemy, definition)
  const progress = advanceSnakeSqueezeProgress(
    enemy,
    movementIntensity,
    profile,
    deltaMs,
  )
  applySnakeLocomotionPose(world, enemy, profile, progress)

  if (Math.abs(enemy.bodyMotionProgress) <= MOTION_EPSILON) {
    enemy.bodyMotionProgress = 0
  }
}
