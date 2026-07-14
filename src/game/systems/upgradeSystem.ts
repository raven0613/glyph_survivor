import {
  getXpToNextLevel,
  type LevelProgressionDefinition,
} from '../content/upgrades/levelProgression.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { generateUpgradeOffer } from './upgradeOffer.ts'

export interface MutableLevelProgress {
  level: number
  xpIntoLevel: number
}

export function applyExperienceProgress(
  progress: MutableLevelProgress,
  amount: number,
  definition: Readonly<LevelProgressionDefinition>,
): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError('XP amount must be finite and non-negative.')
  }
  progress.xpIntoLevel += amount
  let levelsGained = 0
  while (progress.xpIntoLevel >= getXpToNextLevel(definition, progress.level)) {
    progress.xpIntoLevel -= getXpToNextLevel(definition, progress.level)
    progress.level += 1
    levelsGained += 1
  }
  return levelsGained
}

/** Settles XP and creates at most one active offer for the host to pause on. */
export function runUpgradeSystem(world: WorldState): boolean {
  const levelsGained = applyExperienceProgress(
    world.player,
    world.collectedXpThisStep,
    world.content.levelProgression,
  )
  world.collectedXpThisStep = 0
  world.upgradeState.pendingUpgradeCount += levelsGained
  if (
    world.upgradeState.pendingUpgradeCount > 0 &&
    world.upgradeState.activeOffer === null
  ) {
    world.upgradeState.activeOffer = generateUpgradeOffer(
      world.content,
      world.weaponLoadout,
      world.upgradeState,
    )
    return true
  }
  return false
}
