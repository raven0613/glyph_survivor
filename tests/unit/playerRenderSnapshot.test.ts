import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { PLAYER_SURVIVAL_PRESENTATION_EVENT } from '../../src/game/runtime/playerSurvivalPresentation.ts'
import { beginPlayerDeathReview } from '../../src/game/runtime/playerDeathReview.ts'
import { createWorldState } from '../../src/game/runtime/worldState.ts'

test('publishes an explicit survival event without changing authoritative position', () => {
  const world = createWorldState(
    'player-presentation',
    800,
    600,
    prepareGameContent(),
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const snapshot = createRenderSnapshot()
  world.player.x += 20
  world.player.survival.currentShieldLayers = 0
  world.player.survivalPresentation.eventRevision = 3
  world.player.survivalPresentation.eventKind =
    PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_DEPLETED
  world.player.survivalPresentation.eventStartedAtMs = 100
  world.player.survivalPresentation.eventSeed = 77
  world.runTimeMs = 140

  writeRenderSnapshot(world, snapshot, 1)

  assert.equal(snapshot.playerX, world.player.x)
  assert.equal(snapshot.cameraX, world.player.x)
  assert.deepEqual(snapshot.playerSurvivalPresentation, {
    currentShieldLayers: 0,
    eventRevision: 3,
    eventKind: PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_DEPLETED,
    eventElapsedMs: 40,
    eventSeed: 77,
    deathRevision: 0,
    deathActive: false,
    deathFallProgress: 0,
  })
})

test('continues lethal feedback and fall progress while gameplay time is frozen', () => {
  const world = createWorldState(
    'player-death-presentation',
    800,
    600,
    prepareGameContent(),
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const snapshot = createRenderSnapshot()
  world.runTimeMs = 500
  world.player.survivalPresentation.eventRevision = 4
  world.player.survivalPresentation.eventKind =
    PLAYER_SURVIVAL_PRESENTATION_EVENT.HEALTH_DAMAGED
  world.player.survivalPresentation.eventStartedAtMs = 500
  beginPlayerDeathReview(world.deathReview, 4)
  world.deathReview.elapsedMs = 110

  writeRenderSnapshot(world, snapshot, 1)

  assert.equal(snapshot.playerSurvivalPresentation.eventElapsedMs, 110)
  assert.equal(snapshot.playerSurvivalPresentation.deathActive, true)
  assert.equal(snapshot.playerSurvivalPresentation.deathRevision, 1)
  assert.equal(snapshot.playerSurvivalPresentation.deathFallProgress, 0.5)
  assert.equal(snapshot.cameraX, world.player.x)
  assert.equal(snapshot.cameraY, world.player.y)
})
