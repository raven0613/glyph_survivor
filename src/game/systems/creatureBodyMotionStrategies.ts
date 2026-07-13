import {
  CREATURE_BODY_MOTION_BEHAVIOR,
  type CreatureBodyMotionBehaviorId,
  type CreatureDefinition,
} from '../content/creatures/creatureDefinition.ts'
import type { GlyphCell } from '../glyph/glyphStore.ts'
import type { EnemyState } from '../runtime/worldEntities.ts'
import type { WorldState } from '../runtime/worldState.ts'

type CreatureBodyMotionStrategy = (
  world: WorldState,
  enemy: EnemyState,
  definition: CreatureDefinition,
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
  const duration = definition.bodyMotionCycleDurationMs
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
    const motionGroup = definition.bodyMotionGroupBySlotId[glyph.bodySlotId]
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
    const motionGroup = definition.bodyMotionGroupBySlotId[glyph.bodySlotId]
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

const BODY_MOTION_STRATEGIES: Readonly<
  Record<CreatureBodyMotionBehaviorId, CreatureBodyMotionStrategy>
> = Object.freeze({
  [CREATURE_BODY_MOTION_BEHAVIOR.NONE]: noBodyMotion,
  [CREATURE_BODY_MOTION_BEHAVIOR.BAT_FLAP]: batFlap,
  [CREATURE_BODY_MOTION_BEHAVIOR.BONE_RATTLE]: boneRattle,
  [CREATURE_BODY_MOTION_BEHAVIOR.ZOMBIE_STAGGER]: zombieStagger,
})

export function runCreatureBodyMotionBehavior(
  world: WorldState,
  enemy: EnemyState,
  definition: CreatureDefinition,
): void {
  BODY_MOTION_STRATEGIES[definition.bodyMotionBehaviorId](
    world,
    enemy,
    definition,
  )
}
