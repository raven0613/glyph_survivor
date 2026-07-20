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
  let componentOrbitStepTimeMs = 0
  let activeRhombusEncounterCount = 0
  let activeRhombusGlyphCount = 0
  world.diagnostics.componentOrbitActiveGroupCount = 0
  world.diagnostics.componentOrbitPausedGroupCount = 0

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
    const ownerGlyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
    if (definition.id === world.content.rhombusBossDefinition.creature.id) {
      activeRhombusEncounterCount += 1
      activeRhombusGlyphCount += ownerGlyphs.length
    }
    if (
      definition.bodyMotion.behaviorId ===
      CREATURE_BODY_MOTION_BEHAVIOR.COMPONENT_ORBIT
    ) {
      const orbitStartedAtMs = performance.now()
      runCreatureBodyMotionBehavior(world, enemy, definition, deltaMs)
      componentOrbitStepTimeMs += performance.now() - orbitStartedAtMs
    } else {
      runCreatureBodyMotionBehavior(world, enemy, definition, deltaMs)
    }
    animatedCreatureCount += 1
    animatedOutlineGlyphCount += ownerGlyphs.length
  }

  const stepTimeMs = performance.now() - startedAtMs
  world.diagnostics.bodyMotionStepTimeMs = stepTimeMs
  world.diagnostics.bodyMotionActiveCreatureCount = animatedCreatureCount
  world.diagnostics.bodyMotionActiveGlyphCount = animatedOutlineGlyphCount
  world.diagnostics.componentOrbitStepTimeMs = componentOrbitStepTimeMs
  world.diagnostics.componentOrbitSimulationTimeMs += componentOrbitStepTimeMs
  world.diagnostics.activeRhombusEncounterCount = activeRhombusEncounterCount
  world.diagnostics.activeRhombusGlyphCount = activeRhombusGlyphCount
  world.diagnostics.bodyMotionSimulationTimeMs += stepTimeMs
  world.diagnostics.bodyMotionEvaluationCount += animatedCreatureCount
  world.diagnostics.bodyMotionGlyphUpdateCount += animatedOutlineGlyphCount
}
