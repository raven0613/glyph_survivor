import assert from 'node:assert/strict'
import test from 'node:test'
import { createRenderSnapshot, writeRenderSnapshot } from '../../src/game/bridge/renderSnapshot.ts'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { ASSISTED_PROJECTILE_TRACKING } from '../../src/game/content/weapons/projectileTracking.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../../src/game/glyph/glyphPosition.ts'
import {
  GLYPH_CELL_STATE,
  type GlyphCell,
} from '../../src/game/glyph/glyphStore.ts'
import type { EnemyState } from '../../src/game/runtime/worldEntities.ts'
import {
  createWorldState,
  spawnEnemy,
  spawnProjectile,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import { runCleanupSystem } from '../../src/game/systems/cleanupSystem.ts'
import { runCollisionSystem } from '../../src/game/systems/collisionSystem.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runDeathSystem } from '../../src/game/systems/deathSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'

function createTestWorld(seed: string): WorldState {
  return createWorldState(seed, 800, 600, prepareGameContent())
}

function fireAtGlyph(
  world: WorldState,
  enemy: EnemyState,
  glyph: GlyphCell,
): void {
  spawnProjectile(
    world,
    getGlyphWorldX(enemy.x, glyph),
    getGlyphWorldY(enemy.y, glyph),
    1,
    0,
    ASSISTED_PROJECTILE_TRACKING,
    enemy.id,
  )
  runCollisionSystem(world)
  runDamageSystem(world)
  runDeathSystem(world)
}

test('damages only the directly hit BAT glyph and leaves a local hole', () => {
  const world = createTestWorld('local-glyph-damage')
  const enemy = spawnEnemy(world, 2_000, 2_000, 300)
  enemy.phase = 'ACTIVE'
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  const [bGlyph, aGlyph, tGlyph] = glyphs
  const projectile = spawnProjectile(
    world,
    getGlyphWorldX(enemy.x, bGlyph),
    getGlyphWorldY(enemy.y, bGlyph),
    1,
    0,
    ASSISTED_PROJECTILE_TRACKING,
    enemy.id,
  )
  runEnemySpatialIndexSystem(world)

  runCollisionSystem(world)

  assert.equal(projectile.isAlive, false)
  assert.equal(bGlyph.currentDurability, 1)

  runDamageSystem(world)
  runDeathSystem(world)

  assert.equal('hp' in enemy, false)
  assert.equal(bGlyph.state, GLYPH_CELL_STATE.DESTROYED)
  assert.equal(aGlyph.state, GLYPH_CELL_STATE.ALIVE)
  assert.equal(tGlyph.state, GLYPH_CELL_STATE.ALIVE)
  assert.equal(enemy.phase, 'ACTIVE')
  assert.deepEqual(world.glyphStore.getOwnerDurability(enemy.id), {
    currentDurability: 2,
    maxDurability: 3,
    aliveGlyphCount: 2,
    glyphCount: 3,
  })

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)

  assert.deepEqual(
    snapshot.enemies.map((glyph) => glyph.id),
    [aGlyph.id, tGlyph.id],
  )
  assert.deepEqual(
    snapshot.enemies.map((glyph) => glyph.glyphFrame),
    [aGlyph.glyphFrame, tGlyph.glyphFrame],
  )
})

test('kills and cleans up a fixed body only after every glyph is destroyed', () => {
  const world = createTestWorld('multi-glyph-death')
  const enemy = spawnEnemy(world, 2_000, 2_000, 300)
  enemy.phase = 'ACTIVE'
  const glyphs = [...world.glyphStore.getOwnerGlyphs(enemy.id)]
  runEnemySpatialIndexSystem(world)

  fireAtGlyph(world, enemy, glyphs[0])
  fireAtGlyph(world, enemy, glyphs[1])
  assert.equal(enemy.phase, 'ACTIVE')

  fireAtGlyph(world, enemy, glyphs[2])

  assert.equal(enemy.phase, 'DEAD')
  assert.equal(world.glyphStore.isOwnerDestroyed(enemy.id), true)

  enemy.rewardCommitted = true
  runCleanupSystem(world)

  assert.equal(world.glyphStore.getOwnerGlyphs(enemy.id).length, 0)
  assert.equal(world.glyphStore.getOwnerDurability(enemy.id), undefined)
  assert.equal(world.enemies.length, 0)
})
