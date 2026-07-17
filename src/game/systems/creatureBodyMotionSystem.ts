import { getCreatureDefinition } from '../content/gameContent.ts'
import { CREATURE_BODY_MOTION_BEHAVIOR } from '../content/creatures/creatureDefinition.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { runCreatureBodyMotionBehavior } from './creatureBodyMotionStrategies.ts'

export function runCreatureBodyMotionSystem(
  world: WorldState,
  deltaMs: number,
): void {
  const startedAtMs = performance.now()
  let animatedCreatureCount = 0
  let animatedOutlineGlyphCount = 0

  for (let index = 0; index < world.enemies.length; index += 1) {
    const enemy = world.enemies[index]
    if (enemy.phase !== 'ACTIVE') {
      continue
    }
    const definition = getCreatureDefinition(world.content, enemy.definitionId)
    if (
      definition.bodyMotion.behaviorId ===
      CREATURE_BODY_MOTION_BEHAVIOR.NONE
    ) {
      continue
    }
    runCreatureBodyMotionBehavior(world, enemy, definition, deltaMs)
    animatedCreatureCount += 1
    animatedOutlineGlyphCount += world.glyphStore.getOwnerGlyphs(enemy.id).length
  }

  const stepTimeMs = performance.now() - startedAtMs
  world.diagnostics.bodyMotionStepTimeMs = stepTimeMs
  world.diagnostics.bodyMotionActiveCreatureCount = animatedCreatureCount
  world.diagnostics.bodyMotionActiveGlyphCount = animatedOutlineGlyphCount
  world.diagnostics.bodyMotionSimulationTimeMs += stepTimeMs
  world.diagnostics.bodyMotionEvaluationCount += animatedCreatureCount
  world.diagnostics.bodyMotionGlyphUpdateCount += animatedOutlineGlyphCount
}
