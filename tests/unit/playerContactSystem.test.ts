import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { getXpToNextLevel } from '../../src/game/content/upgrades/levelProgression.ts'
import { GLYPH_CELL_STATE } from '../../src/game/glyph/glyphStore.ts'
import { GAME_CONFIG } from '../../src/game/runtime/gameConfig.ts'
import {
  SIMULATION_STEP_RESULT,
  runSimulationStep,
} from '../../src/game/runtime/runSimulationStep.ts'
import {
  createWorldState,
  spawnEnemy,
} from '../../src/game/runtime/worldState.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runPlayerContactSystem } from '../../src/game/systems/playerContactSystem.ts'
import { runPlayerSurvivalSystem } from '../../src/game/systems/playerSurvivalSystem.ts'

function createWorld(seed: string) {
  const content = prepareGameContent()
  const world = createWorldState(
    seed,
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  return { content, world }
}

function overlapOwnerGlyphsWithPlayer(
  world: ReturnType<typeof createWorld>['world'],
  ownerId: number,
): void {
  for (const glyph of world.glyphStore.getOwnerGlyphs(ownerId)) {
    world.glyphStore.setGlyphLocalPosition(glyph.id, 0, 0)
    world.glyphStore.setGlyphBodyMotion(glyph.id, 0, 0, 0)
  }
}

test('deduplicates multiple contact glyphs from one active creature owner', () => {
  const { content, world } = createWorld('contact-owner-dedup')
  const bone = spawnEnemy(
    world,
    world.player.x,
    world.player.y,
    0,
    content.ordinaryEnemyDefinitions[1],
  )
  bone.phase = 'ACTIVE'
  overlapOwnerGlyphsWithPlayer(world, bone.id)
  world.player.survival.currentShieldLayers = 0
  world.player.survival.maximumShieldLayers = 0
  runEnemySpatialIndexSystem(world)

  const candidateCount = runPlayerContactSystem(world)
  const died = runPlayerSurvivalSystem(world)

  assert.equal(candidateCount, 1)
  assert.equal(died, false)
  assert.equal(
    world.player.survival.currentHealth,
    GAME_CONFIG.initialPlayerHealth -
      content.ordinaryEnemyDefinitions[1].contactDamage,
  )
})

test('keeps an active husk in the authoritative player-contact outline', () => {
  const { content, world } = createWorld('contact-husk-outline')
  const zombie = spawnEnemy(
    world,
    world.player.x,
    world.player.y,
    0,
    content.ordinaryEnemyDefinitions[0],
  )
  zombie.phase = 'ACTIVE'
  overlapOwnerGlyphsWithPlayer(world, zombie.id)
  const glyph = world.glyphStore.getOwnerGlyphs(zombie.id)[0]
  world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
  assert.equal(glyph.state, GLYPH_CELL_STATE.HUSK)
  runEnemySpatialIndexSystem(world)

  assert.equal(runPlayerContactSystem(world), 1)
})

test('does not create player-contact damage outside combat phases', () => {
  const { content, world } = createWorld('contact-phase-gate')
  const zombie = spawnEnemy(
    world,
    world.player.x,
    world.player.y,
    100,
    content.ordinaryEnemyDefinitions[0],
  )
  overlapOwnerGlyphsWithPlayer(world, zombie.id)

  runEnemySpatialIndexSystem(world)
  assert.equal(runPlayerContactSystem(world), 0)

  zombie.phase = 'INACTIVE'
  runEnemySpatialIndexSystem(world)
  assert.equal(runPlayerContactSystem(world), 0)
})

test('returns player death before processing a same-step upgrade trigger', () => {
  const { content, world } = createWorld('death-before-upgrade')
  const zombie = spawnEnemy(
    world,
    world.player.x,
    world.player.y,
    0,
    content.ordinaryEnemyDefinitions[0],
  )
  zombie.phase = 'ACTIVE'
  overlapOwnerGlyphsWithPlayer(world, zombie.id)
  world.player.survival.currentHealth =
    content.ordinaryEnemyDefinitions[0].contactDamage
  world.player.survival.currentShieldLayers = 0
  world.player.survival.maximumShieldLayers = 0
  world.weaponLoadout.equipped[0].cooldownRemainingMs = 60_000
  world.collectedXpThisStep = getXpToNextLevel(
    content.levelProgression,
    world.player.level,
  )

  const result = runSimulationStep(world, GAME_CONFIG.fixedStepMs)

  assert.equal(result, SIMULATION_STEP_RESULT.PLAYER_DIED)
  assert.equal(world.player.survival.currentHealth, 0)
  assert.equal(world.player.level, 1)
  assert.equal(world.upgradeState.activeOffer, null)
  assert.ok(world.runResult)
  assert.equal(world.runResult.gameplayTimeMs, GAME_CONFIG.fixedStepMs)
  assert.equal(Object.isFrozen(world.runResult), true)
})
