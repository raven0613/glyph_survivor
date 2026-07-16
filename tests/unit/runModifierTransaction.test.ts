import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { createRunModifierState } from '../../src/game/runtime/runModifierState.ts'
import { createRunStartTestModifierOfferIfEnabled } from '../../src/game/systems/runModifierOffer.ts'
import { selectRunModifierFromOffer } from '../../src/game/systems/runModifierTransaction.ts'

test('commits an offered modifier once and rejects stale or unknown selections atomically', () => {
  const definitions = prepareGameContent().runModifierDefinitions
  const state = createRunModifierState('transaction')
  const offer = createRunStartTestModifierOfferIfEnabled(
    definitions,
    state,
    true,
  )
  assert.ok(offer)

  const beforeUnknown = [...state.ownedDefinitionIds]
  const unknown = selectRunModifierFromOffer(definitions, state, {
    offerId: offer.id,
    choiceId: 'not-offered',
  })
  assert.equal(unknown.ok, false)
  assert.deepEqual([...state.ownedDefinitionIds], beforeUnknown)
  assert.equal(state.activeOffer, offer)

  const choice = offer.choices[1]
  const committed = selectRunModifierFromOffer(definitions, state, {
    offerId: offer.id,
    choiceId: choice.id,
  })
  assert.deepEqual(committed, {
    ok: true,
    choiceId: choice.id,
    definitionId: choice.definitionId,
    origin: offer.origin,
  })
  assert.deepEqual([...state.ownedDefinitionIds], [choice.definitionId])
  assert.equal(state.activeAuthorization, null)
  assert.equal(state.activeOffer, null)

  const replay = selectRunModifierFromOffer(definitions, state, {
    offerId: offer.id,
    choiceId: choice.id,
  })
  assert.equal(replay.ok, false)
  assert.deepEqual([...state.ownedDefinitionIds], [choice.definitionId])
})

test('a fresh run state clears offers, guards, and owned modifiers', () => {
  const definitions = prepareGameContent().runModifierDefinitions
  const firstRun = createRunModifierState('reset-seed')
  const offer = createRunStartTestModifierOfferIfEnabled(
    definitions,
    firstRun,
    true,
  )
  assert.ok(offer)
  const result = selectRunModifierFromOffer(definitions, firstRun, {
    offerId: offer.id,
    choiceId: offer.choices[0].id,
  })
  assert.equal(result.ok, true)

  const resetRun = createRunModifierState('reset-seed')
  assert.equal(resetRun.activeAuthorization, null)
  assert.equal(resetRun.activeOffer, null)
  assert.equal(resetRun.runStartTestAuthorizationCreated, false)
  assert.deepEqual([...resetRun.ownedDefinitionIds], [])
})
