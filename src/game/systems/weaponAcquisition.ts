import { getWeaponDefinition } from '../content/gameContent.ts'
import type { WeaponDefinition } from '../content/weapons/weaponDefinition.ts'
import type { UpgradeOffer } from '../runtime/upgradeState.ts'
import {
  equipWeapon,
  replaceWeapon,
  type WeaponLoadoutState,
} from '../runtime/weaponLoadout.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { synchronizeEquippedWeaponStatistics } from '../runtime/runStatistics.ts'
import {
  completeUpgradeTransaction,
  getQueuedUpgradeOfferError,
} from './upgradeTransaction.ts'
import { removeOrbitAttacksForWeapon } from './orbitWeaponSystem.ts'

export interface AcquireWeaponCommand {
  readonly offerId: string
  readonly choiceId: string
  readonly replacedWeaponInstanceId?: number
}

export type AcquireWeaponResult =
  | {
      readonly ok: true
      readonly choiceId: string
      readonly nextOffer: Readonly<UpgradeOffer> | null
    }
  | { readonly ok: false; readonly error: string }

function copyLoadout(loadout: WeaponLoadoutState): WeaponLoadoutState {
  return {
    maximumEquippedWeapons: loadout.maximumEquippedWeapons,
    equipped: [...loadout.equipped],
    nextWeaponInstanceId: loadout.nextWeaponInstanceId,
  }
}

function commitLoadout(
  target: WeaponLoadoutState,
  source: WeaponLoadoutState,
): void {
  target.equipped.splice(0, target.equipped.length, ...source.equipped)
  target.nextWeaponInstanceId = source.nextWeaponInstanceId
}

/** Revalidates and atomically commits one Weapon choice from an active offer. */
export function acquireWeaponFromOffer(
  world: WorldState,
  command: Readonly<AcquireWeaponCommand>,
): AcquireWeaponResult {
  const activeOffer = world.upgradeState.activeOffer
  if (!activeOffer || activeOffer.id !== command.offerId) {
    return { ok: false, error: 'The upgrade offer is stale or no longer active.' }
  }
  const choice = activeOffer.choices.find(({ id }) => id === command.choiceId)
  if (!choice || choice.kind !== 'WEAPON') {
    return { ok: false, error: 'The selected choice is not an active Weapon.' }
  }
  if (world.upgradeState.pendingUpgradeCount <= 0) {
    return { ok: false, error: 'No pending upgrade can consume this offer.' }
  }
  if (
    !world.upgradeState.unlockedWeaponDefinitionIds.includes(
      choice.definitionId,
    )
  ) {
    return { ok: false, error: 'The selected weapon is not unlocked for this run.' }
  }

  let definition: WeaponDefinition
  try {
    definition = getWeaponDefinition(world.content, choice.definitionId)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown Weapon.',
    }
  }
  if (
    world.weaponLoadout.equipped.some(
      ({ definitionId }) => definitionId === definition.id,
    )
  ) {
    return {
      ok: false,
      error: `Weapon definition ${definition.id} is already equipped.`,
    }
  }

  const isFull =
    world.weaponLoadout.equipped.length >=
    world.weaponLoadout.maximumEquippedWeapons
  if (isFull && command.replacedWeaponInstanceId === undefined) {
    return {
      ok: false,
      error: 'A replacement weapon is required when the loadout is full.',
    }
  }
  if (!isFull && command.replacedWeaponInstanceId !== undefined) {
    return {
      ok: false,
      error: 'A replacement weapon is only valid when the loadout is full.',
    }
  }

  const provisionalLoadout = copyLoadout(world.weaponLoadout)
  try {
    if (command.replacedWeaponInstanceId === undefined) {
      equipWeapon(provisionalLoadout, definition)
    } else {
      replaceWeapon(
        provisionalLoadout,
        definition,
        command.replacedWeaponInstanceId,
      )
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Weapon acquisition failed.',
    }
  }

  const nextOfferError = getQueuedUpgradeOfferError(
    world.content,
    provisionalLoadout,
    world.upgradeState,
  )
  if (nextOfferError) {
    return { ok: false, error: nextOfferError }
  }

  commitLoadout(world.weaponLoadout, provisionalLoadout)
  synchronizeEquippedWeaponStatistics(
    world.runStatistics,
    world.weaponLoadout,
  )
  if (command.replacedWeaponInstanceId !== undefined) {
    removeOrbitAttacksForWeapon(world, command.replacedWeaponInstanceId)
  }
  const nextOffer = completeUpgradeTransaction(
    world.content,
    world.weaponLoadout,
    world.upgradeState,
  )
  return { ok: true, choiceId: choice.id, nextOffer }
}
