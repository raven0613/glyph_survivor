import assert from 'node:assert/strict'
import test from 'node:test'
import { createRenderSnapshot, writeRenderSnapshot } from '../../src/game/bridge/renderSnapshot.ts'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import {
  RUN_MODIFIER_DEFINITION_ID,
} from '../../src/game/content/modifiers/prototypeRunModifiers.ts'
import { RUN_MODIFIER_EFFECT_STRATEGY } from '../../src/game/content/modifiers/runModifierDefinition.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { PLAYER_ATTACK_VISUAL_ROLE } from '../../src/game/content/visuals/combatVisualTheme.ts'
import type { GlyphCell } from '../../src/game/glyph/glyphCell.ts'
import { getGlyphMaterialDefinition } from '../../src/game/glyph/glyphMaterial.ts'
import type { DamageTransferReservation } from '../../src/game/glyph/localDamage.ts'
import { createWorldState, spawnEnemy, type WorldState } from '../../src/game/runtime/worldState.ts'
import {
  DAMAGE_APPLICATION_ROUTE,
  applyDamageApplication,
  completeDirectDamageBatch,
  prepareDirectDamageBatch,
} from '../../src/game/systems/damageApplication.ts'
import {
  getDisconnectedTopologySnapshot,
  runDisconnectedTopologySystem,
} from '../../src/game/systems/disconnectedTopologySystem.ts'
import { createGlyphTopologyIndex } from '../../src/game/systems/glyphTopologyPath.ts'
import { runModifierPresentationSystem } from '../../src/game/systems/modifierPresentationSystem.ts'
import {
  runPendingDamageTransferSystem,
  schedulePendingDamageTransfer,
} from '../../src/game/systems/pendingDamageTransferSystem.ts'
import { createRunStartTestModifierOfferIfEnabled } from '../../src/game/systems/runModifierOffer.ts'
import { selectRunModifierFromOffer } from '../../src/game/systems/runModifierTransaction.ts'

function createDisconnectedWorld(seed: string): WorldState {
  const content = prepareGameContent()
  const world = createWorldState(seed, 800, 600, content, BASIC_PROJECTILE_WEAPON_ID)
  const offer = createRunStartTestModifierOfferIfEnabled(
    content.runModifierDefinitions,
    world.runModifierState,
    true,
  )
  assert.ok(offer)
  const choice = offer.choices.find(
    ({ definitionId }) =>
      definitionId === RUN_MODIFIER_DEFINITION_ID.DISCONNECTED,
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
  assert.ok(world.runModifierState.resolvedProfile.disconnected)
  return world
}

function spawnActiveSlime(world: WorldState) {
  const slime = spawnEnemy(
    world,
    world.player.x,
    world.player.y,
    0,
    world.content.slimeBossDefinition,
  )
  slime.phase = 'ACTIVE'
  return slime
}

function findEdgeTargetAndNeighbors(
  world: WorldState,
  ownerId: number,
): { readonly target: GlyphCell; readonly neighbors: readonly GlyphCell[] } {
  const glyphs = world.glyphStore.getOwnerGlyphs(ownerId)
  const topology = createGlyphTopologyIndex(
    glyphs.map((glyph) => ({
      ...glyph,
      worldX: 0,
      worldY: 0,
    })),
  )
  const target = [...glyphs].sort(
    (first, second) =>
      (topology.neighborsById.get(first.id)?.length ?? 0) -
        (topology.neighborsById.get(second.id)?.length ?? 0) ||
      first.id - second.id,
  )[0]
  const neighborIds = new Set(
    (topology.neighborsById.get(target.id) ?? []).map(({ id }) => id),
  )
  return {
    target,
    neighbors: glyphs.filter(({ id }) => neighborIds.has(id)),
  }
}

function isolateTargetInOneDirectBatch(
  world: WorldState,
  target: GlyphCell,
  neighbors: readonly GlyphCell[],
): void {
  const batch = prepareDirectDamageBatch(
    world,
    1,
    [...neighbors.map(({ id }) => id), target.id],
  )
  for (const neighbor of neighbors) {
    applyDamageApplication(
      world,
      {
        rootAttackEventId: 1,
        reactionChainId: null,
        route: DAMAGE_APPLICATION_ROUTE.DIRECT_LOCAL,
        sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
        targetGlyphId: neighbor.id,
        baseDamage: neighbor.currentDurability,
        impactDirectionX: 1,
        impactDirectionY: 0,
      },
      batch,
    )
  }
  const outcome = applyDamageApplication(
    world,
    {
      rootAttackEventId: 1,
      reactionChainId: null,
      route: DAMAGE_APPLICATION_ROUTE.DIRECT_LOCAL,
      sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
      targetGlyphId: target.id,
      baseDamage: 0.1,
      impactDirectionX: 1,
      impactDirectionY: 0,
    },
    batch,
  )
  completeDirectDamageBatch(world, batch)
  assert.equal(outcome.disconnectedBonusDamage, 0)
}

test('keeps newly severed Cells from benefiting until the next direct batch', () => {
  const world = createDisconnectedWorld('disconnected-next-event')
  const slime = spawnActiveSlime(world)
  const { target, neighbors } = findEdgeTargetAndNeighbors(world, slime.id)
  const startingDurability = target.currentDurability

  isolateTargetInOneDirectBatch(world, target, neighbors)
  assert.ok(Math.abs(target.currentDurability - (startingDurability - 0.1)) < 1e-9)

  const nextBatch = prepareDirectDamageBatch(world, 2, [target.id])
  const multiplier =
    nextBatch.disconnectedComponentByTargetId.get(target.id)?.multiplier ?? 1
  const outcome = applyDamageApplication(
    world,
    {
      rootAttackEventId: 2,
      reactionChainId: null,
      route: DAMAGE_APPLICATION_ROUTE.DIRECT_LOCAL,
      sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
      targetGlyphId: target.id,
      baseDamage: 0.1,
      impactDirectionX: 1,
      impactDirectionY: 0,
    },
    nextBatch,
  )
  completeDirectDamageBatch(world, nextBatch)

  assert.ok(outcome.disconnectedBonusDamage > 0)
  assert.ok(Math.abs(outcome.resolvedEffectiveDamage - 0.1 * multiplier) < 1e-9)
  assert.equal(world.disconnectedState.activeHitEvents.length, 1)
})

test('reuses canonical topology classification across deformation changes', () => {
  const world = createDisconnectedWorld('disconnected-deformation-cache')
  const slime = spawnActiveSlime(world)
  const first = getDisconnectedTopologySnapshot(world, slime.id)
  const glyph = world.glyphStore.getOwnerGlyphs(slime.id)[0]
  world.glyphStore.applyMaterialHit(
    glyph.id,
    1,
    1,
    getGlyphMaterialDefinition(glyph.material),
  )
  const rebuildCount =
    world.diagnostics.disconnectedTopologyCacheRebuildCount

  const second = getDisconnectedTopologySnapshot(world, slime.id)

  assert.equal(second, first)
  assert.equal(
    world.diagnostics.disconnectedTopologyCacheRebuildCount,
    rebuildCount,
  )
})

test('adds DISCONNECTED and Crack bonuses from the same base damage', () => {
  const world = createDisconnectedWorld('disconnected-crack-additive')
  const slime = spawnActiveSlime(world)
  const { target, neighbors } = findEdgeTargetAndNeighbors(world, slime.id)
  isolateTargetInOneDirectBatch(world, target, neighbors)
  const overloadDefinition = world.content.runModifierDefinitions.find(
    ({ id }) => id === RUN_MODIFIER_DEFINITION_ID.OVERLOAD,
  )
  assert.ok(
    overloadDefinition?.effectStrategyId ===
      RUN_MODIFIER_EFFECT_STRATEGY.OVERLOAD,
  )
  world.runModifierState.resolvedProfile = Object.freeze({
    ...world.runModifierState.resolvedProfile,
    overload: overloadDefinition.overload,
  })
  assert.equal(world.glyphStore.applyCracked(target.id, 1), true)
  const batch = prepareDirectDamageBatch(world, 2, [target.id])
  const multiplier =
    batch.disconnectedComponentByTargetId.get(target.id)?.multiplier ?? 1

  const outcome = applyDamageApplication(
    world,
    {
      rootAttackEventId: 2,
      reactionChainId: null,
      route: DAMAGE_APPLICATION_ROUTE.DIRECT_LOCAL,
      sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
      targetGlyphId: target.id,
      baseDamage: 0.1,
      impactDirectionX: 1,
      impactDirectionY: 0,
    },
    batch,
  )
  completeDirectDamageBatch(world, batch)

  assert.ok(
    Math.abs(outcome.resolvedEffectiveDamage - 0.1 * (multiplier + 0.4)) <
      1e-9,
  )
})

test('evaluates a remote direct target only when its topology transfer arrives', () => {
  const world = createDisconnectedWorld('disconnected-transfer-arrival')
  const slime = spawnActiveSlime(world)
  const { target, neighbors } = findEdgeTargetAndNeighbors(world, slime.id)
  isolateTargetInOneDirectBatch(world, target, neighbors)
  const before = target.currentDurability
  const reservation: DamageTransferReservation = {
    attackEventId: 2,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
    ownerId: slime.id,
    sourceGlyphId: neighbors[0].id,
    targetGlyphId: target.id,
    pathGlyphIds: [neighbors[0].id, target.id],
    sourceFlashDurationMs: 1,
    impactDirectionX: 1,
    impactDirectionY: 0,
  }
  schedulePendingDamageTransfer(world, reservation, 0.1)

  assert.equal(target.currentDurability, before)
  runPendingDamageTransferSystem(world, 1)

  assert.ok(before - target.currentDurability > 0.1)
})

test('excludes Damage Spread from DISCONNECTED', () => {
  const world = createDisconnectedWorld('disconnected-spread')
  const slime = spawnActiveSlime(world)
  const { target, neighbors } = findEdgeTargetAndNeighbors(world, slime.id)
  isolateTargetInOneDirectBatch(world, target, neighbors)

  const outcome = applyDamageApplication(world, {
    rootAttackEventId: 2,
    reactionChainId: null,
    route: DAMAGE_APPLICATION_ROUTE.DAMAGE_SPREAD,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    targetGlyphId: target.id,
    baseDamage: 0.1,
    impactDirectionX: 1,
    impactDirectionY: 0,
  })

  assert.equal(outcome.disconnectedBonusDamage, 0)
  assert.equal(outcome.resolvedEffectiveDamage, 0.1)
})

test('publishes render-only looseness without moving the authoritative Glyph', () => {
  const world = createDisconnectedWorld('disconnected-render-motion')
  const slime = spawnActiveSlime(world)
  const { target, neighbors } = findEdgeTargetAndNeighbors(world, slime.id)
  isolateTargetInOneDirectBatch(world, target, neighbors)
  runDisconnectedTopologySystem(world)
  const hitBatch = prepareDirectDamageBatch(world, 2, [target.id])
  applyDamageApplication(
    world,
    {
      rootAttackEventId: 2,
      reactionChainId: null,
      route: DAMAGE_APPLICATION_ROUTE.DIRECT_LOCAL,
      sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
      targetGlyphId: target.id,
      baseDamage: 0.1,
      impactDirectionX: 1,
      impactDirectionY: 0,
    },
    hitBatch,
  )
  completeDirectDamageBatch(world, hitBatch)
  runModifierPresentationSystem(
    world,
    world.content.combatVisualTheme.effects.runModifiers.disconnected.hitShake
      .attackDurationMs,
  )
  const authoritativeX = slime.x + target.localX + target.offsetX
  const authoritativeY = slime.y + target.localY + target.offsetY
  const snapshot = createRenderSnapshot()

  writeRenderSnapshot(world, snapshot, 1)

  const rendered = snapshot.enemies.find(({ id }) => id === target.id)
  assert.ok(rendered)
  assert.ok(
    Math.hypot(rendered.x - authoritativeX, rendered.y - authoritativeY) > 0,
  )
  assert.equal(slime.x + target.localX + target.offsetX, authoritativeX)
  assert.equal(slime.y + target.localY + target.offsetY, authoritativeY)
})
