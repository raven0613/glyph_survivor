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
import { prepareFlamethrowerWeaponDefinition } from './weapons/flamethrowerWeapon.ts'
import { prepareOrbitEnergyBallWeaponDefinition } from './weapons/orbitEnergyBallWeapon.ts'
import type { WeaponDefinition } from './weapons/weaponDefinition.ts'
import {
  PROTOTYPE_LEVEL_PROGRESSION,
  type LevelProgressionDefinition,
} from './upgrades/levelProgression.ts'
import { preparePrototypeWeaponModules } from './upgrades/prototypeWeaponModules.ts'
import type { WeaponModuleDefinition } from './upgrades/moduleDefinition.ts'

const FIRST_PASS_MAXIMUM_EQUIPPED_WEAPONS = 3

export interface PreparedGameContent {
  readonly ordinaryEnemyDefinitions: readonly CreatureDefinition[]
  readonly ordinaryEnemyProgression: OrdinaryEnemyProgression
  readonly slimeBossDefinition: CreatureDefinition
  readonly creatureDefinitions: Readonly<Record<string, CreatureDefinition>>
  readonly weaponDefinitions: readonly WeaponDefinition[]
  readonly weaponDefinitionsById: Readonly<Record<string, WeaponDefinition>>
  readonly weaponModuleDefinitions: readonly WeaponModuleDefinition[]
  readonly weaponModuleDefinitionsById: Readonly<
    Record<string, WeaponModuleDefinition>
  >
  readonly levelProgression: Readonly<LevelProgressionDefinition>
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

export function getWeaponModuleDefinition(
  content: PreparedGameContent,
  definitionId: string,
): WeaponModuleDefinition {
  const definition = content.weaponModuleDefinitionsById[definitionId]
  if (!definition) {
    throw new Error(`Unknown weapon module definition ${definitionId}.`)
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
    prepareFlamethrowerWeaponDefinition(),
    prepareOrbitEnergyBallWeaponDefinition(),
  ])
  const weaponModuleDefinitions = preparePrototypeWeaponModules()
  const weaponModuleDefinitionsById: Record<string, WeaponModuleDefinition> = {}
  for (const definition of weaponModuleDefinitions) {
    if (weaponModuleDefinitionsById[definition.id]) {
      throw new Error(`Duplicate weapon module definition ${definition.id}.`)
    }
    weaponModuleDefinitionsById[definition.id] = definition
  }
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
    weaponModuleDefinitions,
    weaponModuleDefinitionsById: Object.freeze(weaponModuleDefinitionsById),
    levelProgression: PROTOTYPE_LEVEL_PROGRESSION,
    maximumEquippedWeapons: FIRST_PASS_MAXIMUM_EQUIPPED_WEAPONS,
    maximumEnemyBroadPhaseRadius: Math.max(
      slimeBossDefinition.broadPhaseRadius,
      ...ordinaryEnemyDefinitions.map(
        (definition) => definition.broadPhaseRadius,
      ),
    ),
  })
}
