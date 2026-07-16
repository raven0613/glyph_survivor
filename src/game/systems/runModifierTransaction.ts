import type { RunModifierDefinition } from '../content/modifiers/runModifierDefinition.ts'
import { RUN_MODIFIER_EFFECT_STRATEGY } from '../content/modifiers/runModifierDefinition.ts'
import type {
  RunModifierOfferOrigin,
  RunModifierState,
} from '../runtime/runModifierState.ts'

export interface SelectRunModifierCommand {
  readonly offerId: string
  readonly choiceId: string
}

export type SelectRunModifierResult =
  | {
      readonly ok: true
      readonly choiceId: string
      readonly definitionId: string
      readonly origin: RunModifierOfferOrigin
    }
  | { readonly ok: false; readonly error: string }

const INVALID_SELECTION_ERROR =
  'Invalid Modifier selection: the offer or choice is no longer active.'

export function selectRunModifierFromOffer(
  definitions: readonly Readonly<RunModifierDefinition>[],
  state: RunModifierState,
  command: SelectRunModifierCommand,
): SelectRunModifierResult {
  const offer = state.activeOffer
  const authorization = state.activeAuthorization
  if (
    !offer ||
    !authorization ||
    command.offerId !== offer.id ||
    offer.authorizationId !== authorization.id ||
    offer.origin !== authorization.origin
  ) {
    return { ok: false, error: INVALID_SELECTION_ERROR }
  }

  const choice = offer.choices.find(({ id }) => id === command.choiceId)
  const definition = choice
    ? definitions.find(({ id }) => id === choice.definitionId)
    : undefined
  if (
    !choice ||
    !definition ||
    state.ownedDefinitionIds.has(choice.definitionId)
  ) {
    return { ok: false, error: INVALID_SELECTION_ERROR }
  }

  state.ownedDefinitionIds.add(choice.definitionId)
  switch (definition.effectStrategyId) {
    case RUN_MODIFIER_EFFECT_STRATEGY.VOLATILE:
      state.resolvedProfile = Object.freeze({
        ...state.resolvedProfile,
        volatile: definition.volatile,
      })
      break
    case RUN_MODIFIER_EFFECT_STRATEGY.DISCONNECTED:
      state.resolvedProfile = Object.freeze({
        ...state.resolvedProfile,
        disconnected: definition.disconnected,
      })
      break
    case RUN_MODIFIER_EFFECT_STRATEGY.OVERLOAD:
      state.resolvedProfile = Object.freeze({
        ...state.resolvedProfile,
        overload: definition.overload,
      })
      break
  }
  state.activeOffer = null
  state.activeAuthorization = null
  return {
    ok: true,
    choiceId: choice.id,
    definitionId: choice.definitionId,
    origin: offer.origin,
  }
}
