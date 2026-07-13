import {
  CREATURE_LAYOUT_BEHAVIOR,
  type CreatureDefinition,
  type CreatureLayoutBehaviorId,
} from '../content/creatures/creatureDefinition.ts'
import type { EnemyState } from '../runtime/worldEntities.ts'
import type { WorldState } from '../runtime/worldState.ts'

type CreatureLayoutStrategy = (
  world: WorldState,
  enemy: EnemyState,
  definition: CreatureDefinition,
) => void

const staticLayout: CreatureLayoutStrategy = () => {}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value)
}

const COMPILED_POSE_SCALES = Object.freeze({
  neutral: Object.freeze({ x: 1, y: 1 }),
  wide: Object.freeze({ x: 1.15, y: 0.75 }),
  tall: Object.freeze({ x: 0.75, y: 1.15 }),
})

function applyMorphStrength(scale: number, strength: number): number {
  return 1 + (scale - 1) * strength
}

const slimeMorph: CreatureLayoutStrategy = (world, enemy, definition) => {
  const duration = definition.layoutCycleDurationMs
  if (duration <= 0) {
    return
  }

  const segmentDuration = duration / 4
  const cycleTime = enemy.behaviorElapsedMs % duration
  const segmentIndex = Math.min(3, Math.floor(cycleTime / segmentDuration))
  const segmentProgress = smoothStep(
    (cycleTime - segmentIndex * segmentDuration) / segmentDuration,
  )
  const posePairs = [
    ['neutral', 'wide'],
    ['wide', 'neutral'],
    ['neutral', 'tall'],
    ['tall', 'neutral'],
  ] as const
  const [fromPoseId, toPoseId] = posePairs[segmentIndex]
  if (enemy.layoutMode === 'COMPILED') {
    const fromScale = COMPILED_POSE_SCALES[fromPoseId]
    const toScale = COMPILED_POSE_SCALES[toPoseId]
    const effectiveFromScaleX = applyMorphStrength(
      fromScale.x,
      definition.compiledMorphStrength,
    )
    const effectiveFromScaleY = applyMorphStrength(
      fromScale.y,
      definition.compiledMorphStrength,
    )
    const effectiveToScaleX = applyMorphStrength(
      toScale.x,
      definition.compiledMorphStrength,
    )
    const effectiveToScaleY = applyMorphStrength(
      toScale.y,
      definition.compiledMorphStrength,
    )
    const scaleX =
      effectiveFromScaleX +
      (effectiveToScaleX - effectiveFromScaleX) * segmentProgress
    const scaleY =
      effectiveFromScaleY +
      (effectiveToScaleY - effectiveFromScaleY) * segmentProgress
    for (const glyph of world.glyphStore.getOwnerGlyphs(enemy.id)) {
      world.glyphStore.setGlyphLocalPosition(
        glyph.id,
        glyph.layoutBaseX * scaleX,
        glyph.layoutBaseY * scaleY,
      )
    }
    return
  }

  const fromPose = definition.body.poses[fromPoseId]
  const toPose = definition.body.poses[toPoseId]

  if (!fromPose || !toPose) {
    throw new Error(`Creature ${definition.id} is missing a morph pose.`)
  }

  const neutralPose = definition.body.poses.neutral
  if (!neutralPose) {
    throw new Error(`Creature ${definition.id} is missing its neutral pose.`)
  }

  for (const glyph of world.glyphStore.getOwnerGlyphs(enemy.id)) {
    const from = fromPose.anchorsBySlotId[glyph.bodySlotId]
    const to = toPose.anchorsBySlotId[glyph.bodySlotId]
    const neutral = neutralPose.anchorsBySlotId[glyph.bodySlotId]
    const effectiveFromX =
      neutral.localX +
      (from.localX - neutral.localX) * definition.authoredMorphStrength
    const effectiveFromY =
      neutral.localY +
      (from.localY - neutral.localY) * definition.authoredMorphStrength
    const effectiveToX =
      neutral.localX +
      (to.localX - neutral.localX) * definition.authoredMorphStrength
    const effectiveToY =
      neutral.localY +
      (to.localY - neutral.localY) * definition.authoredMorphStrength
    world.glyphStore.setGlyphLocalPosition(
      glyph.id,
      effectiveFromX + (effectiveToX - effectiveFromX) * segmentProgress,
      effectiveFromY + (effectiveToY - effectiveFromY) * segmentProgress,
    )
  }
}

const LAYOUT_STRATEGIES: Readonly<
  Record<CreatureLayoutBehaviorId, CreatureLayoutStrategy>
> = Object.freeze({
  [CREATURE_LAYOUT_BEHAVIOR.STATIC]: staticLayout,
  [CREATURE_LAYOUT_BEHAVIOR.SLIME_MORPH]: slimeMorph,
})

export function runCreatureLayoutBehavior(
  world: WorldState,
  enemy: EnemyState,
  definition: CreatureDefinition,
): void {
  LAYOUT_STRATEGIES[definition.layoutBehaviorId](world, enemy, definition)
}
