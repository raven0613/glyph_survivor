import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { DAMAGE_TARGET_MODE } from '../../src/game/glyph/localDamage.ts'
import { createWorldState, spawnEnemy } from '../../src/game/runtime/worldState.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runDamagePresentationSystem } from '../../src/game/systems/damagePresentationSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'

function createDamageWorld() {
  return createWorldState(
    'damage-spread-system',
    800,
    600,
    prepareGameContent(),
    BASIC_PROJECTILE_WEAPON_ID,
  )
}

function enqueueCircleAttack(
  world: ReturnType<typeof createDamageWorld>,
  options: {
    readonly attackEventId: number
    readonly ownerId: number
    readonly x: number
    readonly y: number
    readonly bandWidth?: number
  },
): void {
  world.glyphDamageQueue.enqueue({
    attackEventId: options.attackEventId,
    primaryScope: 'LOCKED_OWNER',
    ownerId: options.ownerId,
    shapeKind: 'CIRCLE',
    shapeX: options.x,
    shapeY: options.y,
    shapeRadius: 7,
    shapeDirectionX: 0,
    shapeDirectionY: 0,
    shapeRange: 0,
    shapeHalfAngleRadians: 0,
    targetMode: DAMAGE_TARGET_MODE.SINGLE,
    amount: 1,
    damageSpreadProfile: {
      bandWidth: options.bandWidth ?? 24,
      bandDamageRatios: [0.2],
    },
    impactStrengthMultiplier: 1,
    impactDirectionX: 1,
    impactDirectionY: 0,
  })
}

test('damages every living Glyph in spread bands across owners but excludes Husks', () => {
  const world = createDamageWorld()
  const x = world.player.x
  const y = world.player.y
  const primary = spawnEnemy(world, x, y, 0)
  const spreadTarget = spawnEnemy(world, x + 29, y, 0)
  const spreadHusk = spawnEnemy(world, x, y + 29, 0)
  const outside = spawnEnemy(world, x + 60, y, 0)
  for (const enemy of [primary, spreadTarget, spreadHusk, outside]) {
    enemy.phase = 'ACTIVE'
  }
  const huskGlyph = world.glyphStore.getOwnerGlyphs(spreadHusk.id)[0]
  world.glyphStore.applyDamage(huskGlyph.id, 1)
  runEnemySpatialIndexSystem(world)

  enqueueCircleAttack(world, {
    attackEventId: 1,
    ownerId: primary.id,
    x,
    y,
  })
  runDamageSystem(world)

  assert.equal(world.glyphStore.getOwnerGlyphs(primary.id)[0].currentDurability, 0)
  assert.equal(
    world.glyphStore.getOwnerGlyphs(spreadTarget.id)[0].currentDurability,
    0.8,
  )
  assert.equal(huskGlyph.currentDurability, 0)
  assert.equal(world.glyphStore.getOwnerGlyphs(outside.id)[0].currentDurability, 1)
  const spreadGlyph = world.glyphStore.getOwnerGlyphs(spreadTarget.id)[0]
  assert.ok(spreadGlyph.spreadFlashRemainingMs > 0)
  assert.equal(spreadGlyph.velocityX, 0)
  assert.equal(spreadGlyph.velocityY, 0)
})

test('keeps direct topology damage at full strength and emits a transfer link', () => {
  const world = createDamageWorld()
  const bat = spawnEnemy(
    world,
    world.player.x,
    world.player.y,
    0,
    world.content.ordinaryEnemyDefinitions[2],
  )
  bat.phase = 'ACTIVE'
  const glyphs = world.glyphStore.getOwnerGlyphs(bat.id)
  world.glyphStore.applyDamage(glyphs[0].id, 1)
  runEnemySpatialIndexSystem(world)

  enqueueCircleAttack(world, {
    attackEventId: 2,
    ownerId: bat.id,
    x: bat.x + glyphs[0].localX,
    y: bat.y + glyphs[0].localY,
    bandWidth: 1,
  })
  runDamageSystem(world)

  assert.equal(glyphs[1].currentDurability, 0)
  assert.equal(glyphs[2].currentDurability, 1)
  assert.equal(world.damageTransferLinks.length, 1)
  assert.equal(world.damageTransferLinks[0].sourceGlyphId, glyphs[0].id)
  assert.equal(world.damageTransferLinks[0].targetGlyphId, glyphs[1].id)

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)
  assert.equal(snapshot.damageTransferLinks.length, 1)
  assert.ok(snapshot.damageTransferLinks[0].alpha > 0)

  runDamagePresentationSystem(world, 120)
  assert.equal(world.damageTransferLinks.length, 0)
  assert.equal(world.damageTransferLinkPool.length, 1)
})

test('allows independent attack events to apply their spread once each', () => {
  const world = createDamageWorld()
  const x = world.player.x
  const y = world.player.y
  const primary = spawnEnemy(world, x, y, 0)
  const spreadTarget = spawnEnemy(world, x + 29, y, 0)
  primary.phase = 'ACTIVE'
  spreadTarget.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  enqueueCircleAttack(world, { attackEventId: 3, ownerId: primary.id, x, y })
  enqueueCircleAttack(world, { attackEventId: 4, ownerId: primary.id, x, y })
  runDamageSystem(world)

  assert.equal(
    world.glyphStore.getOwnerGlyphs(spreadTarget.id)[0].currentDurability,
    0.6,
  )
})
