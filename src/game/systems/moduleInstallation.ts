import {
  getWeaponDefinition,
  getWeaponModuleDefinition,
} from '../content/gameContent.ts'
import type { WeaponModuleDefinition } from '../content/upgrades/moduleDefinition.ts'
import type { UpgradeOffer } from '../runtime/upgradeState.ts'
import type {
  WeaponInstance,
  WeaponLoadoutState,
  WeaponModuleSlot,
} from '../runtime/weaponLoadout.ts'
import type { WorldState } from '../runtime/worldState.ts'
import {
  resolveWeaponProfile,
  type ResolvedWeaponProfile,
} from './resolveWeaponProfile.ts'
import {
  planModulePlacement,
  type ModulePlacement,
} from './modulePlacement.ts'
import {
  completeUpgradeTransaction,
  getQueuedUpgradeOfferError,
} from './upgradeTransaction.ts'

export interface InstallModuleCommand {
  readonly offerId: string
  readonly choiceId: string
  readonly weaponInstanceId: number
  readonly replacedSlotIndex?: number
}

export type InstallModuleResult =
  | {
      readonly ok: true
      readonly choiceId: string
      readonly nextOffer: Readonly<UpgradeOffer> | null
    }
  | { readonly ok: false; readonly error: string }

function copySlotsWithPlacement(
  weapon: WeaponInstance,
  moduleDefinitionId: string,
  placement: Exclude<ModulePlacement, { readonly kind: 'REJECTED' }>,
): WeaponModuleSlot[] {
  const nextSlots = weapon.moduleSlots.slice()
  nextSlots[placement.slotIndex] = Object.freeze({
    moduleDefinitionId,
    rank: placement.rank,
  })
  return nextSlots
}

/** Revalidates and commits one Module choice without partial mutation. */
export function installModuleFromOffer(
  world: WorldState,
  command: Readonly<InstallModuleCommand>,
): InstallModuleResult {
  const activeOffer = world.upgradeState.activeOffer
  if (!activeOffer || activeOffer.id !== command.offerId) {
    return { ok: false, error: 'The upgrade offer is stale or no longer active.' }
  }
  const choice = activeOffer.choices.find(
    ({ id }) => id === command.choiceId,
  )
  if (!choice || choice.kind !== 'MODULE') {
    return { ok: false, error: 'The selected choice is not an active Module.' }
  }
  const weapon = world.weaponLoadout.equipped.find(
    ({ id }) => id === command.weaponInstanceId,
  )
  if (!weapon) {
    return { ok: false, error: 'The target weapon is no longer equipped.' }
  }
  if (world.upgradeState.pendingUpgradeCount <= 0) {
    return { ok: false, error: 'No pending upgrade can consume this offer.' }
  }

  let moduleDefinition: WeaponModuleDefinition
  try {
    moduleDefinition = getWeaponModuleDefinition(
      world.content,
      choice.definitionId,
    )
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown Module.',
    }
  }
  const placement = planModulePlacement(
    weapon,
    moduleDefinition,
    command.replacedSlotIndex,
  )
  if (placement.kind === 'REJECTED') {
    return { ok: false, error: placement.error }
  }

  const nextSlots = copySlotsWithPlacement(
    weapon,
    moduleDefinition.id,
    placement,
  )
  let nextProfile: ResolvedWeaponProfile
  try {
    nextProfile = resolveWeaponProfile(
      getWeaponDefinition(world.content, weapon.definitionId),
      nextSlots,
      world.content.weaponModuleDefinitionsById,
    )
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Module compile failed.',
    }
  }

  const provisionalWeapon: WeaponInstance = {
    ...weapon,
    moduleSlots: nextSlots,
    resolvedProfile: nextProfile,
  }
  const provisionalLoadout: WeaponLoadoutState = {
    ...world.weaponLoadout,
    equipped: world.weaponLoadout.equipped.map((equippedWeapon) =>
      equippedWeapon.id === weapon.id ? provisionalWeapon : equippedWeapon,
    ),
  }
  const nextOfferError = getQueuedUpgradeOfferError(
    world.content,
    provisionalLoadout,
    world.upgradeState,
  )
  if (nextOfferError) {
    return { ok: false, error: nextOfferError }
  }

  weapon.moduleSlots = nextSlots
  weapon.resolvedProfile = nextProfile
  weapon.profileRevision += 1
  const nextOffer = completeUpgradeTransaction(
    world.content,
    world.weaponLoadout,
    world.upgradeState,
  )
  return { ok: true, choiceId: choice.id, nextOffer }
}
