import type { CreatureDefinition } from './creatures/creatureDefinition.ts'
import { prepareSlimeBossDefinition } from './bosses/slimeBoss.ts'
import { prepareOrdinaryBatDefinition } from './enemies/ordinaryBat.ts'

export interface PreparedGameContent {
  readonly ordinaryEnemyDefinition: CreatureDefinition
  readonly slimeBossDefinition: CreatureDefinition
  readonly creatureDefinitions: Readonly<Record<string, CreatureDefinition>>
  readonly maximumEnemyBroadPhaseRadius: number
}

export function getCreatureDefinition(
  content: PreparedGameContent,
  definitionId: string,
): CreatureDefinition {
  const definition = content.creatureDefinitions[definitionId]
  if (!definition) {
    throw new Error(`Unknown creature definition ${definitionId}.`)
  }
  return definition
}

export function prepareGameContent(): PreparedGameContent {
  const ordinaryEnemyDefinition = prepareOrdinaryBatDefinition()
  const slimeBossDefinition = prepareSlimeBossDefinition()
  const creatureDefinitions = Object.freeze({
    [ordinaryEnemyDefinition.id]: ordinaryEnemyDefinition,
    [slimeBossDefinition.id]: slimeBossDefinition,
  })

  return Object.freeze({
    ordinaryEnemyDefinition,
    slimeBossDefinition,
    creatureDefinitions,
    maximumEnemyBroadPhaseRadius: Math.max(
      ordinaryEnemyDefinition.broadPhaseRadius,
      slimeBossDefinition.broadPhaseRadius,
    ),
  })
}
