import {
  getWeaponDefinition,
  getWeaponModuleDefinition,
} from '../content/gameContent.ts'
import { normalizeNonNegativeGameplayNumber } from '../core/gameplayNumber.ts'
import { synchronizeEquippedWeaponStatistics } from './runStatistics.ts'
import type { WorldState } from './worldState.ts'

export interface RunResultModuleSlot {
  readonly slotIndex: number
  readonly moduleDefinitionId: string
  readonly title: string
  readonly rank: number
}

export interface RunResultWeapon {
  readonly instanceId: number
  readonly definitionId: string
  readonly title: string
  readonly identityGlyph: string
  readonly moduleSlots: readonly (Readonly<RunResultModuleSlot> | null)[]
  readonly totalDamage: number
  readonly equippedGameplayTimeMs: number
  readonly averageEquippedDps: number | null
  readonly isHighestDamage: boolean
}

export interface RunResult {
  readonly gameplayTimeMs: number
  readonly killCount: number
  readonly finalPlayerLevel: number
  readonly weapons: readonly Readonly<RunResultWeapon>[]
}

function findHighestDamageWeaponInstanceId(world: WorldState): number | null {
  let winnerInstanceId: number | null = null
  let winnerDamage = 0
  let winnerAcquisitionOrder = Number.POSITIVE_INFINITY

  for (const weapon of world.weaponLoadout.equipped) {
    const statistics = world.runStatistics.weaponByInstanceId.get(weapon.id)
    if (!statistics || statistics.totalDamage <= 0) {
      continue
    }
    const winsDamage = statistics.totalDamage > winnerDamage
    const winsAcquisitionTie =
      statistics.totalDamage === winnerDamage &&
      statistics.acquisitionOrder < winnerAcquisitionOrder
    const winsStableIdTie =
      statistics.totalDamage === winnerDamage &&
      statistics.acquisitionOrder === winnerAcquisitionOrder &&
      weapon.id < (winnerInstanceId ?? Number.POSITIVE_INFINITY)
    if (winsDamage || winsAcquisitionTie || winsStableIdTie) {
      winnerInstanceId = weapon.id
      winnerDamage = statistics.totalDamage
      winnerAcquisitionOrder = statistics.acquisitionOrder
    }
  }
  return winnerInstanceId
}

/** Freezes the death-time loadout and derived statistics exactly once. */
export function finalizeRunResult(world: WorldState): Readonly<RunResult> {
  if (world.runResult) {
    return world.runResult
  }

  synchronizeEquippedWeaponStatistics(
    world.runStatistics,
    world.weaponLoadout,
  )
  const highestDamageWeaponInstanceId =
    findHighestDamageWeaponInstanceId(world)
  const weapons = Object.freeze(
    world.weaponLoadout.equipped.map((weapon) => {
      const definition = getWeaponDefinition(world.content, weapon.definitionId)
      const statistics = world.runStatistics.weaponByInstanceId.get(weapon.id)
      if (!statistics) {
        throw new Error(`Weapon Instance ${weapon.id} has no run statistics.`)
      }
      const moduleSlots = Object.freeze(
        weapon.moduleSlots.map((slot, slotIndex) => {
          if (!slot) {
            return null
          }
          const moduleDefinition = getWeaponModuleDefinition(
            world.content,
            slot.moduleDefinitionId,
          )
          return Object.freeze({
            slotIndex,
            moduleDefinitionId: moduleDefinition.id,
            title: moduleDefinition.title,
            rank: slot.rank,
          })
        }),
      )
      const averageEquippedDps =
        statistics.equippedGameplayTimeMs > 0
          ? normalizeNonNegativeGameplayNumber(
              statistics.totalDamage /
                (statistics.equippedGameplayTimeMs / 1_000),
            )
          : null
      return Object.freeze({
        instanceId: weapon.id,
        definitionId: weapon.definitionId,
        title: definition.title,
        identityGlyph: definition.identityGlyph,
        moduleSlots,
        totalDamage: statistics.totalDamage,
        equippedGameplayTimeMs: statistics.equippedGameplayTimeMs,
        averageEquippedDps,
        isHighestDamage: weapon.id === highestDamageWeaponInstanceId,
      })
    }),
  )
  world.runResult = Object.freeze({
    gameplayTimeMs: world.runTimeMs,
    killCount: world.runStatistics.killCount,
    finalPlayerLevel: world.player.level,
    weapons,
  })
  return world.runResult
}
