import { createSeededRng, type SeededRng } from '../core/seededRng.ts'

export type UpgradeChoiceKind = 'WEAPON' | 'MODULE'

export interface UpgradeChoiceReference {
  readonly id: string
  readonly kind: UpgradeChoiceKind
  readonly definitionId: string
  readonly title: string
  readonly description: string
}

export interface UpgradeOffer {
  readonly id: string
  readonly sequence: number
  readonly choices: readonly Readonly<UpgradeChoiceReference>[]
}

export interface UpgradeState {
  readonly rng: SeededRng
  readonly unlockedWeaponDefinitionIds: readonly string[]
  pendingUpgradeCount: number
  offerSequence: number
  nextOfferId: number
  activeOffer: Readonly<UpgradeOffer> | null
}

export function createUpgradeState(
  runSeed: string | number,
  unlockedWeaponDefinitionIds: readonly string[],
): UpgradeState {
  const copiedIds = [...unlockedWeaponDefinitionIds]
  if (
    copiedIds.length === 0 ||
    copiedIds.some((id) => !id.trim()) ||
    new Set(copiedIds).size !== copiedIds.length
  ) {
    throw new Error('Run weapon unlocks must contain unique, non-empty IDs.')
  }
  return {
    rng: createSeededRng(`${runSeed}:upgrade`),
    unlockedWeaponDefinitionIds: Object.freeze(copiedIds),
    pendingUpgradeCount: 0,
    offerSequence: 0,
    nextOfferId: 1,
    activeOffer: null,
  }
}
