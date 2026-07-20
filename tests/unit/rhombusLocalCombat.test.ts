import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activateRhombusBossContent,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import { RHOMBUS_COMPONENT } from '../../src/game/content/bosses/rhombusBoss.ts'
import { RUN_MODIFIER_DEFINITION_ID } from '../../src/game/content/modifiers/prototypeRunModifiers.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { PLAYER_ATTACK_VISUAL_ROLE } from '../../src/game/content/visuals/combatVisualTheme.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../../src/game/glyph/glyphPosition.ts'
import { GLYPH_CELL_STATE } from '../../src/game/glyph/glyphStore.ts'
import { GLYPH_STATUS_FLAG, hasGlyphStatus } from '../../src/game/glyph/glyphStatus.ts'
import {
  GLYPH_MATERIAL,
  getGlyphMaterialDefinition,
} from '../../src/game/glyph/glyphMaterial.ts'
import {
  DAMAGE_FRONTIER_TRAVERSAL,
  DAMAGE_TARGET_MODE,
  DAMAGE_TOPOLOGY_TRAVERSAL_SCOPE,
} from '../../src/game/glyph/localDamage.ts'
import {
  createWorldState,
  getNextDamageEventId,
  spawnEnemy,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import { beginPlayerDamageCandidateCollection } from '../../src/game/runtime/playerDamageCandidateBuffer.ts'
import {
  DAMAGE_APPLICATION_ROUTE,
  applyDamageApplication,
  completeDirectDamageBatch,
  prepareDirectDamageBatch,
} from '../../src/game/systems/damageApplication.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import {
  getDisconnectedTopologySnapshot,
} from '../../src/game/systems/disconnectedTopologySystem.ts'
import { runGlyphMaterialSystem } from '../../src/game/systems/glyphMaterialSystem.ts'
import { runMovementSystem } from '../../src/game/systems/movementSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runPendingDamageTransferSystem } from '../../src/game/systems/pendingDamageTransferSystem.ts'
import { runPlayerContactSystem } from '../../src/game/systems/playerContactSystem.ts'
import { createRunStartTestModifierOfferIfEnabled } from '../../src/game/systems/runModifierOffer.ts'
import { selectRunModifierFromOffer } from '../../src/game/systems/runModifierTransaction.ts'
import { runVolatileReactionSystem } from '../../src/game/systems/volatileReactionSystem.ts'

function createActiveRhombusWorld(seed: string) {
  const content = activateRhombusBossContent(prepareGameContent())
  const world = createWorldState(
    seed,
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const rhombus = spawnEnemy(
    world,
    world.player.x,
    world.player.y,
    0,
    content.rhombusBossDefinition.creature,
  )
  rhombus.phase = 'ACTIVE'
  return { content, rhombus, world }
}

function acquireModifier(
  world: WorldState,
  definitionId: string,
): void {
  const offer = createRunStartTestModifierOfferIfEnabled(
    world.content.runModifierDefinitions,
    world.runModifierState,
    true,
  )
  assert.ok(offer)
  const choice = offer.choices.find(
    (candidate) => candidate.definitionId === definitionId,
  )
  assert.ok(choice)
  const result = selectRunModifierFromOffer(
    world.content.runModifierDefinitions,
    world.runModifierState,
    { offerId: offer.id, choiceId: choice.id },
  )
  assert.equal(result.ok, true)
}

function enqueueSingleCellHit(
  world: WorldState,
  ownerId: number,
  glyphId: number,
): void {
  const glyph = world.glyphStore.getById(glyphId)
  const owner = world.enemyById.get(ownerId)
  assert.ok(glyph)
  assert.ok(owner)
  world.glyphDamageQueue.enqueue({
    attackEventId: getNextDamageEventId(world),
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
    primaryScope: 'LOCKED_OWNER',
    ownerId,
    shapeKind: 'CIRCLE',
    shapeX: getGlyphWorldX(owner.x, glyph),
    shapeY: getGlyphWorldY(owner.y, glyph),
    shapeRadius: 0,
    shapeDirectionX: 0,
    shapeDirectionY: 0,
    shapeRange: 0,
    shapeHalfAngleRadians: 0,
    targetMode: DAMAGE_TARGET_MODE.SINGLE,
    amount: world.weaponLoadout.equipped[0].resolvedProfile.damageAmount,
    damageSpreadProfile: null,
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

test('RHOMBUS explicitly prepares component-scoped direct traversal', () => {
  const { content } = createActiveRhombusWorld('rhombus-traversal-scope')

  assert.equal(
    content.rhombusBossDefinition.creature.damageTopologyTraversalScope,
    DAMAGE_TOPOLOGY_TRAVERSAL_SCOPE.CANONICAL_COMPONENT,
  )
})

test('a reinforced RHOMBUS Cell takes local durability damage and a bounded hard-material impulse', () => {
  const { rhombus, world } = createActiveRhombusWorld(
    'rhombus-reinforced-local-hit',
  )
  const glyphs = world.glyphStore.getOwnerGlyphs(rhombus.id)
  const reinforced = glyphs.find(
    (glyph) =>
      glyph.topologyComponentId === RHOMBUS_COMPONENT.MAIN &&
      glyph.maxDurability >
        Math.min(
          ...glyphs
            .filter(
              (candidate) =>
                candidate.topologyComponentId === RHOMBUS_COMPONENT.MAIN,
            )
            .map((candidate) => candidate.maxDurability),
        ),
  )
  assert.ok(reinforced)
  const ownerBefore = world.glyphStore.getOwnerDurability(rhombus.id)
  assert.ok(ownerBefore)
  const durabilityBefore = ownerBefore.currentDurability
  const targetBefore = reinforced.currentDurability

  enqueueSingleCellHit(world, rhombus.id, reinforced.id)
  runDamageSystem(world)

  const damageApplied = targetBefore - reinforced.currentDurability
  assert.ok(damageApplied > 0)
  assert.equal(reinforced.state, GLYPH_CELL_STATE.DAMAGED)
  assert.equal(
    world.glyphStore.getOwnerDurability(rhombus.id)?.currentDurability,
    durabilityBefore - damageApplied,
  )
  assert.ok(reinforced.velocityX > 0)

  const rhombusMaterial = getGlyphMaterialDefinition(GLYPH_MATERIAL.RHOMBUS)
  assert.ok(
    rhombusMaterial.maximumOffset <
      getGlyphMaterialDefinition(GLYPH_MATERIAL.ROCK).maximumOffset,
  )
  assert.ok(
    rhombusMaterial.knockbackImpulse <
      getGlyphMaterialDefinition(GLYPH_MATERIAL.SLIME).knockbackImpulse,
  )
  runGlyphMaterialSystem(world, 100)
  const displacedDistance = Math.hypot(
    reinforced.offsetX,
    reinforced.offsetY,
  )
  assert.ok(displacedDistance > 0)
  assert.ok(
    displacedDistance <= rhombusMaterial.maximumOffset,
  )
  for (let step = 0; step < 60; step += 1) {
    runGlyphMaterialSystem(world, 1_000 / 60)
  }
  assert.ok(
    Math.hypot(reinforced.offsetX, reinforced.offsetY) < displacedDistance,
  )
})

test('hitting a fully Husk satellite stays local and cannot transfer into the main body', () => {
  const { rhombus, world } = createActiveRhombusWorld(
    'rhombus-husk-satellite-locality',
  )
  const glyphs = world.glyphStore.getOwnerGlyphs(rhombus.id)
  const satellite = glyphs.find(
    (glyph) =>
      glyph.topologyComponentId === RHOMBUS_COMPONENT.SATELLITE,
  )
  assert.ok(satellite)
  world.glyphStore.applyDamage(satellite.id, satellite.currentDurability)
  const mainBefore = glyphs
    .filter(
      (glyph) => glyph.topologyComponentId === RHOMBUS_COMPONENT.MAIN,
    )
    .reduce((total, glyph) => total + glyph.currentDurability, 0)
  const ownerBefore = world.glyphStore.getOwnerDurability(rhombus.id)
    ?.currentDurability

  enqueueSingleCellHit(world, rhombus.id, satellite.id)
  runDamageSystem(world)

  assert.equal(
    glyphs
      .filter(
        (glyph) => glyph.topologyComponentId === RHOMBUS_COMPONENT.MAIN,
      )
      .reduce((total, glyph) => total + glyph.currentDurability, 0),
    mainBefore,
  )
  assert.equal(
    world.glyphStore.getOwnerDurability(rhombus.id)?.currentDurability,
    ownerBefore,
  )
  assert.equal(world.pendingDamageTransfers.length, 0)
  assert.ok(satellite.hitFlashRemainingMs > 0)
})

test('a main-body Husk transfers damage only after its component-local pulse arrives', () => {
  const { rhombus, world } = createActiveRhombusWorld(
    'rhombus-main-component-transfer',
  )
  const mainGlyphs = world.glyphStore
    .getOwnerGlyphs(rhombus.id)
    .filter(
      (glyph) => glyph.topologyComponentId === RHOMBUS_COMPONENT.MAIN,
    )
  const source = mainGlyphs.find(
    (glyph) => glyph.topologyX === 0 && glyph.topologyY === 0,
  )
  const target = mainGlyphs.find(
    (glyph) => glyph.topologyX === 1 && glyph.topologyY === 0,
  )
  assert.ok(source)
  assert.ok(target)
  world.glyphStore.applyDamage(source.id, source.currentDurability)
  const targetBefore = target.currentDurability

  enqueueSingleCellHit(world, rhombus.id, source.id)
  runDamageSystem(world)

  assert.equal(target.currentDurability, targetBefore)
  assert.equal(world.pendingDamageTransfers.length, 1)
  runPendingDamageTransferSystem(world, 10_000)
  assert.ok(target.currentDurability < targetBefore)
  assert.equal(world.pendingDamageTransfers.length, 0)
})

test('DISCONNECTED classifies three RHOMBUS islands and ignores orbit motion', () => {
  const { content, rhombus, world } = createActiveRhombusWorld(
    'rhombus-disconnected-islands',
  )
  acquireModifier(world, RUN_MODIFIER_DEFINITION_ID.DISCONNECTED)
  const before = getDisconnectedTopologySnapshot(world, rhombus.id)
  assert.ok(before)
  assert.deepEqual(
    before.components.map((component) => component.size).sort((a, b) => a - b),
    [1, 41, 421],
  )
  const rebuildCount = world.diagnostics.disconnectedTopologyCacheRebuildCount
  const secondary = content.rhombusBossDefinition.orbitProfiles.find(
    (profile) =>
      profile.topologyComponentId === RHOMBUS_COMPONENT.SECONDARY,
  )
  assert.ok(secondary)

  runMovementSystem(world, secondary.revolutionDurationMs / 4)
  const after = getDisconnectedTopologySnapshot(world, rhombus.id)

  assert.equal(after, before)
  assert.equal(
    world.diagnostics.disconnectedTopologyCacheRebuildCount,
    rebuildCount,
  )
})

test('VOLATILE cannot cross from the single-cell satellite into overlapping RHOMBUS components', () => {
  const { rhombus, world } = createActiveRhombusWorld(
    'rhombus-volatile-component-boundary',
  )
  acquireModifier(world, RUN_MODIFIER_DEFINITION_ID.VOLATILE)
  const glyphs = world.glyphStore.getOwnerGlyphs(rhombus.id)
  const satellite = glyphs.find(
    (glyph) =>
      glyph.topologyComponentId === RHOMBUS_COMPONENT.SATELLITE,
  )
  assert.ok(satellite)
  world.glyphStore.setGlyphBodyMotion(
    satellite.id,
    -satellite.localX,
    -satellite.localY,
    0,
  )
  const otherComponentsBefore = glyphs
    .filter((glyph) => glyph.id !== satellite.id)
    .reduce((total, glyph) => total + glyph.currentDurability, 0)
  const batch = prepareDirectDamageBatch(world, 1, [satellite.id])

  applyDamageApplication(
    world,
    {
      rootAttackEventId: 1,
      reactionChainId: null,
      route: DAMAGE_APPLICATION_ROUTE.DIRECT_LOCAL,
      sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
      targetGlyphId: satellite.id,
      baseDamage: satellite.currentDurability,
      impactDirectionX: 1,
      impactDirectionY: 0,
    },
    batch,
  )
  completeDirectDamageBatch(world, batch)
  runVolatileReactionSystem(world, 0)

  assert.equal(
    glyphs
      .filter((glyph) => glyph.id !== satellite.id)
      .reduce((total, glyph) => total + glyph.currentDurability, 0),
    otherComponentsBefore,
  )
  assert.equal(world.diagnostics.volatileExplosionResolutionCount, 1)
})

test('OVERLOAD cannot apply Crack across a RHOMBUS component boundary', () => {
  const { rhombus, world } = createActiveRhombusWorld(
    'rhombus-overload-component-boundary',
  )
  acquireModifier(world, RUN_MODIFIER_DEFINITION_ID.OVERLOAD)
  const overload = world.runModifierState.resolvedProfile.overload
  assert.ok(overload)
  const glyphs = world.glyphStore.getOwnerGlyphs(rhombus.id)
  const satellite = glyphs.find(
    (glyph) =>
      glyph.topologyComponentId === RHOMBUS_COMPONENT.SATELLITE,
  )
  assert.ok(satellite)
  const batch = prepareDirectDamageBatch(world, 1, [satellite.id])

  applyDamageApplication(
    world,
    {
      rootAttackEventId: 1,
      reactionChainId: null,
      route: DAMAGE_APPLICATION_ROUTE.DIRECT_LOCAL,
      sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
      targetGlyphId: satellite.id,
      baseDamage:
        satellite.maxDurability * overload.overloadThresholdRatio,
      impactDirectionX: 1,
      impactDirectionY: 0,
    },
    batch,
  )
  completeDirectDamageBatch(world, batch)

  assert.equal(world.diagnostics.overloadTriggerCount, 1)
  assert.equal(
    glyphs.some(
      (glyph) =>
        glyph.id !== satellite.id &&
        hasGlyphStatus(glyph, GLYPH_STATUS_FLAG.CRACKED),
    ),
    false,
  )
})

test('overlapping RHOMBUS components append only one owner-level contact candidate', () => {
  const { content, rhombus, world } = createActiveRhombusWorld(
    'rhombus-owner-contact-dedup',
  )
  for (const glyph of world.glyphStore.getOwnerGlyphs(rhombus.id)) {
    world.glyphStore.setGlyphBodyMotion(glyph.id, 0, 0, 0)
  }
  runEnemySpatialIndexSystem(world)
  beginPlayerDamageCandidateCollection(world)

  const appendedCount = runPlayerContactSystem(world)

  assert.equal(appendedCount, 1)
  assert.equal(world.playerDamageCandidateCount, 1)
  assert.equal(world.playerDamageCandidates[0].sourceId, rhombus.id)
  assert.equal(
    world.playerDamageCandidates[0].amount,
    content.rhombusBossDefinition.creature.contactDamage,
  )
})
