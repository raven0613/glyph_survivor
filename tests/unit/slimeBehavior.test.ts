import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { createRenderSnapshot, writeRenderSnapshot } from '../../src/game/bridge/renderSnapshot.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../../src/game/glyph/glyphPosition.ts'
import { GLYPH_CELL_STATE } from '../../src/game/glyph/glyphStore.ts'
import { getGlyphMaterialDefinition } from '../../src/game/glyph/glyphMaterial.ts'
import { DAMAGE_TARGET_MODE } from '../../src/game/glyph/localDamage.ts'
import {
  createWorldState,
  spawnEnemy,
} from '../../src/game/runtime/worldState.ts'
import { spawnProjectile } from '../../src/game/runtime/spawnProjectile.ts'
import { runBossSpawnSystem } from '../../src/game/systems/bossSpawnSystem.ts'
import { runCollisionSystem } from '../../src/game/systems/collisionSystem.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runDirectorSystem } from '../../src/game/systems/directorSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runGlyphMaterialSystem } from '../../src/game/systems/glyphMaterialSystem.ts'
import { runMovementSystem } from '../../src/game/systems/movementSystem.ts'

test('moves and morphs Slime through composed runtime strategies', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'slime-movement',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
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

test('reduces the initial authored Slime morph to seventy-five percent', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'slime-authored-morph',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const slime = spawnEnemy(world, 1_800, 2_000, 0, content.slimeBossDefinition)
  slime.phase = 'ACTIVE'
  const glyph = world.glyphStore.getOwnerGlyphs(slime.id)[0]
  const neutral = content.slimeBossDefinition.body.poses.neutral
    .anchorsBySlotId[glyph.bodySlotId]
  const wide = content.slimeBossDefinition.body.poses.wide
    .anchorsBySlotId[glyph.bodySlotId]

  runMovementSystem(world, 600)

  assert.ok(
    Math.abs(
      glyph.localX -
        (neutral.localX +
          (wide.localX - neutral.localX) *
            content.slimeBossDefinition.authoredMorphStrength),
    ) < 0.0001,
  )
  assert.ok(
    Math.abs(
      glyph.localY -
        (neutral.localY +
          (wide.localY - neutral.localY) *
            content.slimeBossDefinition.authoredMorphStrength),
    ) < 0.0001,
  )
})

test('increases the compiled Slime morph beyond its previous scale range', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'slime-compiled-morph',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const slime = spawnEnemy(world, 1_800, 2_000, 0, content.slimeBossDefinition)
  slime.phase = 'ACTIVE'
  slime.layoutMode = 'COMPILED'
  const glyph = world.glyphStore
    .getOwnerGlyphs(slime.id)
    .find((candidate) => candidate.layoutBaseY !== 0)
  assert.ok(glyph)
  const previousWideDisplacement = Math.abs(glyph.layoutBaseY) * 0.25

  runMovementSystem(world, 600)

  assert.ok(
    Math.abs(glyph.localY - glyph.layoutBaseY) > previousWideDisplacement,
  )
})

test('applies real Slime displacement to a surviving hit glyph and springs it back', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'slime-material',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
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
  const weapon = world.weaponLoadout.equipped[0]
  spawnProjectile(world, {
    sourceWeaponInstanceId: weapon.id,
    x: getGlyphWorldX(slime.x, glyph),
    y: getGlyphWorldY(slime.y, glyph),
    directionX: 1,
    directionY: 0,
    profile: weapon.resolvedProfile,
    targetEnemyId: slime.id,
  })
  runEnemySpatialIndexSystem(world)
  runCollisionSystem(world)
  runDamageSystem(world)

  assert.equal(glyph.currentDurability, 1)
  assert.equal(glyph.state, GLYPH_CELL_STATE.DAMAGED)
  assert.ok(glyph.velocityX > 0)

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)
  assert.equal(snapshot.effects.length, 5)

  runGlyphMaterialSystem(world, 100)
  const displacedOffsetX = glyph.offsetX
  assert.ok(displacedOffsetX > 0)

  for (let step = 0; step < 120; step += 1) {
    runGlyphMaterialSystem(world, 1_000 / 60)
  }

  assert.ok(Math.abs(glyph.offsetX) < displacedOffsetX)
  writeRenderSnapshot(world, snapshot, 1)
  assert.equal(snapshot.effects.length, 0)
})

test('caps simultaneous ASCII impact particles under large area hits', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'slime-impact-cap',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const slime = spawnEnemy(world, 2_000, 2_000, 0, content.slimeBossDefinition)
  slime.phase = 'ACTIVE'

  for (const glyph of world.glyphStore.getOwnerGlyphs(slime.id)) {
    world.glyphStore.applyMaterialHit(
      glyph.id,
      1,
      0,
      getGlyphMaterialDefinition(glyph.material),
    )
  }

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)

  assert.equal(snapshot.effects.length, 192)
})

test('keeps Slime eyes yellow across durability damage and hit flash', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'slime-yellow-eyes',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const slime = spawnEnemy(world, 2_000, 2_000, 0, content.slimeBossDefinition)
  slime.phase = 'ACTIVE'
  const eye = world.glyphStore
    .getOwnerGlyphs(slime.id)
    .find((glyph) => glyph.role === 'EYE')
  assert.ok(eye)
  assert.equal(eye.baseTint, 0xf4d35e)

  world.glyphDamageQueue.enqueue({
    ownerId: slime.id,
    shapeX: getGlyphWorldX(slime.x, eye),
    shapeY: getGlyphWorldY(slime.y, eye),
    shapeRadius: 0,
    targetMode: DAMAGE_TARGET_MODE.SINGLE,
    amount: 1,
    impactDirectionX: 1,
    impactDirectionY: 0,
  })
  runDamageSystem(world)

  assert.equal(eye.tint, 0xb7e4c7)
  runGlyphMaterialSystem(
    world,
    getGlyphMaterialDefinition(eye.material).hitFlashDurationMs,
  )
  assert.equal(eye.baseTint, 0xd4a72c)
  assert.equal(eye.tint, 0xd4a72c)
})

test('spawns exactly one Slime boss from the first successful Z wave', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'slime-first-wave',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  world.spawnCooldownMs = 0
  runEnemySpatialIndexSystem(world)

  runDirectorSystem(world, 1_000 / 60)
  runBossSpawnSystem(world)
  runBossSpawnSystem(world)

  assert.equal(
    world.enemies.filter(
      (enemy) => enemy.definitionId === 'enemy.zombie',
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
