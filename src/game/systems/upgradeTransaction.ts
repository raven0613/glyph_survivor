import type { PreparedGameContent } from '../content/gameContent.ts'
import type {
  UpgradeOffer,
  UpgradeState,
} from '../runtime/upgradeState.ts'
import type { WeaponLoadoutState } from '../runtime/weaponLoadout.ts'
import {
  generateUpgradeOffer,
  getUpgradeOfferGenerationError,
} from './upgradeOffer.ts'

export function getQueuedUpgradeOfferError(
  content: PreparedGameContent,
  provisionalLoadout: WeaponLoadoutState,
  state: UpgradeState,
): string | null {
  if (state.pendingUpgradeCount - 1 <= 0) {
    return null
  }

  const error = getUpgradeOfferGenerationError(
    content,
    provisionalLoadout,
    state,
  )
  return error ? `Cannot create the next upgrade offer: ${error}` : null
}

/** Consumes one committed offer and creates the next queued offer, if any. */
export function completeUpgradeTransaction(
  content: PreparedGameContent,
  loadout: WeaponLoadoutState,
  state: UpgradeState,
): Readonly<UpgradeOffer> | null {
  state.activeOffer = null
  state.pendingUpgradeCount -= 1
  const nextOffer =
    state.pendingUpgradeCount > 0
      ? generateUpgradeOffer(content, loadout, state)
      : null
  state.activeOffer = nextOffer
  return nextOffer
}
