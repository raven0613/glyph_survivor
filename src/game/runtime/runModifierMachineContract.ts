import {
  RUN_MODIFIER_OFFER_ORIGIN,
  type RunModifierChoiceReference,
  type RunModifierOfferOrigin,
} from './runModifierState.ts'
import type { UpgradeChoice } from './upgradeMachineContract.ts'

export const INVALID_MODIFIER_OFFER_ERROR =
  'Invalid Modifier offer: expected two or three unique choices.'
export const INVALID_MODIFIER_SELECTION_ERROR =
  'Invalid Modifier selection: the choice is not part of the active offer.'

export interface ModifierOfferPayload {
  readonly offerId: string
  readonly origin: RunModifierOfferOrigin
  readonly choices: readonly RunModifierChoiceReference[]
}

export type StartRunWithModifierOfferEvent = ModifierOfferPayload & {
  readonly type: 'START_RUN_WITH_MODIFIER_OFFER'
  readonly seed: string | number
}

export type ModifierOfferedEvent = ModifierOfferPayload & {
  readonly type: 'MODIFIER_OFFERED'
}

export interface ModifierCommittedEvent {
  readonly type: 'MODIFIER_COMMITTED'
  readonly choiceId: string
  readonly nextUpgradeOffer?: {
    readonly offerId: string
    readonly choices: readonly UpgradeChoice[]
    readonly pendingUpgradeCount: number
  }
}

function isChoice(value: unknown): value is RunModifierChoiceReference {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    'definitionId' in value &&
    typeof value.definitionId === 'string' &&
    value.definitionId.trim().length > 0
  )
}

export function isValidModifierOffer(
  event: unknown,
): event is
  | StartRunWithModifierOfferEvent
  | ModifierOfferedEvent {
  if (event === null || typeof event !== 'object') {
    return false
  }
  const candidate = event as Partial<
    StartRunWithModifierOfferEvent | ModifierOfferedEvent
  >
  if (
    candidate.type !== 'START_RUN_WITH_MODIFIER_OFFER' &&
    candidate.type !== 'MODIFIER_OFFERED'
  ) {
    return false
  }
  if (
    typeof candidate.offerId !== 'string' ||
    !candidate.offerId.trim() ||
    (candidate.origin !== RUN_MODIFIER_OFFER_ORIGIN.RUN_START_TEST &&
      candidate.origin !== RUN_MODIFIER_OFFER_ORIGIN.BOSS_REWARD) ||
    !Array.isArray(candidate.choices) ||
    candidate.choices.length < 2 ||
    candidate.choices.length > 3 ||
    !candidate.choices.every(isChoice)
  ) {
    return false
  }

  return (
    new Set(candidate.choices.map(({ id }) => id)).size ===
      candidate.choices.length &&
    new Set(candidate.choices.map(({ definitionId }) => definitionId)).size ===
      candidate.choices.length
  )
}

export function isValidRunStartModifierOffer(
  event: unknown,
): event is StartRunWithModifierOfferEvent {
  return (
    isValidModifierOffer(event) &&
    event.type === 'START_RUN_WITH_MODIFIER_OFFER' &&
    event.origin === RUN_MODIFIER_OFFER_ORIGIN.RUN_START_TEST
  )
}

export function isValidBossModifierOffer(
  event: unknown,
): event is ModifierOfferedEvent {
  return (
    isValidModifierOffer(event) &&
    event.type === 'MODIFIER_OFFERED' &&
    event.origin === RUN_MODIFIER_OFFER_ORIGIN.BOSS_REWARD
  )
}

export function copyModifierChoices(
  choices: readonly RunModifierChoiceReference[],
): readonly Readonly<RunModifierChoiceReference>[] {
  return Object.freeze(choices.map((choice) => Object.freeze({ ...choice })))
}
