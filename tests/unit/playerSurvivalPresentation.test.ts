import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PLAYER_SURVIVAL_PRESENTATION_EVENT,
  createPlayerSurvivalPresentationState,
  recordPlayerSurvivalPresentation,
} from '../../src/game/runtime/playerSurvivalPresentation.ts'
import {
  createPlayerDamageStepOutcome,
  createPlayerSurvivalState,
  type PlayerSurvivalConfig,
} from '../../src/game/runtime/playerSurvival.ts'

const CONFIG: Readonly<PlayerSurvivalConfig> = Object.freeze({
  initialPlayerHealth: 10,
  initialPlayerShieldLayers: 2,
  shieldRechargeIntervalMs: 1_000,
  playerDamageInvulnerabilityMs: 500,
  playerResumeInvulnerabilityMs: 500,
  playerCollisionRadius: 14,
})

test('records distinct shield hit and depletion events', () => {
  const survival = createPlayerSurvivalState(CONFIG)
  const presentation = createPlayerSurvivalPresentationState(
    survival.currentShieldLayers,
  )
  const outcome = createPlayerDamageStepOutcome()

  assert.equal(
    presentation.eventKind,
    PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_RESTORED,
  )

  survival.currentShieldLayers = 1
  outcome.acceptedEventId = 41
  outcome.shieldLayersConsumed = 1
  recordPlayerSurvivalPresentation(presentation, survival, outcome, 100)
  assert.equal(
    presentation.eventKind,
    PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_HIT,
  )

  survival.currentShieldLayers = 0
  outcome.acceptedEventId = 42
  recordPlayerSurvivalPresentation(presentation, survival, outcome, 200)
  assert.equal(
    presentation.eventKind,
    PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_DEPLETED,
  )
  assert.equal(presentation.eventSeed, 42)
})

test('health damage wins presentation priority and leaves shield state untouched', () => {
  const survival = createPlayerSurvivalState(CONFIG)
  const presentation = createPlayerSurvivalPresentationState(0)
  const outcome = createPlayerDamageStepOutcome()
  outcome.acceptedEventId = 8
  outcome.healthDamageApplied = 3

  recordPlayerSurvivalPresentation(presentation, survival, outcome, 250)

  assert.equal(
    presentation.eventKind,
    PLAYER_SURVIVAL_PRESENTATION_EVENT.HEALTH_DAMAGED,
  )
  assert.equal(survival.currentShieldLayers, 2)
  assert.equal(presentation.eventStartedAtMs, 250)
})

test('records shield growth only for a zero-to-positive transition', () => {
  const survival = createPlayerSurvivalState(CONFIG)
  const presentation = createPlayerSurvivalPresentationState(0)
  const outcome = createPlayerDamageStepOutcome()
  survival.currentShieldLayers = 1
  outcome.shieldLayersRestored = 1

  recordPlayerSurvivalPresentation(presentation, survival, outcome, 1_000)
  const restoredRevision = presentation.eventRevision
  assert.equal(
    presentation.eventKind,
    PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_RESTORED,
  )

  survival.currentShieldLayers = 2
  recordPlayerSurvivalPresentation(presentation, survival, outcome, 2_000)
  assert.equal(presentation.eventRevision, restoredRevision)
})

test('ignored damage does not create a presentation event', () => {
  const survival = createPlayerSurvivalState({
    ...CONFIG,
    initialPlayerShieldLayers: 0,
  })
  const presentation = createPlayerSurvivalPresentationState(0)
  const outcome = createPlayerDamageStepOutcome()

  recordPlayerSurvivalPresentation(presentation, survival, outcome, 100)

  assert.equal(presentation.eventRevision, 0)
  assert.equal(presentation.eventKind, null)
})
