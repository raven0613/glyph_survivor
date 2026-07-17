import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import {
  calculateVolatileNeighborJolt,
  calculateVolatileRelease,
  calculateVolatileSourceScale,
} from '../../src/game/bridge/volatilePresentation.ts'
import {
  getVolatileClusterCount,
  getVolatileClusterPointCount,
  writeVolatileClusterPresentation,
  writeVolatileClusterPointPresentation,
  type VolatileClusterPresentation,
  type VolatileClusterPointPresentation,
} from '../../src/game/bridge/volatileClusterPresentation.ts'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { RUN_MODIFIER_DEFINITION_ID } from '../../src/game/content/modifiers/prototypeRunModifiers.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import {
  createWorldState,
  spawnEnemy,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import { startVolatilePresentation } from '../../src/game/runtime/volatileState.ts'
import {
  DAMAGE_APPLICATION_ROUTE,
  applyDamageApplication,
  completeDirectDamageBatch,
  prepareDirectDamageBatch,
} from '../../src/game/systems/damageApplication.ts'
import { runModifierPresentationSystem } from '../../src/game/systems/modifierPresentationSystem.ts'
import { createRunStartTestModifierOfferIfEnabled } from '../../src/game/systems/runModifierOffer.ts'
import { selectRunModifierFromOffer } from '../../src/game/systems/runModifierTransaction.ts'
import { runVolatileReactionSystem } from '../../src/game/systems/volatileReactionSystem.ts'

function createWorld(seed: string): WorldState {
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
  return bat
}

function killMiddleGlyph(world: WorldState, ownerId: number): number {
  const middle = world.glyphStore.getOwnerGlyphs(ownerId)[1]
  const batch = prepareDirectDamageBatch(world, 1, [middle.id])
  applyDamageApplication(
    world,
    {
      rootAttackEventId: 1,
      reactionChainId: null,
      route: DAMAGE_APPLICATION_ROUTE.DIRECT_LOCAL,
      sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
      targetGlyphId: middle.id,
      baseDamage: 1,
      impactDirectionX: 1,
      impactDirectionY: 0,
    },
    batch,
  )
  completeDirectDamageBatch(world, batch)
  return middle.id
}

test('uses a short clamp, hold point, and decisive source release', () => {
  const profile = createWorld('volatile-source-beat').content.combatVisualTheme
    .effects.runModifiers.volatile.sourceClamp

  assert.equal(calculateVolatileSourceScale(0, profile), 1)
  assert.equal(
    calculateVolatileSourceScale(profile.attackDurationMs, profile),
    profile.minimumScale,
  )
  assert.equal(
    calculateVolatileSourceScale(
      profile.attackDurationMs + profile.holdDurationMs,
      profile,
    ),
    profile.minimumScale,
  )
  assert.equal(
    calculateVolatileSourceScale(
      profile.attackDurationMs +
        profile.holdDurationMs +
        profile.settleDurationMs,
      profile,
    ),
    1,
  )
})

test('delays the topology release, then moves it only along one canonical axis', () => {
  const volatile = createWorld('volatile-release-beat').content
    .combatVisualTheme.effects.runModifiers.volatile
  assert.equal(calculateVolatileRelease(volatile.release.delayMs - 1, volatile.release).alpha, 0)
  const release = calculateVolatileRelease(
    volatile.release.delayMs + volatile.release.attackDurationMs,
    volatile.release,
  )
  const jolt = calculateVolatileNeighborJolt(
    volatile.neighborJolt.delayMs + volatile.neighborJolt.attackDurationMs,
    1,
    0,
    7,
    volatile.neighborJolt,
  )

  assert.ok(release.alpha > 0)
  assert.ok(release.distance > volatile.release.startDistance)
  assert.ok(jolt.offsetX > 0)
  assert.equal(jolt.offsetY, 0)
})

test('derives reproducible irregular cluster points with staggered lifetimes', () => {
  const profile = createWorld('volatile-cluster-layout').content
    .combatVisualTheme.effects.runModifiers.volatile.clusterBurst
  const eventId = 73
  const clusterCount = getVolatileClusterCount(eventId, profile)
  const first: VolatileClusterPointPresentation = {
    offsetX: 0,
    offsetY: 0,
    scale: 0,
    alpha: 0,
    characterIndex: 0,
  }
  const firstCluster: VolatileClusterPresentation = {
    offsetX: 0,
    offsetY: 0,
  }
  const differentCluster = { ...firstCluster }
  const repeated = { ...first }
  const different = { ...first }
  const visibleAgeMs =
    profile.maximumSpawnStaggerMs + profile.attackDurationMs

  writeVolatileClusterPresentation(
    firstCluster,
    eventId,
    clusterCount,
    0,
    visibleAgeMs,
    profile,
  )
  writeVolatileClusterPresentation(
    differentCluster,
    eventId,
    clusterCount,
    1,
    visibleAgeMs,
    profile,
  )

  writeVolatileClusterPointPresentation(
    first,
    eventId,
    0,
    0,
    firstCluster.offsetX,
    firstCluster.offsetY,
    visibleAgeMs,
    profile,
  )
  writeVolatileClusterPointPresentation(
    repeated,
    eventId,
    0,
    0,
    firstCluster.offsetX,
    firstCluster.offsetY,
    visibleAgeMs,
    profile,
  )
  writeVolatileClusterPointPresentation(
    different,
    eventId,
    1,
    0,
    differentCluster.offsetX,
    differentCluster.offsetY,
    visibleAgeMs,
    profile,
  )

  assert.deepEqual(repeated, first)
  assert.ok(first.alpha > 0)
  assert.notDeepEqual(
    [different.offsetX, different.offsetY],
    [first.offsetX, first.offsetY],
  )
  assert.ok(
    getVolatileClusterPointCount(eventId, 0, profile) >=
      profile.minimumPointsPerCluster,
  )

  writeVolatileClusterPointPresentation(
    first,
    eventId,
    0,
    0,
    firstCluster.offsetX,
    firstCluster.offsetY,
    profile.maximumSpawnStaggerMs +
      profile.attackDurationMs +
      profile.holdDurationMs +
      profile.settleDurationMs +
      profile.maximumLifetimeVariationMs,
    profile,
  )
  assert.equal(first.alpha, 0)
})

test('writes the first domino with a center highlight and dense point clusters', () => {
  const world = createWorld('volatile-render-domino')
  const bat = spawnActiveBat(world)
  const sourceGlyphId = killMiddleGlyph(world, bat.id)
  runVolatileReactionSystem(world, 0)
  const volatile =
    world.content.combatVisualTheme.effects.runModifiers.volatile
  const event = world.volatileState.activePresentationEvents[0]
  assert.ok(event)
  const clusterCount = getVolatileClusterCount(
    event.id,
    volatile.clusterBurst,
  )
  let expectedPointCount = 0
  for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
    expectedPointCount += getVolatileClusterPointCount(
      event.id,
      clusterIndex,
      volatile.clusterBurst,
    )
  }
  runModifierPresentationSystem(
    world,
    volatile.clusterBurst.maximumSpawnStaggerMs +
      volatile.clusterBurst.attackDurationMs,
  )
  const snapshot = createRenderSnapshot()

  writeRenderSnapshot(world, snapshot, 1)

  const source = snapshot.enemies.find(({ id }) => id === sourceGlyphId)
  assert.ok(source)
  assert.ok(source.scale < world.glyphStore.getById(sourceGlyphId)!.scale)
  assert.equal(
    snapshot.volatileCoreOverlays.length,
    event.neighborGlyphIds.length + expectedPointCount + 1,
  )
  assert.equal(
    snapshot.volatileOverlayDiagnostics.activeClusterPointCount,
    expectedPointCount,
  )
  assert.ok(
    snapshot.volatileCoreOverlays.some((overlay) => {
      const deltaX = overlay.x - source.x
      const deltaY = overlay.y - source.y
      return Math.abs(deltaX) > 0 && Math.abs(deltaY) > 0
    }),
  )
})

test('does not cap indispensable VOLATILE overlays with generic impact particles', () => {
  const world = createWorld('volatile-core-not-capped')
  const bat = spawnActiveBat(world)
  const [left, middle, right] = world.glyphStore.getOwnerGlyphs(bat.id)
  const eventCount = 100
  for (let index = 0; index < eventCount; index += 1) {
    startVolatilePresentation(
      world.volatileState,
      middle.id,
      bat.id,
      0,
      200,
      [
        { id: left.id, directionX: -1, directionY: 0 },
        { id: right.id, directionX: 1, directionY: 0 },
      ],
      [left.id, right.id],
    )
  }
  const volatile =
    world.content.combatVisualTheme.effects.runModifiers.volatile
  runModifierPresentationSystem(
    world,
    volatile.clusterBurst.maximumSpawnStaggerMs +
      volatile.clusterBurst.attackDurationMs,
  )
  const snapshot = createRenderSnapshot()

  writeRenderSnapshot(world, snapshot, 1)

  const minimumReadablePointCount =
    world.volatileState.activePresentationEvents.reduce(
      (count, event) =>
        count +
        getVolatileClusterCount(event.id, volatile.clusterBurst) *
          volatile.clusterBurst.minimumPointsPerCluster,
      0,
    )
  assert.ok(
    snapshot.volatileOverlayDiagnostics.activeClusterPointCount >=
      minimumReadablePointCount,
  )
  assert.equal(
    snapshot.volatileCoreOverlays.length,
    eventCount * 3 +
      snapshot.volatileOverlayDiagnostics.activeClusterPointCount,
  )
})
