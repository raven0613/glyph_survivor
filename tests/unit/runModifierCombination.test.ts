import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { RUN_MODIFIER_EFFECT_STRATEGY } from '../../src/game/content/modifiers/runModifierDefinition.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { GLYPH_STATUS_FLAG, hasGlyphStatus } from '../../src/game/glyph/glyphStatus.ts'
import {
  createWorldState,
  spawnEnemy,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import {
  DAMAGE_APPLICATION_ROUTE,
  applyDamageApplication,
  completeDirectDamageBatch,
  prepareDirectDamageBatch,
} from '../../src/game/systems/damageApplication.ts'
import { runVolatileReactionSystem } from '../../src/game/systems/volatileReactionSystem.ts'

function createCombinedModifierWorld(): WorldState {
  const content = prepareGameContent()
  const world = createWorldState(
    'all-run-modifiers',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const volatile = content.runModifierDefinitions.find(
    ({ effectStrategyId }) =>
      effectStrategyId === RUN_MODIFIER_EFFECT_STRATEGY.VOLATILE,
  )
  const disconnected = content.runModifierDefinitions.find(
    ({ effectStrategyId }) =>
      effectStrategyId === RUN_MODIFIER_EFFECT_STRATEGY.DISCONNECTED,
  )
  const overload = content.runModifierDefinitions.find(
    ({ effectStrategyId }) =>
      effectStrategyId === RUN_MODIFIER_EFFECT_STRATEGY.OVERLOAD,
  )
  assert.ok(
    volatile?.effectStrategyId === RUN_MODIFIER_EFFECT_STRATEGY.VOLATILE,
  )
  assert.ok(
    disconnected?.effectStrategyId ===
      RUN_MODIFIER_EFFECT_STRATEGY.DISCONNECTED,
  )
  assert.ok(
    overload?.effectStrategyId === RUN_MODIFIER_EFFECT_STRATEGY.OVERLOAD,
  )
  world.runModifierState.ownedDefinitionIds.add(volatile.id)
  world.runModifierState.ownedDefinitionIds.add(disconnected.id)
  world.runModifierState.ownedDefinitionIds.add(overload.id)
  world.runModifierState.resolvedProfile = Object.freeze({
    volatile: volatile.volatile,
    disconnected: disconnected.disconnected,
    overload: overload.overload,
  })
  return world
}

test('composes all three Modifiers once and prevents VOLATILE from feeding bonuses back', () => {
  const world = createCombinedModifierWorld()
  const bat = spawnEnemy(
    world,
    world.player.x,
    world.player.y,
    0,
    world.content.ordinaryEnemyDefinitions[2],
  )
  bat.phase = 'ACTIVE'
  const [left, target, right] = world.glyphStore.getOwnerGlyphs(bat.id)
  assert.equal(world.glyphStore.applyCracked(target.id, 1), true)
  assert.equal(world.glyphStore.applyDisconnectedLatch(target.id, 1.6, 1), true)
  const batch = prepareDirectDamageBatch(world, 2, [target.id])

  const outcome = applyDamageApplication(
    world,
    {
      rootAttackEventId: 2,
      reactionChainId: null,
      route: DAMAGE_APPLICATION_ROUTE.DIRECT_LOCAL,
      sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
      targetGlyphId: target.id,
      baseDamage: 0.5,
      impactDirectionX: 1,
      impactDirectionY: 0,
    },
    batch,
  )
  completeDirectDamageBatch(world, batch)

  assert.ok(Math.abs(outcome.disconnectedBonusDamage - 0.3) < 1e-12)
  assert.ok(Math.abs(outcome.crackBonusDamage - 0.2) < 1e-12)
  assert.equal(outcome.resolvedEffectiveDamage, 1)
  assert.equal(outcome.enteredHusk, true)
  assert.equal(world.diagnostics.overloadTriggerCount, 1)
  assert.equal(world.diagnostics.crackConsumptionCount, 1)
  assert.equal(world.volatileState.activeChains.length, 1)
  assert.equal(hasGlyphStatus(left, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(hasGlyphStatus(right, GLYPH_STATUS_FLAG.CRACKED), true)

  runVolatileReactionSystem(world)

  assert.equal(left.currentDurability, 0.65)
  assert.equal(right.currentDurability, 0.65)
  assert.equal(hasGlyphStatus(left, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(hasGlyphStatus(right, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(world.diagnostics.overloadThresholdEvaluationCount, 1)
  assert.equal(world.diagnostics.overloadTriggerCount, 1)
  assert.equal(world.diagnostics.crackConsumptionCount, 1)
  assert.equal(world.diagnostics.volatileSecondaryAppliedCount, 2)
  assert.ok(
    Math.abs(world.diagnostics.runModifierDamageActualDelta - 1.2) < 1e-12,
  )
})
