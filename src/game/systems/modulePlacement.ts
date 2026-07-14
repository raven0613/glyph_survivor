import type { WeaponModuleDefinition } from '../content/upgrades/moduleDefinition.ts'
import type { WeaponInstance } from '../runtime/weaponLoadout.ts'

export type ModulePlacement =
  | { readonly kind: 'RANK_UP'; readonly slotIndex: number; readonly rank: number }
  | { readonly kind: 'INSTALL'; readonly slotIndex: number; readonly rank: 1 }
  | { readonly kind: 'REPLACE'; readonly slotIndex: number; readonly rank: 1 }
  | { readonly kind: 'REJECTED'; readonly error: string }

export function planModulePlacement(
  weapon: WeaponInstance,
  moduleDefinition: WeaponModuleDefinition,
  replacedSlotIndex?: number,
): ModulePlacement {
  const matchingSlotIndex = weapon.moduleSlots.findIndex(
    (slot) => slot?.moduleDefinitionId === moduleDefinition.id,
  )
  if (matchingSlotIndex >= 0) {
    const matchingSlot = weapon.moduleSlots[matchingSlotIndex]
    if (!matchingSlot) {
      throw new Error('Matching module slot unexpectedly disappeared.')
    }
    if (matchingSlot.rank >= moduleDefinition.ranks.length) {
      return {
        kind: 'REJECTED',
        error: `${moduleDefinition.title} is already at maximum Rank.`,
      }
    }
    return {
      kind: 'RANK_UP',
      slotIndex: matchingSlotIndex,
      rank: matchingSlot.rank + 1,
    }
  }

  const emptySlotIndex = weapon.moduleSlots.indexOf(null)
  if (emptySlotIndex >= 0) {
    return { kind: 'INSTALL', slotIndex: emptySlotIndex, rank: 1 }
  }
  if (replacedSlotIndex === undefined) {
    return {
      kind: 'REJECTED',
      error: 'A replacement slot is required because this weapon is full.',
    }
  }
  if (
    !Number.isSafeInteger(replacedSlotIndex) ||
    replacedSlotIndex < 0 ||
    replacedSlotIndex >= weapon.moduleSlots.length
  ) {
    return { kind: 'REJECTED', error: 'The replacement slot is invalid.' }
  }
  return { kind: 'REPLACE', slotIndex: replacedSlotIndex, rank: 1 }
}

export function canWeaponAcceptModule(
  weapon: WeaponInstance,
  moduleDefinition: WeaponModuleDefinition,
): boolean {
  const placement = planModulePlacement(weapon, moduleDefinition)
  return (
    placement.kind !== 'REJECTED' ||
    placement.error.startsWith('A replacement slot is required')
  )
}
