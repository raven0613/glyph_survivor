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
import { runDropSystem } from '../../src/game/systems/dropSystem.ts'
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

test('keeps a depleted BAT glyph as a dim authoritative husk', () => {
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
  assert.equal(bGlyph.state, GLYPH_CELL_STATE.HUSK)
  assert.equal(aGlyph.state, GLYPH_CELL_STATE.HEALTHY)
  assert.equal(tGlyph.state, GLYPH_CELL_STATE.HEALTHY)
  assert.equal(enemy.phase, 'ACTIVE')
  assert.deepEqual(world.glyphStore.getOwnerDurability(enemy.id), {
    currentDurability: 2,
    maxDurability: 3,
    livingGlyphCount: 2,
    glyphCount: 3,
  })

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)

  assert.deepEqual(
    snapshot.enemies.map((glyph) => glyph.id),
    [bGlyph.id, aGlyph.id, tGlyph.id],
  )
  assert.deepEqual(
    snapshot.enemies.map((glyph) => glyph.glyphFrame),
    [bGlyph.glyphFrame, aGlyph.glyphFrame, tGlyph.glyphFrame],
  )
  assert.ok(snapshot.enemies[0].alpha > 0)
  assert.ok(snapshot.enemies[0].alpha < snapshot.enemies[1].alpha)
})

test('applies impact response to a husk while damaging a remote living frontier', () => {
  const world = createTestWorld('husk-frontier-impact')
  const enemy = spawnEnemy(world, 2_000, 2_000, 300)
  enemy.phase = 'ACTIVE'
  const [bGlyph, aGlyph] = world.glyphStore.getOwnerGlyphs(enemy.id)
  runEnemySpatialIndexSystem(world)
  fireAtGlyph(world, enemy, bGlyph)

  assert.equal(bGlyph.state, GLYPH_CELL_STATE.HUSK)
  assert.equal(aGlyph.velocityX, 0)

  fireAtGlyph(world, enemy, bGlyph)

  assert.equal(aGlyph.state, GLYPH_CELL_STATE.HUSK)
  assert.equal(aGlyph.velocityX, 0)
  assert.ok(bGlyph.velocityX > 0)

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)
  const bRender = snapshot.enemies.find((glyph) => glyph.id === bGlyph.id)
  const aRender = snapshot.enemies.find((glyph) => glyph.id === aGlyph.id)
  assert.ok(bRender)
  assert.ok(aRender)
  assert.ok(bRender.alpha > bGlyph.alpha)
  assert.ok(bRender.scale > bGlyph.scale)
  assert.equal(aRender.alpha, aGlyph.alpha)
  assert.equal(aRender.scale, aGlyph.scale)
  assert.equal(snapshot.effects.length, 3)
})

test('collapses and cleans up a fixed body only after every glyph is a husk', () => {
  const world = createTestWorld('multi-glyph-death')
  const enemy = spawnEnemy(world, 2_000, 2_000, 300)
  enemy.phase = 'ACTIVE'
  const glyphs = [...world.glyphStore.getOwnerGlyphs(enemy.id)]
  runEnemySpatialIndexSystem(world)

  fireAtGlyph(world, enemy, glyphs[0])
  fireAtGlyph(world, enemy, glyphs[1])
  assert.equal(enemy.phase, 'ACTIVE')

  fireAtGlyph(world, enemy, glyphs[2])

  assert.equal(enemy.phase, 'COLLAPSING')
  assert.equal(world.glyphStore.isOwnerDepleted(enemy.id), true)

  const ignoredProjectile = spawnProjectile(
    world,
    getGlyphWorldX(enemy.x, glyphs[0]),
    getGlyphWorldY(enemy.y, glyphs[0]),
    1,
    0,
    ASSISTED_PROJECTILE_TRACKING,
    enemy.id,
  )
  runCollisionSystem(world)
  assert.equal(ignoredProjectile.isAlive, true)
  ignoredProjectile.isAlive = false

  runDeathSystem(world, enemy.collapseDurationMs)
  assert.equal(enemy.phase, 'DEAD')

  runDropSystem(world)
  runCleanupSystem(world)

  assert.equal(world.glyphStore.getOwnerGlyphs(enemy.id).length, 0)
  assert.equal(world.glyphStore.getOwnerDurability(enemy.id), undefined)
  assert.equal(world.enemies.length, 0)
})
