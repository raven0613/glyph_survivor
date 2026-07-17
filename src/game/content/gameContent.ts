import type { CreatureDefinition } from './creatures/creatureDefinition.ts'
import { prepareSlimeBossDefinition } from './bosses/slimeBoss.ts'
import { prepareOrdinaryBatDefinition } from './enemies/ordinaryBat.ts'
import { prepareOrdinaryBoneDefinition } from './enemies/ordinaryBone.ts'
import {
  defineOrdinaryEnemyProgression,
  type OrdinaryEnemyProgression,
} from './enemies/ordinaryEnemyProgression.ts'
import { prepareOrdinaryZombieDefinition } from './enemies/ordinaryZombie.ts'
import { prepareOrdinaryRockDefinition } from './enemies/ordinaryRock.ts'
import { prepareOrdinarySnakeDefinition } from './enemies/ordinarySnake.ts'
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
import type { CombatVisualTheme } from './visuals/combatVisualTheme.ts'
import { PROTOTYPE_COMBAT_VISUAL_THEME } from './visuals/prototypeCombatVisualTheme.ts'
import type { RunModifierDefinition } from './modifiers/runModifierDefinition.ts'
import { preparePrototypeRunModifiers } from './modifiers/prototypeRunModifiers.ts'

const FIRST_PASS_MAXIMUM_EQUIPPED_WEAPONS = 3
const ORDINARY_ENEMY_DEBUT_TIMES_MS = Object.freeze({
  ZOMBIE: 0,
  BONE: 6_000,
  BAT: 12_000,
  ROCK: 20_000,
  SNAKE: 28_000,
})
const ORDINARY_ENEMY_POST_DEBUT_WEIGHTS = Object.freeze({
  ZOMBIE: 5,
  BONE: 4,
  BAT: 3,
  ROCK: 2,
  SNAKE: 2,
})

export interface PreparedGameContent {
  readonly combatVisualTheme: CombatVisualTheme
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
  readonly runModifierDefinitions: readonly Readonly<RunModifierDefinition>[]
  readonly runModifierDefinitionsById: Readonly<
    Record<string, Readonly<RunModifierDefinition>>
  >
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
    prepareOrdinaryRockDefinition(),
    prepareOrdinarySnakeDefinition(),
  ])
  const [
    zombieDefinition,
    boneDefinition,
    batDefinition,
    rockDefinition,
    snakeDefinition,
  ] = ordinaryEnemyDefinitions
  const ordinaryEnemyProgression = defineOrdinaryEnemyProgression([
    {
      definition: zombieDefinition,
      earliestAppearanceTimeMs: ORDINARY_ENEMY_DEBUT_TIMES_MS.ZOMBIE,
      postDebutWeight: ORDINARY_ENEMY_POST_DEBUT_WEIGHTS.ZOMBIE,
    },
    {
      definition: boneDefinition,
      earliestAppearanceTimeMs: ORDINARY_ENEMY_DEBUT_TIMES_MS.BONE,
      postDebutWeight: ORDINARY_ENEMY_POST_DEBUT_WEIGHTS.BONE,
    },
    {
      definition: batDefinition,
      earliestAppearanceTimeMs: ORDINARY_ENEMY_DEBUT_TIMES_MS.BAT,
      postDebutWeight: ORDINARY_ENEMY_POST_DEBUT_WEIGHTS.BAT,
    },
    {
      definition: rockDefinition,
      earliestAppearanceTimeMs: ORDINARY_ENEMY_DEBUT_TIMES_MS.ROCK,
      postDebutWeight: ORDINARY_ENEMY_POST_DEBUT_WEIGHTS.ROCK,
    },
    {
      definition: snakeDefinition,
      earliestAppearanceTimeMs: ORDINARY_ENEMY_DEBUT_TIMES_MS.SNAKE,
      postDebutWeight: ORDINARY_ENEMY_POST_DEBUT_WEIGHTS.SNAKE,
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
  const runModifierDefinitions = preparePrototypeRunModifiers()
  const runModifierDefinitionsById: Record<
    string,
    Readonly<RunModifierDefinition>
  > = {}
  for (const definition of runModifierDefinitions) {
    if (runModifierDefinitionsById[definition.id]) {
      throw new Error(`Duplicate Run Modifier definition ${definition.id}.`)
    }
    runModifierDefinitionsById[definition.id] = definition
  }

  return Object.freeze({
    combatVisualTheme: PROTOTYPE_COMBAT_VISUAL_THEME,
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
    runModifierDefinitions,
    runModifierDefinitionsById: Object.freeze(runModifierDefinitionsById),
  })
}
