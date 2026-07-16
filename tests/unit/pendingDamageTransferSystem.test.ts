import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { PLAYER_ATTACK_VISUAL_ROLE } from '../../src/game/content/visuals/combatVisualTheme.ts'
import { getGlyphMaterialDefinition } from '../../src/game/glyph/glyphMaterial.ts'
import {
  DAMAGE_FRONTIER_TRAVERSAL,
  DAMAGE_TARGET_MODE,
} from '../../src/game/glyph/localDamage.ts'
import {
  createWorldState,
  spawnEnemy,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import {
  beginWorldDeathReview,
  runDeathReviewStep,
} from '../../src/game/runtime/runDeathReviewStep.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runPendingDamageTransferSystem } from '../../src/game/systems/pendingDamageTransferSystem.ts'

function createTransferWorld(): WorldState {
  return createWorldState(
    'pending-damage-transfer',
    800,
    600,
    prepareGameContent(),
    BASIC_PROJECTILE_WEAPON_ID,
  )
}

function spawnActiveBat(world: WorldState) {
  const bat = spawnEnemy(
    world,
    world.player.x,
    world.player.y,
    0,
    world.content.ordinaryEnemyDefinitions[2],
  )
  bat.phase = 'ACTIVE'
  return bat
}

function enqueueHuskImpact(
  world: WorldState,
  ownerId: number,
  sourceX: number,
  sourceY: number,
  damageSpreadProfile: { readonly bandWidth: number; readonly bandDamageRatios: readonly number[] } | null = null,
): void {
  world.glyphDamageQueue.enqueue({
    attackEventId: 1,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
    primaryScope: 'LOCKED_OWNER',
    ownerId,
    shapeKind: 'CIRCLE',
    shapeX: sourceX,
    shapeY: sourceY,
    shapeRadius: 7,
    shapeDirectionX: 0,
    shapeDirectionY: 0,
    shapeRange: 0,
    shapeHalfAngleRadians: 0,
    targetMode: DAMAGE_TARGET_MODE.SINGLE,
    amount: 1,
    damageSpreadProfile,
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

test('pulses a frozen path in order and commits reserved damage only at arrival', () => {
  const world = createTransferWorld()
  const bat = spawnActiveBat(world)
  const [source, middle, target] = world.glyphStore.getOwnerGlyphs(bat.id)
  world.glyphStore.applyDamage(source.id, 1)
  world.glyphStore.applyDamage(middle.id, 1)
  runEnemySpatialIndexSystem(world)
  enqueueHuskImpact(
    world,
    bat.id,
    bat.x + source.localX,
    bat.y + source.localY,
  )

  runDamageSystem(world)

  assert.equal(target.currentDurability, 1)
  assert.equal(target.hitFlashRemainingMs, 0)
  assert.equal(world.pendingDamageTransfers.length, 1)
  assert.deepEqual(world.pendingDamageTransfers[0].pathGlyphIds, [
    source.id,
    middle.id,
    target.id,
  ])
  assert.equal(world.pendingDamageTransfers[0].attackEventId, 1)
  assert.equal(world.pendingDamageTransfers[0].targetGlyphId, target.id)
  assert.equal(world.topologyTransferPulses.length, 0)
  assert.equal(
    world.runStatistics.weaponByInstanceId.get(
      world.weaponLoadout.equipped[0].id,
    )?.totalDamage,
    0,
  )

  const sourceFlashDurationMs = getGlyphMaterialDefinition(
    source.material,
  ).hitFlashDurationMs
  runPendingDamageTransferSystem(world, sourceFlashDurationMs - 1)
  assert.equal(world.topologyTransferPulses.length, 0)
  assert.equal(target.currentDurability, 1)

  runPendingDamageTransferSystem(world, 1)
  assert.deepEqual(
    world.topologyTransferPulses.map((pulse) => pulse.glyphId),
    [middle.id],
  )
  assert.equal(world.pendingDamageTransfers[0].nextPathIndex, 2)
  assert.equal(target.currentDurability, 1)

  const middlePulseSnapshot = createRenderSnapshot()
  writeRenderSnapshot(world, middlePulseSnapshot, 1)
  assert.equal(middlePulseSnapshot.topologyTransferPulses.length, 1)
  assert.deepEqual(middlePulseSnapshot.topologyTransferPulses[0], {
    id: world.topologyTransferPulses[0].id,
    glyphFrame: middle.glyphFrame,
    x: bat.x + middle.localX,
    y: bat.y + middle.localY,
    rotation: middle.rotation,
    scale: middle.scale,
    alpha: world.content.combatVisualTheme.effects.topologyTransfer.alpha,
    tint: world.content.combatVisualTheme.effects.topologyTransfer.tint,
  })

  const stepIntervalMs =
    world.content.combatVisualTheme.effects.topologyTransfer.stepIntervalMs
  runPendingDamageTransferSystem(world, stepIntervalMs - 1)
  assert.equal(target.currentDurability, 1)
  assert.equal(target.hitFlashRemainingMs, 0)

  runPendingDamageTransferSystem(world, 1)

  assert.equal(target.currentDurability, 0)
  assert.equal(target.hitFlashRemainingMs, 0)
  assert.deepEqual(
    world.topologyTransferPulses.map((pulse) => pulse.glyphId),
    [middle.id, target.id],
  )
  assert.equal(world.pendingDamageTransfers.length, 0)
  assert.equal(world.diagnostics.pendingTransferArrivalCommitCount, 1)
  assert.equal(world.diagnostics.activePendingTransferCount, 0)
  assert.equal(world.diagnostics.retainedPendingTransferPathCellCount, 0)
  assert.equal(world.topologyDirtyOwnerIds.has(bat.id), true)
  assert.equal(
    world.runStatistics.weaponByInstanceId.get(
      world.weaponLoadout.equipped[0].id,
    )?.totalDamage,
    1,
  )

  const arrivalSnapshot = createRenderSnapshot()
  writeRenderSnapshot(world, arrivalSnapshot, 1)
  assert.deepEqual(
    arrivalSnapshot.topologyTransferPulses.map(({ glyphFrame }) => glyphFrame),
    [middle.glyphFrame, target.glyphFrame],
  )
})

test('cancels an invalid target at arrival without retargeting another cell', () => {
  const world = createTransferWorld()
  const bat = spawnActiveBat(world)
  const [source, target, untouched] = world.glyphStore.getOwnerGlyphs(bat.id)
  world.glyphStore.applyDamage(source.id, 1)
  runEnemySpatialIndexSystem(world)
  enqueueHuskImpact(
    world,
    bat.id,
    bat.x + source.localX,
    bat.y + source.localY,
  )
  runDamageSystem(world)
  world.glyphStore.applyDamage(target.id, 1)

  runPendingDamageTransferSystem(
    world,
    getGlyphMaterialDefinition(source.material).hitFlashDurationMs,
  )

  assert.equal(target.currentDurability, 0)
  assert.equal(untouched.currentDurability, 1)
  assert.equal(world.pendingDamageTransfers.length, 0)
  assert.equal(world.diagnostics.pendingTransferArrivalCommitCount, 0)
  assert.equal(world.diagnostics.pendingTransferInvalidTargetCancellationCount, 1)
  assert.equal(
    world.runStatistics.weaponByInstanceId.get(
      world.weaponLoadout.equipped[0].id,
    )?.totalDamage,
    0,
  )
})

test('reserves remote direct damage so a lower spread claim cannot apply early', () => {
  const world = createTransferWorld()
  const bat = spawnActiveBat(world)
  const [source, target] = world.glyphStore.getOwnerGlyphs(bat.id)
  world.glyphStore.applyDamage(source.id, 1)
  runEnemySpatialIndexSystem(world)
  enqueueHuskImpact(
    world,
    bat.id,
    bat.x + source.localX,
    bat.y + source.localY,
    { bandWidth: 24, bandDamageRatios: [0.2] },
  )

  runDamageSystem(world)

  assert.equal(target.currentDurability, 1)
  assert.equal(target.spreadFlashRemainingMs, 0)
  assert.equal(world.pendingDamageTransfers.length, 1)
  assert.equal(
    world.runStatistics.weaponByInstanceId.get(
      world.weaponLoadout.equipped[0].id,
    )?.totalDamage,
    0,
  )
})

test('keeps pending transfer progress frozen during death review', () => {
  const world = createTransferWorld()
  const bat = spawnActiveBat(world)
  const [source, target] = world.glyphStore.getOwnerGlyphs(bat.id)
  world.glyphStore.applyDamage(source.id, 1)
  runEnemySpatialIndexSystem(world)
  enqueueHuskImpact(
    world,
    bat.id,
    bat.x + source.localX,
    bat.y + source.localY,
  )
  runDamageSystem(world)
  const remainingBeforePause =
    world.pendingDamageTransfers[0].remainingToNextPulseMs
  assert.equal(beginWorldDeathReview(world), true)

  runDeathReviewStep(world, 500)

  assert.equal(target.currentDurability, 1)
  assert.equal(
    world.pendingDamageTransfers[0].remainingToNextPulseMs,
    remainingBeforePause,
  )
  assert.equal(world.topologyTransferPulses.length, 0)
})
