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

test('writes the first domino as source clamp plus two axis-only core overlays', () => {
  const world = createWorld('volatile-render-domino')
  const bat = spawnActiveBat(world)
  const sourceGlyphId = killMiddleGlyph(world, bat.id)
  runVolatileReactionSystem(world)
  const release = world.content.combatVisualTheme.effects.runModifiers.volatile.release
  runModifierPresentationSystem(
    world,
    release.delayMs + release.attackDurationMs,
  )
  const snapshot = createRenderSnapshot()

  writeRenderSnapshot(world, snapshot, 1)

  const source = snapshot.enemies.find(({ id }) => id === sourceGlyphId)
  assert.ok(source)
  assert.ok(source.scale < world.glyphStore.getById(sourceGlyphId)!.scale)
  assert.equal(snapshot.volatileCoreOverlays.length, 2)
  for (const overlay of snapshot.volatileCoreOverlays) {
    const deltaX: number = overlay.x - source.x
    const deltaY: number = overlay.y - source.y
    assert.equal(Math.abs(deltaX) > 0 && Math.abs(deltaY) > 0, false)
  }
})

test('does not cap indispensable VOLATILE overlays with generic impact particles', () => {
  const world = createWorld('volatile-core-not-capped')
  const bat = spawnActiveBat(world)
  const [left, middle, right] = world.glyphStore.getOwnerGlyphs(bat.id)
  for (let index = 0; index < 100; index += 1) {
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
  const release = world.content.combatVisualTheme.effects.runModifiers.volatile.release
  runModifierPresentationSystem(
    world,
    release.delayMs + release.attackDurationMs,
  )
  const snapshot = createRenderSnapshot()

  writeRenderSnapshot(world, snapshot, 1)

  assert.equal(snapshot.volatileCoreOverlays.length, 200)
})
