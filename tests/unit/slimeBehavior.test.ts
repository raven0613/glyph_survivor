import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../../src/game/glyph/glyphPosition.ts'
import { GLYPH_CELL_STATE } from '../../src/game/glyph/glyphStore.ts'
import {
  createWorldState,
  spawnEnemy,
  spawnProjectile,
} from '../../src/game/runtime/worldState.ts'
import { ASSISTED_PROJECTILE_TRACKING } from '../../src/game/content/weapons/projectileTracking.ts'
import { runBossSpawnSystem } from '../../src/game/systems/bossSpawnSystem.ts'
import { runCollisionSystem } from '../../src/game/systems/collisionSystem.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runDirectorSystem } from '../../src/game/systems/directorSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runGlyphMaterialSystem } from '../../src/game/systems/glyphMaterialSystem.ts'
import { runMovementSystem } from '../../src/game/systems/movementSystem.ts'

test('moves and morphs Slime through composed runtime strategies', () => {
  const content = prepareGameContent()
  const world = createWorldState('slime-movement', 800, 600, content)
  const slime = spawnEnemy(
    world,
    1_800,
    2_000,
    0,
    content.slimeBossDefinition,
  )
  slime.phase = 'ACTIVE'
  const trackedGlyph = world.glyphStore.getOwnerGlyphs(slime.id)[0]
  const initialX = slime.x
  const initialLocalX = trackedGlyph.localX

  runMovementSystem(world, 250)

  assert.ok(slime.x > initialX)
  assert.ok(slime.x - initialX < content.slimeBossDefinition.maximumSpeed * 0.25)
  assert.notEqual(trackedGlyph.localX, initialLocalX)
})

test('applies real Slime displacement to a surviving hit glyph and springs it back', () => {
  const content = prepareGameContent()
  const world = createWorldState('slime-material', 800, 600, content)
  const slime = spawnEnemy(
    world,
    2_000,
    2_000,
    0,
    content.slimeBossDefinition,
  )
  slime.phase = 'ACTIVE'
  const glyph = world.glyphStore
    .getOwnerGlyphs(slime.id)
    .find((candidate) => candidate.maxDurability === 2)

  assert.ok(glyph)
  spawnProjectile(
    world,
    getGlyphWorldX(slime.x, glyph),
    getGlyphWorldY(slime.y, glyph),
    1,
    0,
    ASSISTED_PROJECTILE_TRACKING,
    slime.id,
  )
  runEnemySpatialIndexSystem(world)
  runCollisionSystem(world)
  runDamageSystem(world)

  assert.equal(glyph.currentDurability, 1)
  assert.equal(glyph.state, GLYPH_CELL_STATE.ALIVE)
  assert.ok(glyph.velocityX > 0)

  runGlyphMaterialSystem(world, 100)
  const displacedOffsetX = glyph.offsetX
  assert.ok(displacedOffsetX > 0)

  for (let step = 0; step < 120; step += 1) {
    runGlyphMaterialSystem(world, 1_000 / 60)
  }

  assert.ok(Math.abs(glyph.offsetX) < displacedOffsetX)
})

test('spawns exactly one Slime boss from the first successful ordinary wave', () => {
  const content = prepareGameContent()
  const world = createWorldState('slime-first-wave', 800, 600, content)
  world.spawnCooldownMs = 0
  runEnemySpatialIndexSystem(world)

  runDirectorSystem(world, 1_000 / 60)
  runBossSpawnSystem(world)
  runBossSpawnSystem(world)

  assert.equal(
    world.enemies.filter(
      (enemy) => enemy.definitionId === content.ordinaryEnemyDefinition.id,
    ).length,
    1,
  )
  assert.equal(
    world.enemies.filter(
      (enemy) => enemy.definitionId === content.slimeBossDefinition.id,
    ).length,
    1,
  )
})
