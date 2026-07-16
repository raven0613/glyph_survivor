import type { RunModifierDefinition } from '../content/modifiers/runModifierDefinition.ts'
import type { SeededRng } from '../core/seededRng.ts'
import {
  RUN_MODIFIER_OFFER_ORIGIN,
  type RunModifierAuthorization,
  type RunModifierChoiceReference,
  type RunModifierOffer,
  type RunModifierOfferOrigin,
  type RunModifierState,
} from '../runtime/runModifierState.ts'

const MAXIMUM_MODIFIER_OFFER_CHOICE_COUNT = 3
const MINIMUM_MODIFIER_OFFER_CHOICE_COUNT = 2

function getEligibleDefinitions(
  definitions: readonly Readonly<RunModifierDefinition>[],
  state: RunModifierState,
): readonly Readonly<RunModifierDefinition>[] {
  const seenIds = new Set<string>()
  const eligible: Readonly<RunModifierDefinition>[] = []

  for (const definition of definitions) {
    if (!definition.id.trim() || seenIds.has(definition.id)) {
      throw new Error('Run Modifier definitions require unique, non-empty IDs.')
    }
    seenIds.add(definition.id)
    if (!state.ownedDefinitionIds.has(definition.id)) {
      eligible.push(definition)
    }
  }

  return eligible
}

function chooseDefinitions(
  definitions: readonly Readonly<RunModifierDefinition>[],
  rng: SeededRng,
): readonly Readonly<RunModifierDefinition>[] {
  if (definitions.length <= MAXIMUM_MODIFIER_OFFER_CHOICE_COUNT) {
    return definitions
  }

  const candidates = [...definitions]
  for (
    let index = 0;
    index < MAXIMUM_MODIFIER_OFFER_CHOICE_COUNT;
    index += 1
  ) {
    const selectedIndex =
      index + Math.floor(rng.next() * (candidates.length - index))
    const selected = candidates[selectedIndex]
    candidates[selectedIndex] = candidates[index]
    candidates[index] = selected
  }
  return candidates.slice(0, MAXIMUM_MODIFIER_OFFER_CHOICE_COUNT)
}

function createOffer(
  definitions: readonly Readonly<RunModifierDefinition>[],
  state: RunModifierState,
  origin: RunModifierOfferOrigin,
  bossEncounterId: number | null,
): Readonly<RunModifierOffer> {
  if (state.activeAuthorization || state.activeOffer) {
    throw new Error('A Run Modifier offer is already active.')
  }
  const eligibleDefinitions = getEligibleDefinitions(definitions, state)
  if (eligibleDefinitions.length < MINIMUM_MODIFIER_OFFER_CHOICE_COUNT) {
    throw new Error('At least two unowned Run Modifiers are required for an offer.')
  }

  const authorizationId = `run-modifier-authorization-${state.nextAuthorizationId}`
  const offerId = `run-modifier-offer-${state.nextOfferId}`
  const rng =
    origin === RUN_MODIFIER_OFFER_ORIGIN.RUN_START_TEST
      ? state.runStartTestOfferRng
      : state.bossRewardOfferRng
  const choices: readonly Readonly<RunModifierChoiceReference>[] =
    Object.freeze(
      chooseDefinitions(eligibleDefinitions, rng).map((definition, index) =>
        Object.freeze({
          id: `${offerId}:${index}`,
          definitionId: definition.id,
          title: definition.title,
          description: definition.description,
          identityGlyph: definition.identityGlyph,
        }),
      ),
    )
  const authorization: Readonly<RunModifierAuthorization> = Object.freeze({
    id: authorizationId,
    origin,
    bossEncounterId,
  })
  const offer: Readonly<RunModifierOffer> = Object.freeze({
    id: offerId,
    authorizationId,
    origin,
    choices,
  })

  state.nextAuthorizationId += 1
  state.nextOfferId += 1
  state.activeAuthorization = authorization
  state.activeOffer = offer
  return offer
}

export function createRunStartTestModifierOfferIfEnabled(
  definitions: readonly Readonly<RunModifierDefinition>[],
  state: RunModifierState,
  enabled: boolean,
): Readonly<RunModifierOffer> | null {
  if (!enabled || state.runStartTestAuthorizationCreated) {
    return null
  }

  const offer = createOffer(
    definitions,
    state,
    RUN_MODIFIER_OFFER_ORIGIN.RUN_START_TEST,
    null,
  )
  state.runStartTestAuthorizationCreated = true
  return offer
}

export function createBossRewardModifierOffer(
  definitions: readonly Readonly<RunModifierDefinition>[],
  state: RunModifierState,
  bossEncounterId: number,
): Readonly<RunModifierOffer> {
  if (!Number.isSafeInteger(bossEncounterId) || bossEncounterId <= 0) {
    throw new RangeError('Boss encounter ID must be a positive safe integer.')
  }
  return createOffer(
    definitions,
    state,
    RUN_MODIFIER_OFFER_ORIGIN.BOSS_REWARD,
    bossEncounterId,
  )
}
