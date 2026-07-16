import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import {
  RUN_MODIFIER_DEFINITION_ID,
} from '../../src/game/content/modifiers/prototypeRunModifiers.ts'
import { RUN_MODIFIER_EFFECT_STRATEGY } from '../../src/game/content/modifiers/runModifierDefinition.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { PLAYER_ATTACK_VISUAL_ROLE } from '../../src/game/content/visuals/combatVisualTheme.ts'
import { GLYPH_STATUS_FLAG, hasGlyphStatus } from '../../src/game/glyph/glyphStatus.ts'
import type { DamageTransferReservation } from '../../src/game/glyph/localDamage.ts'
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
import { createRunStartTestModifierOfferIfEnabled } from '../../src/game/systems/runModifierOffer.ts'
import { selectRunModifierFromOffer } from '../../src/game/systems/runModifierTransaction.ts'
import { runVolatileReactionSystem } from '../../src/game/systems/volatileReactionSystem.ts'
import {
  runPendingDamageTransferSystem,
  schedulePendingDamageTransfer,
} from '../../src/game/systems/pendingDamageTransferSystem.ts'

function createVolatileWorld(seed: string): WorldState {
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
  const choice = offer.choices.find(
    ({ definitionId }) =>
      definitionId === RUN_MODIFIER_DEFINITION_ID.VOLATILE,
  )
  assert.ok(choice)
  assert.equal(
    selectRunModifierFromOffer(
      content.runModifierDefinitions,
      world.runModifierState,
      { offerId: offer.id, choiceId: choice.id },
    ).ok,
    true,
  )
  assert.ok(world.runModifierState.resolvedProfile.volatile)
  return world
}

function spawnActiveBat(world: WorldState, offsetX = 0) {
  const bat = spawnEnemy(
    world,
    world.player.x + offsetX,
    world.player.y,
    0,
    world.content.ordinaryEnemyDefinitions[2],
  )
  bat.phase = 'ACTIVE'
  return bat
}

function applyDirectDamage(
  world: WorldState,
  rootAttackEventId: number,
  targetIds: readonly number[],
  amountById: ReadonlyMap<number, number>,
): void {
  const batch = prepareDirectDamageBatch(world, rootAttackEventId, targetIds)
  for (const targetId of targetIds) {
    applyDamageApplication(
      world,
      {
        rootAttackEventId,
        reactionChainId: null,
        route: DAMAGE_APPLICATION_ROUTE.DIRECT_LOCAL,
        sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
        targetGlyphId: targetId,
        baseDamage: amountById.get(targetId) ?? 1,
        impactDirectionX: 1,
        impactDirectionY: 0,
      },
      batch,
    )
  }
  completeDirectDamageBatch(world, batch)
}

function useResolutionBudget(world: WorldState, budget: number): void {
  const volatile = world.runModifierState.resolvedProfile.volatile
  assert.ok(volatile)
  world.runModifierState.resolvedProfile = Object.freeze({
    ...world.runModifierState.resolvedProfile,
    volatile: Object.freeze({
      ...volatile,
      maxExplosionResolutionsPerFixedStep: budget,
    }),
  })
}

test('damages only same-owner depth-one canonical neighbors', () => {
  const world = createVolatileWorld('volatile-canonical-neighbors')
  const sourceOwner = spawnActiveBat(world)
  const overlappingOwner = spawnActiveBat(world)
  const [left, middle, right] = world.glyphStore.getOwnerGlyphs(sourceOwner.id)
  const diagonal = world.glyphStore.createGlyph({
    ownerId: sourceOwner.id,
    bodySlotId: 3,
    character: 'x',
    glyphFrame: left.glyphFrame,
    baseCharacter: 'x',
    baseGlyphFrame: left.glyphFrame,
    role: left.role,
    topologyX: 2,
    topologyY: 1,
    localX: middle.localX + 24,
    localY: middle.localY + 24,
    maxDurability: 1,
    collisionRadius: left.collisionRadius,
    scale: left.scale,
    material: left.material,
    appearanceProfileId: left.appearanceProfileId,
  })

  applyDirectDamage(world, 1, [middle.id], new Map())
  runVolatileReactionSystem(world)

  assert.equal(left.currentDurability, 0.65)
  assert.equal(right.currentDurability, 0.65)
  assert.equal(diagonal.currentDurability, 1)
  for (const glyph of world.glyphStore.getOwnerGlyphs(overlappingOwner.id)) {
    assert.equal(glyph.currentDurability, 1)
  }
})

test('uses source maximum durability and applies the configured damage cap', () => {
  const world = createVolatileWorld('volatile-damage-formula')
  const bat = spawnActiveBat(world)
  const glyphs = world.glyphStore.getOwnerGlyphs(bat.id)
  const right = glyphs[2]
  const heavySource = world.glyphStore.createGlyph({
    ownerId: bat.id,
    bodySlotId: 3,
    character: 'X',
    glyphFrame: right.glyphFrame,
    baseCharacter: 'X',
    baseGlyphFrame: right.glyphFrame,
    role: right.role,
    topologyX: 3,
    topologyY: 0,
    localX: right.localX + 24,
    localY: right.localY,
    maxDurability: 3,
    collisionRadius: right.collisionRadius,
    scale: right.scale,
    material: right.material,
    appearanceProfileId: right.appearanceProfileId,
  })

  applyDirectDamage(
    world,
    1,
    [heavySource.id],
    new Map([[heavySource.id, 3]]),
  )
  runVolatileReactionSystem(world)

  assert.equal(right.currentDurability, 0.25)
})

test('advances chained explosions in breadth-first waves across fixed steps', () => {
  const world = createVolatileWorld('volatile-bfs-waves')
  const bat = spawnActiveBat(world)
  const [left, middle, right] = world.glyphStore.getOwnerGlyphs(bat.id)
  world.glyphStore.applyDamage(left.id, 0.7)
  world.glyphStore.applyDamage(right.id, 0.7)
  applyDirectDamage(world, 1, [middle.id], new Map())

  runVolatileReactionSystem(world)

  assert.equal(left.state, 'HUSK')
  assert.equal(right.state, 'HUSK')
  assert.equal(world.diagnostics.volatileExplosionResolutionCount, 1)
  assert.equal(world.volatileState.activePresentationEvents.length, 1)
  assert.equal(world.volatileState.activeChains.length, 1)

  runVolatileReactionSystem(world)

  assert.equal(world.diagnostics.volatileExplosionResolutionCount, 3)
  assert.equal(world.volatileState.activePresentationEvents.length, 3)
  assert.equal(world.volatileState.activeChains.length, 0)
})

test('shares one chain for direct and Spread Husk transitions in one root commit', () => {
  const world = createVolatileWorld('volatile-shared-root-chain')
  const bat = spawnActiveBat(world)
  const [left, , right] = world.glyphStore.getOwnerGlyphs(bat.id)
  const batch = prepareDirectDamageBatch(world, 7, [left.id, right.id])
  applyDamageApplication(
    world,
    {
      rootAttackEventId: 7,
      reactionChainId: null,
      route: DAMAGE_APPLICATION_ROUTE.DIRECT_LOCAL,
      sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
      targetGlyphId: left.id,
      baseDamage: 1,
      impactDirectionX: 1,
      impactDirectionY: 0,
    },
    batch,
  )
  applyDamageApplication(
    world,
    {
      rootAttackEventId: 7,
      reactionChainId: null,
      route: DAMAGE_APPLICATION_ROUTE.DAMAGE_SPREAD,
      sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
      targetGlyphId: right.id,
      baseDamage: 1,
      impactDirectionX: 1,
      impactDirectionY: 0,
    },
    batch,
  )
  completeDirectDamageBatch(world, batch)

  assert.equal(world.volatileState.activeChains.length, 1)
  assert.deepEqual(
    world.volatileState.activeChains[0].currentWave.map(
      ({ sourceGlyphId }) => sourceGlyphId,
    ),
    [left.id, right.id],
  )
})

test('creates a separate reaction chain when topology-transfer damage arrives', () => {
  const world = createVolatileWorld('volatile-transfer-chain')
  const bat = spawnActiveBat(world)
  const [left, middle] = world.glyphStore.getOwnerGlyphs(bat.id)
  applyDirectDamage(world, 11, [middle.id], new Map())
  const reservation: DamageTransferReservation = {
    attackEventId: 11,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
    ownerId: bat.id,
    sourceGlyphId: middle.id,
    targetGlyphId: left.id,
    pathGlyphIds: [middle.id, left.id],
    sourceFlashDurationMs: 1,
    impactDirectionX: -1,
    impactDirectionY: 0,
  }
  schedulePendingDamageTransfer(world, reservation, 1)

  runPendingDamageTransferSystem(world, 1)

  assert.equal(world.volatileState.activeChains.length, 2)
  assert.notEqual(
    world.volatileState.activeChains[0].id,
    world.volatileState.activeChains[1].id,
  )
})

test('retains unresolved events when the fixed-step budget is exhausted', () => {
  const world = createVolatileWorld('volatile-budget-retention')
  useResolutionBudget(world, 1)
  const bat = spawnActiveBat(world)
  const glyphs = world.glyphStore.getOwnerGlyphs(bat.id)
  applyDirectDamage(world, 1, glyphs.map(({ id }) => id), new Map())

  runVolatileReactionSystem(world)
  assert.equal(world.diagnostics.volatileExplosionResolutionCount, 1)
  assert.equal(world.diagnostics.deferredVolatileExplosionCount, 2)
  runVolatileReactionSystem(world)
  assert.equal(world.diagnostics.volatileExplosionResolutionCount, 2)
  assert.equal(world.diagnostics.deferredVolatileExplosionCount, 1)
  runVolatileReactionSystem(world)
  assert.equal(world.diagnostics.volatileExplosionResolutionCount, 3)
  assert.equal(world.diagnostics.deferredVolatileExplosionCount, 0)
})

test('round-robins active chains instead of letting one chain monopolize the budget', () => {
  const world = createVolatileWorld('volatile-chain-fairness')
  useResolutionBudget(world, 1)
  const firstBat = spawnActiveBat(world, -80)
  const secondBat = spawnActiveBat(world, 80)
  const [firstLeft, firstMiddle, firstRight] =
    world.glyphStore.getOwnerGlyphs(firstBat.id)
  const [secondLeft, secondMiddle, secondRight] =
    world.glyphStore.getOwnerGlyphs(secondBat.id)
  for (const glyph of [firstLeft, firstRight, secondLeft, secondRight]) {
    world.glyphStore.applyDamage(glyph.id, 0.7)
  }
  applyDirectDamage(world, 1, [firstMiddle.id], new Map())
  applyDirectDamage(world, 2, [secondMiddle.id], new Map())

  runVolatileReactionSystem(world)
  runVolatileReactionSystem(world)

  assert.deepEqual(
    world.volatileState.activePresentationEvents.map(({ sourceGlyphId }) =>
      sourceGlyphId,
    ),
    [firstMiddle.id, secondMiddle.id],
  )
})

test('does not consume Crack or trigger other Modifier bonuses on reaction damage', () => {
  const world = createVolatileWorld('volatile-interaction-boundary')
  const bat = spawnActiveBat(world)
  const [left, middle] = world.glyphStore.getOwnerGlyphs(bat.id)
  applyDirectDamage(world, 1, [middle.id], new Map())
  const overloadDefinition = world.content.runModifierDefinitions.find(
    ({ id }) => id === RUN_MODIFIER_DEFINITION_ID.OVERLOAD,
  )
  const disconnectedDefinition = world.content.runModifierDefinitions.find(
    ({ id }) => id === RUN_MODIFIER_DEFINITION_ID.DISCONNECTED,
  )
  assert.ok(
    overloadDefinition?.effectStrategyId ===
      RUN_MODIFIER_EFFECT_STRATEGY.OVERLOAD,
  )
  assert.ok(
    disconnectedDefinition?.effectStrategyId ===
      RUN_MODIFIER_EFFECT_STRATEGY.DISCONNECTED,
  )
  world.runModifierState.resolvedProfile = Object.freeze({
    volatile: world.runModifierState.resolvedProfile.volatile,
    overload: overloadDefinition.overload,
    disconnected: disconnectedDefinition.disconnected,
  })
  assert.equal(world.glyphStore.applyCracked(left.id, 99), true)

  runVolatileReactionSystem(world)

  assert.equal(left.currentDurability, 0.65)
  assert.equal(hasGlyphStatus(left, GLYPH_STATUS_FLAG.CRACKED), true)
  assert.equal(world.diagnostics.crackConsumptionCount, 0)
  assert.equal(world.diagnostics.overloadThresholdEvaluationCount, 0)
})

test('attributes actual reaction durability damage to the source weapon once', () => {
  const world = createVolatileWorld('volatile-damage-attribution')
  const bat = spawnActiveBat(world)
  const [, middle] = world.glyphStore.getOwnerGlyphs(bat.id)
  const weapon = world.weaponLoadout.equipped[0]
  const statistics = world.runStatistics.weaponByInstanceId.get(weapon.id)
  assert.ok(statistics)
  applyDirectDamage(world, 1, [middle.id], new Map())

  runVolatileReactionSystem(world)

  assert.ok(Math.abs(statistics.totalDamage - 0.7) < 1e-9)
})

test('a HUSK source can emit only once for the whole run', () => {
  const world = createVolatileWorld('volatile-source-once')
  const bat = spawnActiveBat(world)
  const [, middle] = world.glyphStore.getOwnerGlyphs(bat.id)
  applyDirectDamage(world, 1, [middle.id], new Map())
  runVolatileReactionSystem(world)
  const resolved = world.diagnostics.volatileExplosionResolutionCount

  applyDamageApplication(world, {
    rootAttackEventId: 2,
    reactionChainId: null,
    route: DAMAGE_APPLICATION_ROUTE.DAMAGE_SPREAD,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    targetGlyphId: middle.id,
    baseDamage: 1,
    impactDirectionX: 0,
    impactDirectionY: 0,
  })
  runVolatileReactionSystem(world)

  assert.equal(world.diagnostics.volatileExplosionResolutionCount, resolved)
  assert.equal(world.volatileState.emittedSourceGlyphIds.size, 1)
})
