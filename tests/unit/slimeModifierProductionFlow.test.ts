import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { RUN_MODIFIER_DEFINITION_ID } from '../../src/game/content/modifiers/prototypeRunModifiers.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { GLYPH_STATUS_FLAG, hasGlyphStatus } from '../../src/game/glyph/glyphStatus.ts'
import {
  createWorldState,
  spawnEnemy,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import { enqueueVolatileSource } from '../../src/game/runtime/volatileState.ts'
import {
  DAMAGE_APPLICATION_ROUTE,
  applyDamageApplication,
  completeDirectDamageBatch,
  prepareDirectDamageBatch,
} from '../../src/game/systems/damageApplication.ts'
import { getDisconnectedTopologySnapshot } from '../../src/game/systems/disconnectedTopologySystem.ts'
import { runGlyphDiagnosticsSystem } from '../../src/game/systems/glyphDiagnosticsSystem.ts'
import { runGlyphMaterialSystem } from '../../src/game/systems/glyphMaterialSystem.ts'
import { runMovementSystem } from '../../src/game/systems/movementSystem.ts'
import { createRunStartTestModifierOfferIfEnabled } from '../../src/game/systems/runModifierOffer.ts'
import { selectRunModifierFromOffer } from '../../src/game/systems/runModifierTransaction.ts'
import { runSlimeSplitSystem } from '../../src/game/systems/slimeSplitSystem.ts'
import { runVolatileReactionSystem } from '../../src/game/systems/volatileReactionSystem.ts'
import { runDeathSystem } from '../../src/game/systems/deathSystem.ts'
import { isEnemyCombatPhase } from '../../src/game/runtime/worldEntities.ts'

function createModifierWorld(
  seed: string,
  definitionId: string,
): WorldState {
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
    (candidate) => candidate.definitionId === definitionId,
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
  return world
}

function spawnActiveSlime(world: WorldState, offsetX = 0) {
  const slime = spawnEnemy(
    world,
    world.player.x + offsetX,
    world.player.y,
    0,
    world.content.slimeBossDefinition,
  )
  slime.phase = 'ACTIVE'
  return slime
}

function cutThreeCellFragment(world: WorldState, ownerId: number): number {
  let sourceGlyphId = 0
  for (const glyph of world.glyphStore.getOwnerGlyphs(ownerId)) {
    if (
      glyph.topologyX === 2 &&
      (glyph.topologyY === 2 || glyph.topologyY === 3)
    ) {
      world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
      sourceGlyphId = glyph.id
    }
  }
  assert.notEqual(sourceGlyphId, 0)
  world.topologyDirtyOwnerIds.add(ownerId)
  return sourceGlyphId
}

test('defers only a living Slime owner whose VOLATILE source chain is pending', () => {
  const world = createModifierWorld(
    'slime-owner-scoped-defer',
    RUN_MODIFIER_DEFINITION_ID.VOLATILE,
  )
  const deferredSlime = spawnActiveSlime(world, -300)
  const independentSlime = spawnActiveSlime(world, 300)
  const sourceGlyphId = cutThreeCellFragment(world, deferredSlime.id)
  cutThreeCellFragment(world, independentSlime.id)
  const source = world.glyphStore.getById(sourceGlyphId)
  assert.ok(source)
  enqueueVolatileSource(world.volatileState, {
    sourceGlyphId: source.id,
    ownerId: deferredSlime.id,
    sourceMaxDurability: source.maxDurability,
    rootAttackEventId: 1,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    causingApplicationId: 1,
    reactionChainId: null,
    appendToNextWave: false,
  })
  const deferredTopologyBefore = world.glyphStore
    .getOwnerGlyphs(deferredSlime.id)
    .map(({ id, topologyX, topologyY }) => ({ id, topologyX, topologyY }))

  runSlimeSplitSystem(world)

  assert.equal(deferredSlime.phase, 'ACTIVE')
  assert.equal(world.topologyDirtyOwnerIds.has(deferredSlime.id), true)
  assert.deepEqual(
    world.glyphStore
      .getOwnerGlyphs(deferredSlime.id)
      .map(({ id, topologyX, topologyY }) => ({ id, topologyX, topologyY })),
    deferredTopologyBefore,
  )
  assert.equal(independentSlime.phase, 'REASSEMBLING')
  assert.equal(world.topologyDirtyOwnerIds.has(independentSlime.id), false)
  assert.equal(world.diagnostics.volatileStructuralDeferredOwnerCount, 1)

  runVolatileReactionSystem(world, 0)
  runSlimeSplitSystem(world)

  assert.equal(deferredSlime.phase, 'REASSEMBLING')
  assert.equal(world.topologyDirtyOwnerIds.has(deferredSlime.id), false)
})

test('latches a vulnerable pre-split component through transfer and clears it on ACTIVE', () => {
  const world = createModifierWorld(
    'slime-disconnected-latch',
    RUN_MODIFIER_DEFINITION_ID.DISCONNECTED,
  )
  const slime = spawnActiveSlime(world)
  cutThreeCellFragment(world, slime.id)
  const preSplit = getDisconnectedTopologySnapshot(world, slime.id)
  assert.ok(preSplit)
  const vulnerable = preSplit.components.find(
    (component) => !component.isProtected,
  )
  assert.ok(vulnerable)
  const targetId = vulnerable.glyphIds[0]

  runSlimeSplitSystem(world)

  const target = world.glyphStore.getById(targetId)
  assert.ok(target)
  assert.equal(
    hasGlyphStatus(target, GLYPH_STATUS_FLAG.DISCONNECTED_LATCHED),
    true,
  )
  assert.equal(target.disconnectedLatchedMultiplier, vulnerable.multiplier)
  assert.ok(target.disconnectedLatchEpisodeId > 0)
  assert.notEqual(target.ownerId, 0)
  const currentTopology = getDisconnectedTopologySnapshot(
    world,
    target.ownerId,
  )
  assert.ok(currentTopology)
  assert.equal(
    currentTopology.componentByGlyphId.get(target.id)?.multiplier,
    1,
  )
  const batch = prepareDirectDamageBatch(world, 20, [target.id])
  const outcome = applyDamageApplication(
    world,
    {
      rootAttackEventId: 20,
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
    Math.abs(
      outcome.disconnectedBonusDamage -
        0.1 * (vulnerable.multiplier - 1),
    ) < 1e-9,
  )
  runGlyphDiagnosticsSystem(world)
  assert.ok(world.diagnostics.activeDisconnectedLatchedGlyphCount > 0)

  for (let step = 0; step < 360; step += 1) {
    runGlyphMaterialSystem(world, 1_000 / 60)
    runMovementSystem(world, 1_000 / 60)
  }

  assert.equal(world.enemyById.get(target.ownerId)?.phase, 'ACTIVE')
  assert.equal(
    hasGlyphStatus(target, GLYPH_STATUS_FLAG.DISCONNECTED_LATCHED),
    false,
  )
  assert.equal(target.disconnectedLatchedMultiplier, 1)
  assert.equal(target.disconnectedLatchEpisodeId, 0)
})

test('clears a DISCONNECTED latch immediately when its Cell enters HUSK', () => {
  const world = createModifierWorld(
    'slime-latch-husk-clear',
    RUN_MODIFIER_DEFINITION_ID.DISCONNECTED,
  )
  const slime = spawnActiveSlime(world)
  cutThreeCellFragment(world, slime.id)
  const snapshot = getDisconnectedTopologySnapshot(world, slime.id)
  const vulnerable = snapshot?.components.find(
    (component) => !component.isProtected,
  )
  assert.ok(vulnerable)
  const targetId = vulnerable.glyphIds[0]
  runSlimeSplitSystem(world)
  const target = world.glyphStore.getById(targetId)
  assert.ok(target)
  assert.equal(
    hasGlyphStatus(target, GLYPH_STATUS_FLAG.DISCONNECTED_LATCHED),
    true,
  )

  world.glyphStore.applyDamage(target.id, target.currentDurability)

  assert.equal(
    hasGlyphStatus(target, GLYPH_STATUS_FLAG.DISCONNECTED_LATCHED),
    false,
  )
  assert.equal(target.disconnectedLatchedMultiplier, 1)
  assert.equal(target.disconnectedLatchEpisodeId, 0)
})

test('does not structurally defer a depleted Slime body with pending source presentation', () => {
  const world = createModifierWorld(
    'slime-depleted-owner-pending',
    RUN_MODIFIER_DEFINITION_ID.VOLATILE,
  )
  const root = spawnActiveSlime(world)
  for (const glyph of world.glyphStore.getOwnerGlyphs(root.id)) {
    if (glyph.topologyX === 6 || glyph.topologyX === 7) {
      world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
    }
  }
  world.topologyDirtyOwnerIds.add(root.id)
  runSlimeSplitSystem(world)
  const child = world.enemies.find(
    (enemy) => enemy.encounterId === root.encounterId && enemy.id !== root.id,
  )
  assert.ok(child)
  const childGlyphs = world.glyphStore.getOwnerGlyphs(child.id)
  for (const glyph of childGlyphs) {
    if (glyph.currentDurability > 0) {
      world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
    }
  }
  const source = childGlyphs[0]
  enqueueVolatileSource(world.volatileState, {
    sourceGlyphId: source.id,
    ownerId: child.id,
    sourceMaxDurability: source.maxDurability,
    rootAttackEventId: 2,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    causingApplicationId: 2,
    reactionChainId: null,
    appendToNextWave: false,
  })
  world.topologyDirtyOwnerIds.add(child.id)

  runSlimeSplitSystem(world)
  runDeathSystem(world)

  assert.equal(world.topologyDirtyOwnerIds.has(child.id), false)
  assert.equal(child.phase, 'INACTIVE')
  assert.equal(isEnemyCombatPhase(child.phase), false)
  assert.equal(world.volatileState.activeChains.length, 1)
})
