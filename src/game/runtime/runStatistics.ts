import { normalizeNonNegativeGameplayNumber } from '../core/gameplayNumber.ts'
import type {
  WeaponInstance,
  WeaponLoadoutState,
} from './weaponLoadout.ts'

export interface WeaponRunStatistics {
  readonly instanceId: number
  readonly definitionId: string
  readonly acquisitionOrder: number
  totalDamage: number
  equippedGameplayTimeMs: number
}

export interface RunStatisticsState {
  readonly weaponByInstanceId: Map<number, WeaponRunStatistics>
  killCount: number
  nextWeaponAcquisitionOrder: number
}

export function createRunStatisticsState(): RunStatisticsState {
  return {
    weaponByInstanceId: new Map(),
    killCount: 0,
    nextWeaponAcquisitionOrder: 1,
  }
}

function registerWeaponInstance(
  state: RunStatisticsState,
  weapon: Readonly<WeaponInstance>,
): WeaponRunStatistics {
  const existing = state.weaponByInstanceId.get(weapon.id)
  if (existing) {
    if (existing.definitionId !== weapon.definitionId) {
      throw new Error(`Weapon Instance ${weapon.id} changed definition.`)
    }
    return existing
  }

  const statistics: WeaponRunStatistics = {
    instanceId: weapon.id,
    definitionId: weapon.definitionId,
    acquisitionOrder: state.nextWeaponAcquisitionOrder,
    totalDamage: 0,
    equippedGameplayTimeMs: 0,
  }
  state.nextWeaponAcquisitionOrder += 1
  state.weaponByInstanceId.set(weapon.id, statistics)
  return statistics
}

export function synchronizeEquippedWeaponStatistics(
  state: RunStatisticsState,
  loadout: Readonly<WeaponLoadoutState>,
): void {
  for (const weapon of loadout.equipped) {
    registerWeaponInstance(state, weapon)
  }
}

export function advanceEquippedWeaponTime(
  state: RunStatisticsState,
  loadout: Readonly<WeaponLoadoutState>,
  deltaMs: number,
): void {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    throw new RangeError('Equipped gameplay delta must be finite and non-negative.')
  }
  synchronizeEquippedWeaponStatistics(state, loadout)
  for (const weapon of loadout.equipped) {
    const statistics = state.weaponByInstanceId.get(weapon.id)
    if (!statistics) {
      throw new Error(`Weapon Instance ${weapon.id} has no run statistics.`)
    }
    statistics.equippedGameplayTimeMs = normalizeNonNegativeGameplayNumber(
      statistics.equippedGameplayTimeMs + deltaMs,
    )
  }
}

export function recordWeaponDamage(
  state: RunStatisticsState,
  weaponInstanceId: number,
  appliedDamage: number,
): void {
  if (!Number.isFinite(appliedDamage) || appliedDamage < 0) {
    throw new RangeError('Applied weapon damage must be finite and non-negative.')
  }
  if (appliedDamage === 0) {
    return
  }
  const statistics = state.weaponByInstanceId.get(weaponInstanceId)
  if (!statistics) {
    throw new Error(
      `Weapon Instance ${weaponInstanceId} has no run statistics record.`,
    )
  }
  statistics.totalDamage = normalizeNonNegativeGameplayNumber(
    statistics.totalDamage + appliedDamage,
  )
}

export function recordFormalKill(state: RunStatisticsState): void {
  if (!Number.isSafeInteger(state.killCount) || state.killCount < 0) {
    throw new Error('Run kill count is invalid.')
  }
  state.killCount += 1
}
