import assert from 'node:assert/strict'
import test from 'node:test'
import { createRenderSnapshot } from '../../src/game/bridge/renderSnapshot.ts'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { clearCompletedRun } from '../../src/game/host/clearCompletedRun.ts'
import { GAME_CONFIG } from '../../src/game/runtime/gameConfig.ts'
import { finalizeRunResult } from '../../src/game/runtime/runResult.ts'
import { recordWeaponDamage } from '../../src/game/runtime/runStatistics.ts'
import {
  createWorldState,
  spawnEnemy,
} from '../../src/game/runtime/worldState.ts'

test('clears completed-run input and render state without disposing reusable ports', () => {
  const snapshot = createRenderSnapshot()
  const calls: string[] = []
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

  clearCompletedRun(
    { reset: () => calls.push('input.reset') },
    snapshot,
    { clear: () => calls.push('render.clear') },
  )

  assert.deepEqual(calls, ['input.reset', 'render.clear'])
  assert.equal(snapshot.playerSurvivalPresentation.deathActive, false)
  assert.equal(snapshot.playerSurvivalPresentation.deathFallProgress, 0)
  assert.equal(snapshot.enemies.length, 0)
})

test('creates a second run without survival, result, statistics, or entity residue', () => {
  const content = prepareGameContent()
  const firstWorld = createWorldState(
    'completed-run',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const firstWeapon = firstWorld.weaponLoadout.equipped[0]
  firstWorld.runTimeMs = 12_345
  firstWorld.player.level = 7
  firstWorld.player.survival.currentHealth = 0
  firstWorld.player.survival.currentShieldLayers = 0
  firstWorld.runStatistics.killCount = 9
  recordWeaponDamage(firstWorld.runStatistics, firstWeapon.id, 42)
  firstWorld.deathReview.active = true
  firstWorld.deathReview.revision = 1
  firstWorld.deathReview.elapsedMs = 3_000
  firstWorld.deathReview.canEnterRunResult = true
  finalizeRunResult(firstWorld)
  spawnEnemy(
    firstWorld,
    firstWorld.player.x + 100,
    firstWorld.player.y,
    0,
    content.ordinaryEnemyDefinitions[0],
  )

  const secondWorld = createWorldState(
    'next-run',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const secondWeapon = secondWorld.weaponLoadout.equipped[0]
  const secondWeaponStatistics =
    secondWorld.runStatistics.weaponByInstanceId.get(secondWeapon.id)

  assert.equal(secondWorld.runTimeMs, 0)
  assert.equal(secondWorld.runResult, null)
  assert.equal(secondWorld.player.level, 1)
  assert.equal(
    secondWorld.player.survival.currentHealth,
    GAME_CONFIG.initialPlayerHealth,
  )
  assert.equal(
    secondWorld.player.survival.currentShieldLayers,
    GAME_CONFIG.initialPlayerShieldLayers,
  )
  assert.deepEqual(secondWorld.deathReview, {
    active: false,
    revision: 0,
    lethalPresentationRevision: 0,
    elapsedMs: 0,
    canEnterRunResult: false,
  })
  assert.equal(secondWorld.runStatistics.killCount, 0)
  assert.equal(secondWorld.runStatistics.weaponByInstanceId.size, 1)
  assert.equal(secondWeaponStatistics?.totalDamage, 0)
  assert.equal(secondWeaponStatistics?.equippedGameplayTimeMs, 0)
  assert.equal(secondWorld.enemies.length, 0)
  assert.notEqual(secondWorld.enemies, firstWorld.enemies)
  assert.notEqual(secondWorld.glyphStore, firstWorld.glyphStore)
})
