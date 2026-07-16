import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import {
  PLAYER_ATTACK_VISUAL_ROLE,
  type PlayerAttackVisualRoleId,
} from '../../src/game/content/visuals/combatVisualTheme.ts'
import {
  DAMAGE_FRONTIER_TRAVERSAL,
  DAMAGE_TARGET_MODE,
} from '../../src/game/glyph/localDamage.ts'
import { createWorldState, spawnEnemy } from '../../src/game/runtime/worldState.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runPendingDamageTransferSystem } from '../../src/game/systems/pendingDamageTransferSystem.ts'
import { getGlyphMaterialDefinition } from '../../src/game/glyph/glyphMaterial.ts'
import { runGlyphMaterialSystem } from '../../src/game/systems/glyphMaterialSystem.ts'

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
    readonly visualRoleId?: PlayerAttackVisualRoleId
  },
): void {
  world.glyphDamageQueue.enqueue({
    attackEventId: options.attackEventId,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    visualRoleId:
      options.visualRoleId ??
      PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
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
    frontierTraversal: {
      kind: DAMAGE_FRONTIER_TRAVERSAL.FIXED_DIRECTION,
      directionX: 1,
      directionY: 0,
    },
  })
}

test('damages living spread targets and follows the latest successful attack role', () => {
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
  assert.equal(
    spreadGlyph.spreadFeedbackVisualRoleId,
    PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
  )
  assert.equal(spreadGlyph.velocityX, 0)
  assert.equal(spreadGlyph.velocityY, 0)
  assert.equal(
    world.runStatistics.weaponByInstanceId.get(
      world.weaponLoadout.equipped[0].id,
    )?.totalDamage,
    1.2,
  )

  runGlyphMaterialSystem(world, 50)
  enqueueCircleAttack(world, {
    attackEventId: 2,
    ownerId: primary.id,
    x,
    y,
    visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.FLAMETHROWER,
  })
  runDamageSystem(world)

  assert.equal(spreadGlyph.currentDurability, 0.6)
  assert.equal(
    spreadGlyph.spreadFlashRemainingMs,
    world.content.combatVisualTheme.effects.spreadFeedbackDurationMs,
  )
  assert.equal(
    spreadGlyph.spreadFeedbackVisualRoleId,
    PLAYER_ATTACK_VISUAL_ROLE.FLAMETHROWER,
  )
  assert.equal(
    world.runStatistics.weaponByInstanceId.get(
      world.weaponLoadout.equipped[0].id,
    )?.totalDamage,
    1.4,
  )

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)
  assert.equal(
    snapshot.enemies.find(({ id }) => id === spreadGlyph.id)?.tint,
    world.content.combatVisualTheme.playerAttacks.FLAMETHROWER.accent.tint,
  )

  runGlyphMaterialSystem(
    world,
    world.content.combatVisualTheme.effects.spreadFeedbackDurationMs,
  )
  assert.equal(spreadGlyph.spreadFlashRemainingMs, 0)
  assert.equal(spreadGlyph.spreadFeedbackVisualRoleId, null)
})

test('reserves full direct topology damage until the transfer arrives', () => {
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
    attackEventId: 3,
    ownerId: bat.id,
    x: bat.x + glyphs[0].localX,
    y: bat.y + glyphs[0].localY,
    bandWidth: 1,
  })
  runDamageSystem(world)

  assert.equal(glyphs[1].currentDurability, 1)
  assert.equal(glyphs[2].currentDurability, 1)
  assert.equal(world.pendingDamageTransfers.length, 1)
  assert.equal('damageTransferLinks' in world, false)
  assert.equal(
    world.runStatistics.weaponByInstanceId.get(
      world.weaponLoadout.equipped[0].id,
    )?.totalDamage,
    0,
  )

  runPendingDamageTransferSystem(
    world,
    getGlyphMaterialDefinition(glyphs[0].material).hitFlashDurationMs,
  )

  assert.equal(glyphs[1].currentDurability, 0)
  assert.equal(world.pendingDamageTransfers.length, 0)
  assert.equal(
    world.runStatistics.weaponByInstanceId.get(
      world.weaponLoadout.equipped[0].id,
    )?.totalDamage,
    1,
  )

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)
  assert.equal(snapshot.topologyTransferPulses.length, 1)
  assert.equal('damageTransferLinks' in snapshot, false)
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
