import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import { clearRenderSnapshot } from '../../src/game/bridge/renderSnapshotLifecycle.ts'

test('clears all run-owned render data before returning to ready', () => {
  const snapshot = createRenderSnapshot()
  snapshot.cameraX = 100
  snapshot.cameraY = 200
  snapshot.playerX = 300
  snapshot.playerY = 400
  snapshot.playerSurvivalPresentation.currentShieldLayers = 3
  snapshot.playerSurvivalPresentation.eventRevision = 4
  snapshot.playerSurvivalPresentation.eventKind = 'SHIELD_HIT'
  snapshot.playerSurvivalPresentation.eventElapsedMs = 20
  snapshot.playerSurvivalPresentation.eventSeed = 9
  snapshot.playerSurvivalPresentation.deathRevision = 2
  snapshot.playerSurvivalPresentation.deathActive = true
  snapshot.playerSurvivalPresentation.deathFallProgress = 1
  snapshot.enemies.push({
    id: 1,
    glyphFrame: 1,
    x: 10,
    y: 20,
    rotation: 0,
    scale: 1,
    alpha: 1,
    tint: 0xffffff,
  })
  snapshot.effects.push({ ...snapshot.enemies[0], id: 2 })
  snapshot.projectiles.push({ ...snapshot.enemies[0], id: 3 })
  snapshot.orbits.push({ ...snapshot.enemies[0], id: 4 })
  snapshot.drops.push({ ...snapshot.enemies[0], id: 5 })
  snapshot.flameEmitters.push({
    id: 6,
    x: 0,
    y: 0,
    directionX: 1,
    directionY: 0,
    range: 10,
    fullAngleRadians: 1,
    progress: 0.5,
    particleCount: 1,
    innerTint: 0xffffff,
    innerAlpha: 1,
    outerTint: 0xffffff,
    outerAlpha: 1,
    seed: 1,
  })
  snapshot.topologyTransferPulses.push({
    id: 7,
    glyphFrame: 7,
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    alpha: 1,
    tint: 0xffffff,
  })

  clearRenderSnapshot(snapshot)

  assert.equal(snapshot.cameraX, 0)
  assert.equal(snapshot.cameraY, 0)
  assert.equal(snapshot.playerX, 0)
  assert.equal(snapshot.playerY, 0)
  assert.deepEqual(snapshot.playerSurvivalPresentation, {
    currentShieldLayers: 0,
    eventRevision: 0,
    eventKind: null,
    eventElapsedMs: 0,
    eventSeed: 0,
    deathRevision: 0,
    deathActive: false,
    deathFallProgress: 0,
  })
  assert.equal(snapshot.enemies.length, 0)
  assert.equal(snapshot.effects.length, 0)
  assert.equal(snapshot.projectiles.length, 0)
  assert.equal(snapshot.orbits.length, 0)
  assert.equal(snapshot.drops.length, 0)
  assert.equal(snapshot.flameEmitters.length, 0)
  assert.equal(snapshot.topologyTransferPulses.length, 0)
})
