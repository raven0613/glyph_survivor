import {
  CREATURE_BODY_MOTION_BEHAVIOR,
  type CreatureBodyMotionBehaviorId,
  type CreatureDefinition,
} from '../content/creatures/creatureDefinition.ts'
import type { GlyphCell } from '../glyph/glyphStore.ts'
import type { EnemyState } from '../runtime/worldEntities.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { runSnakeSqueezeBodyMotion } from './snakeBodyMotion.ts'
import { advanceComponentOrbitState } from '../runtime/componentOrbitState.ts'

type CreatureBodyMotionStrategy = (
  world: WorldState,
  enemy: EnemyState,
  definition: CreatureDefinition,
  deltaMs: number,
) => void

const BAT_WING_TIMES = Object.freeze([0, 0.1, 0.22, 0.46, 0.58, 0.78, 1])
const BAT_WING_VALUES = Object.freeze([0, -5, -5, 4, 4, 0, 0])
const BAT_T_PHASE_DELAY = 0.055
const BAT_BODY_COMPENSATION = -0.1

const BONE_RATTLE_TIMES = Object.freeze([
  0, 0.08, 0.15, 0.23, 0.31, 0.58, 0.66, 0.74, 0.82, 1,
])
const BONE_RATTLE_VALUES = Object.freeze([
  0, 1, 0, -0.65, 0, 0, -1, 0, 0.6, 0,
])
const BONE_SECOND_CELL_PHASE_DELAY = 0.5
const BONE_ROTATION_RADIANS = 0.045

const ZOMBIE_STAGGER_TIMES = Object.freeze([
  0, 0.2, 0.28, 0.36, 0.58, 0.66, 0.74, 1,
])
const ZOMBIE_STAGGER_VALUES = Object.freeze([0, -1, 0.2, 0, 1, -0.2, 0, 0])
const ZOMBIE_MAX_ROTATION_RADIANS = (4 * Math.PI) / 180
const ZOMBIE_PIVOT_RADIUS_SCALE = 0.85
const QUARTER_TURN_RADIANS = Math.PI / 2
const QUARTER_TURNS_PER_CYCLE = 4
const ROCK_POSE_EPSILON = 0.000_001

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value)
}

function wrapUnit(value: number): number {
  return value - Math.floor(value)
}

function sampleTrack(
  phase: number,
  times: readonly number[],
  values: readonly number[],
): number {
  for (let index = 1; index < times.length; index += 1) {
    if (phase > times[index]) {
      continue
    }
    const previousTime = times[index - 1]
    const progress = smoothStep(
      (phase - previousTime) / (times[index] - previousTime),
    )
    const previousValue = values[index - 1]
    return previousValue + (values[index] - previousValue) * progress
  }
  return values[values.length - 1]
}

function getCyclePhase(
  enemy: EnemyState,
  definition: CreatureDefinition,
): number {
  const profile = definition.bodyMotion
  if (profile.behaviorId === CREATURE_BODY_MOTION_BEHAVIOR.ROCK_ROLL) {
    return 0
  }
  if (profile.behaviorId === CREATURE_BODY_MOTION_BEHAVIOR.COMPONENT_ORBIT) {
    return 0
  }
  const duration = profile.cycleDurationMs
  if (duration <= 0) {
    return 0
  }
  return wrapUnit(
    enemy.behaviorElapsedMs / duration + enemy.bodyMotionPhaseOffset,
  )
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

function setGlyphMotion(
  world: WorldState,
  glyph: GlyphCell,
  offsetX: number,
  offsetY: number,
  rotation: number,
): void {
  world.glyphStore.setGlyphBodyMotion(
    glyph.id,
    offsetX,
    offsetY,
    rotation,
  )
}

const noBodyMotion: CreatureBodyMotionStrategy = () => {}

const componentOrbit: CreatureBodyMotionStrategy = (
  world,
  enemy,
  definition,
  deltaMs,
) => {
  advanceComponentOrbitState(
    enemy,
    definition,
    world.glyphStore,
    deltaMs,
    world.diagnostics,
  )
}

const batFlap: CreatureBodyMotionStrategy = (world, enemy, definition) => {
  const phase = getCyclePhase(enemy, definition)
  const aWingOffsetY = sampleTrack(phase, BAT_WING_TIMES, BAT_WING_VALUES)
  const tWingOffsetY = sampleTrack(
    wrapUnit(phase - BAT_T_PHASE_DELAY),
    BAT_WING_TIMES,
    BAT_WING_VALUES,
  )
  const bodyOffsetY =
    (aWingOffsetY + tWingOffsetY) * BAT_BODY_COMPENSATION
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)

  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index]
    const motionGroup = definition.bodyMotion.groupBySlotId[glyph.bodySlotId]
    const offsetY =
      motionGroup === 1
        ? aWingOffsetY
        : motionGroup === 2
          ? tWingOffsetY
          : bodyOffsetY
    setGlyphMotion(world, glyph, 0, offsetY, 0)
  }
}

const boneRattle: CreatureBodyMotionStrategy = (world, enemy, definition) => {
  const movementIntensity = getMovementIntensity(enemy, definition)
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  if (movementIntensity === 0) {
    for (let index = 0; index < glyphs.length; index += 1) {
      setGlyphMotion(world, glyphs[index], 0, 0, 0)
    }
    return
  }
  const phase = getCyclePhase(enemy, definition)
  const firstCellPulse =
    sampleTrack(phase, BONE_RATTLE_TIMES, BONE_RATTLE_VALUES) *
    movementIntensity
  const secondCellPulse =
    sampleTrack(
      wrapUnit(phase - BONE_SECOND_CELL_PHASE_DELAY),
      BONE_RATTLE_TIMES,
      BONE_RATTLE_VALUES,
    ) * movementIntensity
  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index]
    const motionGroup = definition.bodyMotion.groupBySlotId[glyph.bodySlotId]
    const pulse = motionGroup === 0 ? firstCellPulse : secondCellPulse
    const direction = motionGroup === 0 ? -1 : 1
    setGlyphMotion(
      world,
      glyph,
      direction * pulse * 0.8,
      -Math.abs(pulse) * 1.8,
      direction * pulse * BONE_ROTATION_RADIANS,
    )
  }
}

const zombieStagger: CreatureBodyMotionStrategy = (
  world,
  enemy,
  definition,
) => {
  const movementIntensity = getMovementIntensity(enemy, definition)
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  if (movementIntensity === 0) {
    for (let index = 0; index < glyphs.length; index += 1) {
      setGlyphMotion(world, glyphs[index], 0, 0, 0)
    }
    return
  }
  const stagger = sampleTrack(
    getCyclePhase(enemy, definition),
    ZOMBIE_STAGGER_TIMES,
    ZOMBIE_STAGGER_VALUES,
  )
  const rotation =
    stagger * movementIntensity * ZOMBIE_MAX_ROTATION_RADIANS
  const sinRotation = Math.sin(rotation)
  const cosRotation = Math.cos(rotation)
  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index]
    const pivotLength = glyph.collisionRadius * ZOMBIE_PIVOT_RADIUS_SCALE
    setGlyphMotion(
      world,
      glyph,
      pivotLength * sinRotation,
      pivotLength * (1 - cosRotation),
      rotation,
    )
  }
}

function moveToward(value: number, target: number, maximumDelta: number): number {
  if (Math.abs(target - value) <= maximumDelta) {
    return target
  }
  return value + Math.sign(target - value) * maximumDelta
}

function getShortestCycleDelta(fromPhase: number, toPhase: number): number {
  let delta = toPhase - fromPhase
  if (delta > 0.5) {
    delta -= 1
  } else if (delta < -0.5) {
    delta += 1
  }
  return delta
}

function advanceRockRollProgress(
  enemy: EnemyState,
  definition: CreatureDefinition,
  deltaMs: number,
): number {
  const profile = definition.bodyMotion
  if (profile.behaviorId !== CREATURE_BODY_MOTION_BEHAVIOR.ROCK_ROLL) {
    throw new Error('ROCK roll strategy requires a ROCK_ROLL profile.')
  }

  let progress = wrapUnit(enemy.bodyMotionProgress)
  const horizontalIntensity =
    definition.maximumSpeed > 0
      ? Math.min(1, Math.abs(enemy.velocityX) / definition.maximumSpeed)
      : 0
  if (horizontalIntensity > profile.horizontalDirectionDeadZoneRatio) {
    const direction = Math.sign(enemy.velocityX)
    let remainingDeltaMs = Math.max(0, deltaMs)
    while (remainingDeltaMs > ROCK_POSE_EPSILON) {
      if (enemy.bodyMotionHoldRemainingMs > 0) {
        const consumedHoldMs = Math.min(
          remainingDeltaMs,
          enemy.bodyMotionHoldRemainingMs,
        )
        enemy.bodyMotionHoldRemainingMs -= consumedHoldMs
        remainingDeltaMs -= consumedHoldMs
        continue
      }

      const quarterProgress = progress * QUARTER_TURNS_PER_CYCLE
      const nearestPose = Math.round(quarterProgress)
      const isAtPose =
        Math.abs(quarterProgress - nearestPose) <= ROCK_POSE_EPSILON
      if (isAtPose) {
        const fullCadenceDurationMs =
          profile.fullRollDurationMs / horizontalIntensity +
          QUARTER_TURNS_PER_CYCLE * profile.poseHoldDurationMs
        const completeCycles = Math.floor(
          remainingDeltaMs / fullCadenceDurationMs,
        )
        if (completeCycles > 0) {
          remainingDeltaMs -= completeCycles * fullCadenceDurationMs
          continue
        }
      }
      const targetPose =
        direction > 0
          ? isAtPose
            ? nearestPose + 1
            : Math.ceil(quarterProgress)
          : isAtPose
            ? nearestPose - 1
            : Math.floor(quarterProgress)
      const progressToTarget =
        Math.abs(targetPose - quarterProgress) / QUARTER_TURNS_PER_CYCLE
      const progressPerMs = horizontalIntensity / profile.fullRollDurationMs
      const timeToTargetMs = progressToTarget / progressPerMs

      if (remainingDeltaMs + ROCK_POSE_EPSILON >= timeToTargetMs) {
        progress = wrapUnit(targetPose / QUARTER_TURNS_PER_CYCLE)
        remainingDeltaMs = Math.max(0, remainingDeltaMs - timeToTargetMs)
        enemy.bodyMotionHoldRemainingMs = profile.poseHoldDurationMs
      } else {
        progress = wrapUnit(
          progress + direction * remainingDeltaMs * progressPerMs,
        )
        remainingDeltaMs = 0
      }
    }
  } else {
    enemy.bodyMotionHoldRemainingMs = 0
    const nearestPoseProgress =
      Math.round(progress * QUARTER_TURNS_PER_CYCLE) /
      QUARTER_TURNS_PER_CYCLE
    const settleDelta = getShortestCycleDelta(progress, nearestPoseProgress)
    const maximumSettleProgress =
      (deltaMs / profile.fullRollDurationMs) * profile.settleSpeedMultiplier
    progress = wrapUnit(
      progress + moveToward(0, settleDelta, maximumSettleProgress),
    )
  }
  enemy.bodyMotionProgress = progress
  return progress
}

function sampleRockRollAngle(progress: number): number {
  const quarterProgress = progress * QUARTER_TURNS_PER_CYCLE
  const poseIndex = Math.floor(quarterProgress)
  const segmentProgress = quarterProgress - poseIndex
  return (poseIndex + smoothStep(segmentProgress)) * QUARTER_TURN_RADIANS
}

const rockRoll: CreatureBodyMotionStrategy = (
  world,
  enemy,
  definition,
  deltaMs,
) => {
  const profile = definition.bodyMotion
  if (profile.behaviorId !== CREATURE_BODY_MOTION_BEHAVIOR.ROCK_ROLL) {
    throw new Error('ROCK roll strategy requires a ROCK_ROLL profile.')
  }
  const angle = sampleRockRollAngle(
    advanceRockRollProgress(enemy, definition, deltaMs),
  )
  const sinAngle = Math.sin(angle)
  const cosAngle = Math.cos(angle)
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index]
    const rotatedX = glyph.localX * cosAngle - glyph.localY * sinAngle
    const rotatedY = glyph.localX * sinAngle + glyph.localY * cosAngle
    setGlyphMotion(
      world,
      glyph,
      rotatedX - glyph.localX,
      rotatedY - glyph.localY,
      0,
    )
  }
}

const BODY_MOTION_STRATEGIES: Readonly<
  Record<CreatureBodyMotionBehaviorId, CreatureBodyMotionStrategy>
> = Object.freeze({
  [CREATURE_BODY_MOTION_BEHAVIOR.NONE]: noBodyMotion,
  [CREATURE_BODY_MOTION_BEHAVIOR.BAT_FLAP]: batFlap,
  [CREATURE_BODY_MOTION_BEHAVIOR.BONE_RATTLE]: boneRattle,
  [CREATURE_BODY_MOTION_BEHAVIOR.COMPONENT_ORBIT]: componentOrbit,
  [CREATURE_BODY_MOTION_BEHAVIOR.ROCK_ROLL]: rockRoll,
  [CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE]:
    runSnakeSqueezeBodyMotion,
  [CREATURE_BODY_MOTION_BEHAVIOR.ZOMBIE_STAGGER]: zombieStagger,
})

export function runCreatureBodyMotionBehavior(
  world: WorldState,
  enemy: EnemyState,
  definition: CreatureDefinition,
  deltaMs = 0,
): void {
  BODY_MOTION_STRATEGIES[definition.bodyMotion.behaviorId](
    world,
    enemy,
    definition,
    deltaMs,
  )
}
