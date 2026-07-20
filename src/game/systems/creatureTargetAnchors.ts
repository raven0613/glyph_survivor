import type { CreatureDefinition } from '../content/creatures/creatureDefinition.ts'
import { getComponentMotionOffset } from '../runtime/componentOrbitState.ts'
import type {
  CreatureTargetAnchorPosition,
  EnemyState,
} from '../runtime/worldEntities.ts'

export function writeCreatureTargetAnchor(
  enemy: EnemyState,
  definition: CreatureDefinition,
  anchorId: string,
  output: CreatureTargetAnchorPosition,
): boolean {
  const anchor = definition.targetAnchors.find(({ id }) => id === anchorId)
  if (!anchor) {
    return false
  }
  const motionOffset = getComponentMotionOffset(enemy, anchor.motionGroupId)
  if (!motionOffset) {
    return false
  }
  output.id = anchor.id
  output.x = enemy.x + anchor.localX + motionOffset.x
  output.y = enemy.y + anchor.localY + motionOffset.y
  return true
}

export function resolveCreatureTargetAnchor(
  enemy: EnemyState,
  definition: CreatureDefinition,
  anchorId: string,
): CreatureTargetAnchorPosition | null {
  const output: CreatureTargetAnchorPosition = { id: null, x: 0, y: 0 }
  return writeCreatureTargetAnchor(enemy, definition, anchorId, output)
    ? output
    : null
}

export function resolveCreatureTargetAnchors(
  enemy: EnemyState,
  definition: CreatureDefinition,
  output: CreatureTargetAnchorPosition[] = [],
): readonly CreatureTargetAnchorPosition[] {
  let outputCount = 0
  if (definition.targetAnchors.length === 0) {
    const root = output[0] ?? { id: null, x: 0, y: 0 }
    root.id = null
    root.x = enemy.x
    root.y = enemy.y
    output[0] = root
    output.length = 1
    return output
  }
  for (const anchor of definition.targetAnchors) {
    const position = output[outputCount] ?? { id: null, x: 0, y: 0 }
    if (writeCreatureTargetAnchor(enemy, definition, anchor.id, position)) {
      output[outputCount] = position
      outputCount += 1
    }
  }
  output.length = outputCount
  return output
}
