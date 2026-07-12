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
  const fromPose = definition.body.poses[fromPoseId]
  const toPose = definition.body.poses[toPoseId]

  if (!fromPose || !toPose) {
    throw new Error(`Creature ${definition.id} is missing a morph pose.`)
  }

  for (const glyph of world.glyphStore.getOwnerGlyphs(enemy.id)) {
    const from = fromPose.anchorsBySlotId[glyph.bodySlotId]
    const to = toPose.anchorsBySlotId[glyph.bodySlotId]
    world.glyphStore.setGlyphLocalPosition(
      glyph.id,
      from.localX + (to.localX - from.localX) * segmentProgress,
      from.localY + (to.localY - from.localY) * segmentProgress,
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
