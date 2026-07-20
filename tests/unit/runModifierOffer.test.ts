import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import {
  RUN_MODIFIER_EFFECT_STRATEGY,
  type RunModifierDefinition,
} from '../../src/game/content/modifiers/runModifierDefinition.ts'
import {
  createBossRewardModifierOffer,
  createRunStartTestModifierOfferIfEnabled,
} from '../../src/game/systems/runModifierOffer.ts'
import {
  RUN_MODIFIER_OFFER_ORIGIN,
  createRunModifierState,
} from '../../src/game/runtime/runModifierState.ts'
import { createWorldState } from '../../src/game/runtime/worldState.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'

function createExtraDefinition(index: number): RunModifierDefinition {
  return Object.freeze({
    id: `modifier.test-${index}`,
    title: `TEST ${index}`,
    description: `Test modifier ${index}.`,
    identityGlyph: String(index),
    effectStrategyId: RUN_MODIFIER_EFFECT_STRATEGY.OVERLOAD,
    overload: {
      overloadThresholdRatio: 0.6,
      crackDamageMultiplier: 1.4,
    },
  })
}

test('prepares the three confirmed Run Modifier definitions in stable order', () => {
  const content = prepareGameContent()

  assert.deepEqual(
    content.runModifierDefinitions.map(({ id }) => id),
    ['modifier.volatile', 'modifier.disconnected', 'modifier.overload'],
  )
  assert.equal(Object.isFrozen(content.runModifierDefinitions), true)
  assert.equal(Object.isFrozen(content.runModifierDefinitionsById), true)
})

test('a disabled run-start test offer has no authorization, counter, or RNG side effect', () => {
  const definitions = prepareGameContent().runModifierDefinitions
  const state = createRunModifierState('flag-off')

  assert.equal(
    createRunStartTestModifierOfferIfEnabled(definitions, state, false),
    null,
  )
  assert.equal(state.activeAuthorization, null)
  assert.equal(state.activeOffer, null)
  assert.equal(state.nextAuthorizationId, 1)
  assert.equal(state.nextOfferId, 1)
  assert.equal(state.runStartTestAuthorizationCreated, false)

  const enabledAfterNoop = createRunStartTestModifierOfferIfEnabled(
    definitions,
    state,
    true,
  )
  const freshEnabled = createRunStartTestModifierOfferIfEnabled(
    definitions,
    createRunModifierState('flag-off'),
    true,
  )
  assert.deepEqual(enabledAfterNoop, freshEnabled)
})

test('creates exactly one three-choice run-start authorization and offer', () => {
  const definitions = prepareGameContent().runModifierDefinitions
  const state = createRunModifierState('run-start')
  const offer = createRunStartTestModifierOfferIfEnabled(
    definitions,
    state,
    true,
  )

  assert.ok(offer)
  assert.equal(offer.origin, RUN_MODIFIER_OFFER_ORIGIN.RUN_START_TEST)
  assert.equal(offer.choices.length, 3)
  assert.equal(new Set(offer.choices.map(({ definitionId }) => definitionId)).size, 3)
  assert.equal(
    createRunStartTestModifierOfferIfEnabled(definitions, state, true),
    null,
  )
})

test('creates the run-start offer on a fresh equipped world before gameplay advances', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'pre-step',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const offer = createRunStartTestModifierOfferIfEnabled(
    content.runModifierDefinitions,
    world.runModifierState,
    true,
  )
  const weapon = world.weaponLoadout.equipped[0]

  assert.ok(offer)
  assert.equal(world.runTimeMs, 0)
  assert.equal(world.diagnostics.simulationStepCount, 0)
  assert.equal(world.enemies.length, 0)
  assert.equal(
    world.runStatistics.weaponByInstanceId.get(weapon.id)
      ?.equippedGameplayTimeMs,
    0,
  )
})

test('run-start and Boss reward offers consume independent deterministic RNG streams', () => {
  const baseDefinitions = prepareGameContent().runModifierDefinitions
  const definitions = Object.freeze([
    ...baseDefinitions,
    createExtraDefinition(1),
    createExtraDefinition(2),
    createExtraDefinition(3),
  ])
  const stateAfterRunStart = createRunModifierState('domain-separated')
  createRunStartTestModifierOfferIfEnabled(definitions, stateAfterRunStart, true)
  stateAfterRunStart.activeAuthorization = null
  stateAfterRunStart.activeOffer = null

  const bossAfterRunStart = createBossRewardModifierOffer(
    definitions,
    stateAfterRunStart,
    42,
  )
  const bossFromFreshState = createBossRewardModifierOffer(
    definitions,
    createRunModifierState('domain-separated'),
    42,
  )

  assert.deepEqual(
    bossAfterRunStart.choices.map(({ definitionId }) => definitionId),
    bossFromFreshState.choices.map(({ definitionId }) => definitionId),
  )
  assert.equal(bossAfterRunStart.origin, RUN_MODIFIER_OFFER_ORIGIN.BOSS_REWARD)
})

test('a later Boss offer falls back to two choices after one of three definitions is owned', () => {
  const definitions = prepareGameContent().runModifierDefinitions
  const state = createRunModifierState('two-choice')
  state.ownedDefinitionIds.add(definitions[0].id)

  const offer = createBossRewardModifierOffer(definitions, state, 7)

  assert.equal(offer.choices.length, 2)
  assert.equal(
    offer.choices.some(({ definitionId }) => definitionId === definitions[0].id),
    false,
  )
})

test('a later Boss offer contains the only remaining unowned definition', () => {
  const definitions = prepareGameContent().runModifierDefinitions
  const state = createRunModifierState('one-choice')
  state.ownedDefinitionIds.add(definitions[0].id)
  state.ownedDefinitionIds.add(definitions[1].id)

  const offer = createBossRewardModifierOffer(definitions, state, 8)

  assert.equal(offer.choices.length, 1)
  assert.equal(offer.choices[0].definitionId, definitions[2].id)
  assert.equal(offer.origin, RUN_MODIFIER_OFFER_ORIGIN.BOSS_REWARD)
})

test('rejects a Boss reward when no unowned Modifier definition remains', () => {
  const definitions = prepareGameContent().runModifierDefinitions
  const state = createRunModifierState('zero-choice')
  definitions.forEach(({ id }) => state.ownedDefinitionIds.add(id))

  assert.throws(
    () => createBossRewardModifierOffer(definitions, state, 9),
    /at least one unowned Run Modifier/i,
  )
})
