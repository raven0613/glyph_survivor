import type { WeaponDefinition } from '../content/weapons/weaponDefinition.ts'
import {
  resolveWeaponProfile,
  type ResolvedWeaponProfile,
} from '../systems/resolveWeaponProfile.ts'

export interface InstalledWeaponModule {
  readonly moduleDefinitionId: string
  readonly rank: number
}

export type WeaponModuleSlot = Readonly<InstalledWeaponModule> | null

export interface WeaponInstance {
  readonly id: number
  readonly definitionId: string
  readonly equipmentSlot: number
  cooldownRemainingMs: number
  attackSequence: number
  moduleSlots: WeaponModuleSlot[]
  profileRevision: number
  resolvedProfile: ResolvedWeaponProfile
}

export interface WeaponLoadoutState {
  readonly maximumEquippedWeapons: number
  readonly equipped: WeaponInstance[]
  nextWeaponInstanceId: number
}

export function createWeaponLoadout(
  maximumEquippedWeapons: number,
): WeaponLoadoutState {
  if (
    !Number.isSafeInteger(maximumEquippedWeapons) ||
    maximumEquippedWeapons <= 0
  ) {
    throw new RangeError(
      'maximumEquippedWeapons must be a positive safe integer.',
    )
  }

  return {
    maximumEquippedWeapons,
    equipped: [],
    nextWeaponInstanceId: 1,
  }
}

function findFirstOpenEquipmentSlot(loadout: WeaponLoadoutState): number {
  for (
    let equipmentSlot = 0;
    equipmentSlot < loadout.maximumEquippedWeapons;
    equipmentSlot += 1
  ) {
    if (
      !loadout.equipped.some(
        (weapon) => weapon.equipmentSlot === equipmentSlot,
      )
    ) {
      return equipmentSlot
    }
  }

  return -1
}

function createWeaponInstance(
  loadout: WeaponLoadoutState,
  definition: WeaponDefinition,
  equipmentSlot: number,
): WeaponInstance {
  const weapon: WeaponInstance = {
    id: loadout.nextWeaponInstanceId,
    definitionId: definition.id,
    equipmentSlot,
    cooldownRemainingMs: 0,
    attackSequence: 0,
    moduleSlots: Array.from(
      { length: definition.moduleSlotCount },
      () => null,
    ),
    profileRevision: 0,
    resolvedProfile: resolveWeaponProfile(definition),
  }
  loadout.nextWeaponInstanceId += 1
  return weapon
}

function requireDefinitionIsNotEquipped(
  loadout: WeaponLoadoutState,
  definition: WeaponDefinition,
): void {
  if (
    loadout.equipped.some(
      (weapon) => weapon.definitionId === definition.id,
    )
  ) {
    throw new Error(`Weapon definition ${definition.id} is already equipped.`)
  }
}

/** Adds one validated definition below the loadout cap in stable slot order. */
export function equipWeapon(
  loadout: WeaponLoadoutState,
  definition: WeaponDefinition,
): WeaponInstance {
  requireDefinitionIsNotEquipped(loadout, definition)

  const equipmentSlot = findFirstOpenEquipmentSlot(loadout)
  if (equipmentSlot < 0) {
    throw new Error('Weapon loadout is full.')
  }

  const weapon = createWeaponInstance(loadout, definition, equipmentSlot)
  loadout.equipped.push(weapon)
  loadout.equipped.sort(
    (first, second) => first.equipmentSlot - second.equipmentSlot,
  )
  return weapon
}

/** Replaces one equipped instance while retaining its stable equipment slot. */
export function replaceWeapon(
  loadout: WeaponLoadoutState,
  definition: WeaponDefinition,
  replacedWeaponInstanceId: number,
): WeaponInstance {
  requireDefinitionIsNotEquipped(loadout, definition)
  const replacedIndex = loadout.equipped.findIndex(
    ({ id }) => id === replacedWeaponInstanceId,
  )
  if (replacedIndex < 0) {
    throw new Error('The replacement weapon is no longer equipped.')
  }

  const equipmentSlot = loadout.equipped[replacedIndex].equipmentSlot
  const weapon = createWeaponInstance(loadout, definition, equipmentSlot)
  loadout.equipped[replacedIndex] = weapon
  loadout.equipped.sort(
    (first, second) => first.equipmentSlot - second.equipmentSlot,
  )
  return weapon
}
