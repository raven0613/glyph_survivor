import { createSeededRng, type SeededRng } from '../core/seededRng.ts'
import type {
  DisconnectedModifierParameters,
  OverloadModifierParameters,
  VolatileModifierParameters,
} from '../content/modifiers/runModifierDefinition.ts'

export const RUN_MODIFIER_OFFER_ORIGIN = Object.freeze({
  RUN_START_TEST: 'RUN_START_TEST',
  BOSS_REWARD: 'BOSS_REWARD',
})

export type RunModifierOfferOrigin =
  (typeof RUN_MODIFIER_OFFER_ORIGIN)[keyof typeof RUN_MODIFIER_OFFER_ORIGIN]

export interface RunModifierChoiceReference {
  readonly id: string
  readonly definitionId: string
  readonly title: string
  readonly description: string
  readonly identityGlyph: string
}

export interface RunModifierAuthorization {
  readonly id: string
  readonly origin: RunModifierOfferOrigin
  readonly bossEncounterId: number | null
}

export interface BossModifierRewardToken {
  readonly id: string
  readonly bossEncounterId: number
}

export interface RunModifierOffer {
  readonly id: string
  readonly authorizationId: string
  readonly origin: RunModifierOfferOrigin
  readonly choices: readonly Readonly<RunModifierChoiceReference>[]
}

export interface RunModifierState {
  readonly runStartTestOfferRng: SeededRng
  readonly bossRewardOfferRng: SeededRng
  readonly ownedDefinitionIds: Set<string>
  readonly pendingBossRewardTokens: BossModifierRewardToken[]
  readonly bossRewardTokenEncounterIds: Set<number>
  resolvedProfile: Readonly<ResolvedRunModifierProfile>
  nextAuthorizationId: number
  nextOfferId: number
  nextBossRewardTokenId: number
  runStartTestAuthorizationCreated: boolean
  activeAuthorization: Readonly<RunModifierAuthorization> | null
  activeOffer: Readonly<RunModifierOffer> | null
}

export interface ResolvedRunModifierProfile {
  readonly volatile: Readonly<VolatileModifierParameters> | null
  readonly disconnected: Readonly<DisconnectedModifierParameters> | null
  readonly overload: Readonly<OverloadModifierParameters> | null
}

const EMPTY_RESOLVED_RUN_MODIFIER_PROFILE: Readonly<ResolvedRunModifierProfile> =
  Object.freeze({ volatile: null, disconnected: null, overload: null })

export function createRunModifierState(
  runSeed: string | number,
): RunModifierState {
  return {
    runStartTestOfferRng: createSeededRng(
      `${runSeed}:modifier-offer:run-start-test`,
    ),
    bossRewardOfferRng: createSeededRng(
      `${runSeed}:modifier-offer:boss-reward`,
    ),
    ownedDefinitionIds: new Set(),
    pendingBossRewardTokens: [],
    bossRewardTokenEncounterIds: new Set(),
    resolvedProfile: EMPTY_RESOLVED_RUN_MODIFIER_PROFILE,
    nextAuthorizationId: 1,
    nextOfferId: 1,
    nextBossRewardTokenId: 1,
    runStartTestAuthorizationCreated: false,
    activeAuthorization: null,
    activeOffer: null,
  }
}
