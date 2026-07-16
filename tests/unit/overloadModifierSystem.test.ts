import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { RUN_MODIFIER_DEFINITION_ID } from '../../src/game/content/modifiers/prototypeRunModifiers.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { PLAYER_ATTACK_VISUAL_ROLE } from '../../src/game/content/visuals/combatVisualTheme.ts'
import { GLYPH_STATUS_FLAG, hasGlyphStatus } from '../../src/game/glyph/glyphStatus.ts'
import {
  DAMAGE_FRONTIER_TRAVERSAL,
  DAMAGE_TARGET_MODE,
  type DamageTransferReservation,
} from '../../src/game/glyph/localDamage.ts'
import {
  createWorldState,
  spawnEnemy,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import {
  DAMAGE_APPLICATION_ROUTE,
  applyDamageApplication,
} from '../../src/game/systems/damageApplication.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runModifierPresentationSystem } from '../../src/game/systems/modifierPresentationSystem.ts'
import {
  runPendingDamageTransferSystem,
  schedulePendingDamageTransfer,
} from '../../src/game/systems/pendingDamageTransferSystem.ts'
import { createRunStartTestModifierOfferIfEnabled } from '../../src/game/systems/runModifierOffer.ts'
import { selectRunModifierFromOffer } from '../../src/game/systems/runModifierTransaction.ts'

function createOverloadWorld(seed: string): WorldState {
  const content = prepareGameContent()
  const world = createWorldState(
    seed,
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const offer = createRunStartTestModifierOfferIfEnabled(
    content.runModifierDefinitions,
    world.runModifierState,
    true,
  )
  assert.ok(offer)
  const overloadChoice = offer.choices.find(
    ({ definitionId }) =>
      definitionId === RUN_MODIFIER_DEFINITION_ID.OVERLOAD,
  )
  assert.ok(overloadChoice)
  const selection = selectRunModifierFromOffer(
    content.runModifierDefinitions,
    world.runModifierState,
    { offerId: offer.id, choiceId: overloadChoice.id },
  )
  assert.equal(selection.ok, true)
  assert.ok(world.runModifierState.resolvedProfile.overload)
  return world
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
  runEnemySpatialIndexSystem(world)
  return bat
}

function enqueueDirectAttack(
  world: WorldState,
  ownerId: number,
  attackEventId: number,
  x: number,
  y: number,
  amount: number,
  targetMode: 'SINGLE' | 'AREA' = DAMAGE_TARGET_MODE.SINGLE,
  radius = 5,
): void {
  world.glyphDamageQueue.enqueue({
    attackEventId,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
    primaryScope: 'LOCKED_OWNER',
    ownerId,
    shapeKind: 'CIRCLE',
    shapeX: x,
    shapeY: y,
    shapeRadius: radius,
    shapeDirectionX: 0,
    shapeDirectionY: 0,
    shapeRange: 0,
    shapeHalfAngleRadians: 0,
    targetMode,
    amount,
    damageSpreadProfile: null,
    impactStrengthMultiplier: 1,
    impactDirectionX: 1,
    impactDirectionY: 1,
    frontierTraversal: {
      kind: DAMAGE_FRONTIER_TRAVERSAL.FIXED_DIRECTION,
      directionX: 1,
      directionY: 0,
    },
  })
}

test('triggers from final direct damage divided by maximum durability, not remaining durability', () => {
  const belowThresholdWorld = createOverloadWorld('overload-max-durability')
  const belowThresholdBat = spawnActiveBat(belowThresholdWorld)
  const [, sourceBelowThreshold, neighborBelowThreshold] =
    belowThresholdWorld.glyphStore.getOwnerGlyphs(belowThresholdBat.id)
  belowThresholdWorld.glyphStore.applyDamage(sourceBelowThreshold.id, 0.5)
  enqueueDirectAttack(
    belowThresholdWorld,
    belowThresholdBat.id,
    1,
    belowThresholdBat.x + sourceBelowThreshold.localX,
    belowThresholdBat.y + sourceBelowThreshold.localY,
    0.59,
  )

  runDamageSystem(belowThresholdWorld)

  assert.equal(sourceBelowThreshold.currentDurability, 0)
  assert.equal(
    hasGlyphStatus(neighborBelowThreshold, GLYPH_STATUS_FLAG.CRACKED),
    false,
  )
  assert.equal(belowThresholdWorld.diagnostics.overloadTriggerCount, 0)

  const thresholdWorld = createOverloadWorld('overload-at-threshold')
  const thresholdBat = spawnActiveBat(thresholdWorld)
  const [, sourceAtThreshold, neighborAtThreshold] =
    thresholdWorld.glyphStore.getOwnerGlyphs(thresholdBat.id)
  enqueueDirectAttack(
    thresholdWorld,
    thresholdBat.id,
    1,
    thresholdBat.x + sourceAtThreshold.localX,
    thresholdBat.y + sourceAtThreshold.localY,
    0.6,
  )

  runDamageSystem(thresholdWorld)

  assert.equal(
    hasGlyphStatus(neighborAtThreshold, GLYPH_STATUS_FLAG.CRACKED),
    true,
  )
  assert.equal(thresholdWorld.diagnostics.overloadTriggerCount, 1)
})

test('adds one non-damaging Crack to each living canonical neighbor after the direct batch', () => {
  const world = createOverloadWorld('overload-crack-neighbors')
  const bat = spawnActiveBat(world)
  const [left, middle, right] = world.glyphStore.getOwnerGlyphs(bat.id)
  enqueueDirectAttack(
    world,
    bat.id,
    11,
    bat.x + middle.localX,
    bat.y + middle.localY,
    0.6,
  )

  runDamageSystem(world)

  assert.equal(middle.currentDurability, 0.4)
  assert.equal(left.currentDurability, 1)
  assert.equal(right.currentDurability, 1)
  assert.equal(hasGlyphStatus(left, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(hasGlyphStatus(right, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(left.crackedCreatedByRootAttackEventId, 11)
  assert.equal(right.crackedCreatedByRootAttackEventId, 11)
  assert.equal(world.diagnostics.crackApplicationCount, 2)
})

test('consumes an existing Crack once on the next successful different direct event', () => {
  const world = createOverloadWorld('overload-crack-consumption')
  const bat = spawnActiveBat(world)
  const [left, middle] = world.glyphStore.getOwnerGlyphs(bat.id)
  enqueueDirectAttack(
    world,
    bat.id,
    1,
    bat.x + middle.localX,
    bat.y + middle.localY,
    0.6,
  )
  runDamageSystem(world)

  enqueueDirectAttack(
    world,
    bat.id,
    2,
    bat.x + left.localX,
    bat.y + left.localY,
    0.25,
  )
  runDamageSystem(world)

  assert.equal(left.currentDurability, 0.65)
  assert.equal(hasGlyphStatus(left, GLYPH_STATUS_FLAG.CRACKED), false)
  assert.equal(world.diagnostics.crackConsumptionCount, 1)

  enqueueDirectAttack(
    world,
    bat.id,
    3,
    bat.x + left.localX,
    bat.y + left.localY,
    0.25,
  )
  runDamageSystem(world)

  assert.equal(left.currentDurability, 0.4)
  assert.equal(world.diagnostics.crackConsumptionCount, 1)
})

test('does not let a later transfer arrival consume a Crack created by the same root event', () => {
  const world = createOverloadWorld('overload-same-root-transfer')
  const bat = spawnActiveBat(world)
  const [left, middle] = world.glyphStore.getOwnerGlyphs(bat.id)
  enqueueDirectAttack(
    world,
    bat.id,
    1,
    bat.x + middle.localX,
    bat.y + middle.localY,
    0.6,
  )
  runDamageSystem(world)
  assert.equal(hasGlyphStatus(left, GLYPH_STATUS_FLAG.CRACKED), true)

  const reservation: DamageTransferReservation = {
    attackEventId: 1,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
    ownerId: bat.id,
    sourceGlyphId: middle.id,
    targetGlyphId: left.id,
    pathGlyphIds: [middle.id, left.id],
    sourceFlashDurationMs: 1,
    impactDirectionX: 1,
    impactDirectionY: 0,
  }
  schedulePendingDamageTransfer(world, reservation, 0.25)

  runPendingDamageTransferSystem(world, 1)

  assert.equal(left.currentDurability, 0.75)
  assert.equal(hasGlyphStatus(left, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(world.diagnostics.crackConsumptionCount, 0)
})

test('allows a heavy transfer arrival to trigger OVERLOAD', () => {
  const world = createOverloadWorld('overload-transfer-trigger')
  const bat = spawnActiveBat(world)
  const [left, middle, right] = world.glyphStore.getOwnerGlyphs(bat.id)
  const reservation: DamageTransferReservation = {
    attackEventId: 1,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
    ownerId: bat.id,
    sourceGlyphId: left.id,
    targetGlyphId: middle.id,
    pathGlyphIds: [left.id, middle.id],
    sourceFlashDurationMs: 1,
    impactDirectionX: 1,
    impactDirectionY: 0,
  }
  schedulePendingDamageTransfer(world, reservation, 0.6)

  runPendingDamageTransferSystem(world, 1)

  assert.equal(middle.currentDurability, 0.4)
  assert.equal(hasGlyphStatus(left, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(hasGlyphStatus(right, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(world.diagnostics.overloadTriggerCount, 1)
})

test('uses Crack-amplified final direct damage for the OVERLOAD threshold', () => {
  const world = createOverloadWorld('overload-crack-lifts-threshold')
  const bat = spawnActiveBat(world)
  const [left, middle, right] = world.glyphStore.getOwnerGlyphs(bat.id)
  assert.equal(world.glyphStore.applyCracked(middle.id, 1), true)
  enqueueDirectAttack(
    world,
    bat.id,
    2,
    bat.x + middle.localX,
    bat.y + middle.localY,
    0.5,
  )

  runDamageSystem(world)

  assert.ok(Math.abs(middle.currentDurability - 0.3) < 1e-9)
  assert.equal(hasGlyphStatus(middle, GLYPH_STATUS_FLAG.CRACKED), false)
  assert.equal(hasGlyphStatus(left, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(hasGlyphStatus(right, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(world.diagnostics.overloadTriggerCount, 1)
})

test('cracks surviving neighbors when the OVERLOAD source becomes HUSK', () => {
  const world = createOverloadWorld('overload-husk-source')
  const bat = spawnActiveBat(world)
  const [left, middle, right] = world.glyphStore.getOwnerGlyphs(bat.id)
  enqueueDirectAttack(
    world,
    bat.id,
    1,
    bat.x + middle.localX,
    bat.y + middle.localY,
    1,
  )

  runDamageSystem(world)

  assert.equal(middle.state, 'HUSK')
  assert.equal(hasGlyphStatus(left, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(hasGlyphStatus(right, GLYPH_STATUS_FLAG.CRACKED), true)
})

test('deduplicates simultaneous Overload sources that point to the same Cell', () => {
  const world = createOverloadWorld('overload-dedup')
  const bat = spawnActiveBat(world)
  const [, middle] = world.glyphStore.getOwnerGlyphs(bat.id)
  enqueueDirectAttack(
    world,
    bat.id,
    1,
    bat.x + middle.localX,
    bat.y + middle.localY,
    0.6,
    DAMAGE_TARGET_MODE.AREA,
    40,
  )

  runDamageSystem(world)

  const crackedGlyphs = world.glyphStore
    .getOwnerGlyphs(bat.id)
    .filter((glyph) => hasGlyphStatus(glyph, GLYPH_STATUS_FLAG.CRACKED))
  assert.equal(crackedGlyphs.length, 3)
  assert.equal(world.diagnostics.crackApplicationCount, 3)
  assert.equal(world.diagnostics.crackApplicationDedupCount, 1)
})

test('Spread neither consumes Crack nor triggers OVERLOAD', () => {
  const world = createOverloadWorld('overload-spread-exclusion')
  const bat = spawnActiveBat(world)
  const [target] = world.glyphStore.getOwnerGlyphs(bat.id)
  assert.equal(world.glyphStore.applyCracked(target.id, 1), true)

  const outcome = applyDamageApplication(world, {
    rootAttackEventId: 2,
    reactionChainId: null,
    route: DAMAGE_APPLICATION_ROUTE.DAMAGE_SPREAD,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    targetGlyphId: target.id,
    baseDamage: 0.2,
    impactDirectionX: 1,
    impactDirectionY: 0,
  })

  assert.equal(outcome.resolvedEffectiveDamage, 0.2)
  assert.ok(
    Math.abs(outcome.actualAppliedDurabilityDelta - 0.2) < 0.000_000_1,
  )
  assert.equal(hasGlyphStatus(target, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(world.diagnostics.crackConsumptionCount, 0)
  assert.equal(world.diagnostics.overloadThresholdEvaluationCount, 0)
})

test('publishes directional compression, radial punctuation, and persistent cracked surfaces', () => {
  const world = createOverloadWorld('overload-presentation')
  const bat = spawnActiveBat(world)
  const [, middle] = world.glyphStore.getOwnerGlyphs(bat.id)
  enqueueDirectAttack(
    world,
    bat.id,
    1,
    bat.x + middle.localX,
    bat.y + middle.localY,
    0.6,
  )
  runDamageSystem(world)

  const timing =
    world.content.combatVisualTheme.effects.runModifiers.overload.compression
  runModifierPresentationSystem(world, timing.attackDurationMs)
  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)

  assert.equal(snapshot.overloadDeformations.length, 1)
  const deformation = snapshot.overloadDeformations[0]
  assert.ok(Math.abs(deformation.axisX - Math.SQRT1_2) < 0.0001)
  assert.ok(Math.abs(deformation.axisY - Math.SQRT1_2) < 0.0001)
  assert.ok(deformation.parallelScale < deformation.perpendicularScale)
  assert.equal(snapshot.crackedSurfaces.length, 2)
  assert.equal(
    snapshot.overloadShockwaves.length,
    world.content.combatVisualTheme.effects.runModifiers.overload.shockwave
      .particleCount,
  )
  assert.equal(
    snapshot.enemies.find(({ id }) => id === middle.id)?.alpha,
    0,
  )

  runModifierPresentationSystem(
    world,
    timing.holdDurationMs + timing.settleDurationMs,
  )
  writeRenderSnapshot(world, snapshot, 1)
  assert.equal(snapshot.overloadDeformations.length, 0)
  assert.equal(snapshot.overloadShockwaves.length, 0)
  assert.equal(snapshot.crackedSurfaces.length, 2)
  assert.ok(
    (snapshot.enemies.find(({ id }) => id === middle.id)?.alpha ?? 0) > 0,
  )
})
