import type { CreatureDefinition } from './creatures/creatureDefinition.ts'
import { prepareSlimeBossDefinition } from './bosses/slimeBoss.ts'
import { prepareOrdinaryBatDefinition } from './enemies/ordinaryBat.ts'
import { prepareOrdinaryBoneDefinition } from './enemies/ordinaryBone.ts'
import {
  defineOrdinaryEnemyProgression,
  type OrdinaryEnemyProgression,
} from './enemies/ordinaryEnemyProgression.ts'
import { prepareOrdinaryZombieDefinition } from './enemies/ordinaryZombie.ts'
import { prepareBasicProjectileWeaponDefinition } from './weapons/basicProjectileWeapon.ts'
import type { WeaponDefinition } from './weapons/weaponDefinition.ts'

const FIRST_PASS_MAXIMUM_EQUIPPED_WEAPONS = 3

export interface PreparedGameContent {
  readonly ordinaryEnemyDefinitions: readonly CreatureDefinition[]
  readonly ordinaryEnemyProgression: OrdinaryEnemyProgression
  readonly slimeBossDefinition: CreatureDefinition
  readonly creatureDefinitions: Readonly<Record<string, CreatureDefinition>>
  readonly weaponDefinitions: readonly WeaponDefinition[]
  readonly weaponDefinitionsById: Readonly<Record<string, WeaponDefinition>>
  readonly maximumEquippedWeapons: number
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

export function getWeaponDefinition(
  content: PreparedGameContent,
  definitionId: string,
): WeaponDefinition {
  const definition = content.weaponDefinitionsById[definitionId]
  if (!definition) {
    throw new Error(`Unknown weapon definition ${definitionId}.`)
  }
  return definition
}

export function prepareGameContent(): PreparedGameContent {
  const ordinaryEnemyDefinitions = Object.freeze([
    prepareOrdinaryZombieDefinition(),
    prepareOrdinaryBoneDefinition(),
    prepareOrdinaryBatDefinition(),
  ])
  const [zombieDefinition, boneDefinition, batDefinition] =
    ordinaryEnemyDefinitions
  const ordinaryEnemyProgression = defineOrdinaryEnemyProgression([
    {
      startSpawnCount: 0,
      entries: [{ definition: zombieDefinition, weight: 1 }],
    },
    {
      startSpawnCount: 8,
      entries: [{ definition: boneDefinition, weight: 1 }],
    },
    {
      startSpawnCount: 16,
      entries: [{ definition: batDefinition, weight: 1 }],
    },
  ])
  const slimeBossDefinition = prepareSlimeBossDefinition()
  const creatureDefinitions: Record<string, CreatureDefinition> = {
    [slimeBossDefinition.id]: slimeBossDefinition,
  }
  for (const definition of ordinaryEnemyDefinitions) {
    creatureDefinitions[definition.id] = definition
  }
  const weaponDefinitions = Object.freeze([
    prepareBasicProjectileWeaponDefinition(),
  ])
  const weaponDefinitionsById: Record<string, WeaponDefinition> = {}
  for (const definition of weaponDefinitions) {
    if (weaponDefinitionsById[definition.id]) {
      throw new Error(`Duplicate weapon definition ${definition.id}.`)
    }
    weaponDefinitionsById[definition.id] = definition
  }

  return Object.freeze({
    ordinaryEnemyDefinitions,
    ordinaryEnemyProgression,
    slimeBossDefinition,
    creatureDefinitions: Object.freeze(creatureDefinitions),
    weaponDefinitions,
    weaponDefinitionsById: Object.freeze(weaponDefinitionsById),
    maximumEquippedWeapons: FIRST_PASS_MAXIMUM_EQUIPPED_WEAPONS,
    maximumEnemyBroadPhaseRadius: Math.max(
      slimeBossDefinition.broadPhaseRadius,
      ...ordinaryEnemyDefinitions.map(
        (definition) => definition.broadPhaseRadius,
      ),
    ),
  })
}
