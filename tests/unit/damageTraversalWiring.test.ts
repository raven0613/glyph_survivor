import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { FLAMETHROWER_WEAPON_ID } from '../../src/game/content/weapons/flamethrowerWeapon.ts'
import { ORBIT_ENERGY_BALL_WEAPON_ID } from '../../src/game/content/weapons/orbitEnergyBallWeapon.ts'
import {
  DAMAGE_FRONTIER_TRAVERSAL,
  type GlyphDamageEvent,
} from '../../src/game/glyph/localDamage.ts'
import { spawnProjectile } from '../../src/game/runtime/spawnProjectile.ts'
import {
  createWorldState,
  spawnEnemy,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import { runCollisionSystem } from '../../src/game/systems/collisionSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runOrbitWeaponSystem } from '../../src/game/systems/orbitWeaponSystem.ts'
import { runWeaponSystem } from '../../src/game/systems/weaponSystem.ts'

function drainSingleDamageEvent(world: WorldState): Readonly<GlyphDamageEvent> {
  let captured: Readonly<GlyphDamageEvent> | undefined
  world.glyphDamageQueue.drain((event) => {
    assert.equal(captured, undefined)
    captured = event
  })
  assert.ok(captured)
  return captured
}

function assertFixedDirection(
  event: Readonly<GlyphDamageEvent>,
): Extract<
  GlyphDamageEvent['frontierTraversal'],
  { readonly kind: 'FIXED_DIRECTION' }
> {
  assert.equal(
    event.frontierTraversal.kind,
    DAMAGE_FRONTIER_TRAVERSAL.FIXED_DIRECTION,
  )
  if (
    event.frontierTraversal.kind !==
    DAMAGE_FRONTIER_TRAVERSAL.FIXED_DIRECTION
  ) {
    throw new Error('Expected a fixed traversal direction.')
  }
  return event.frontierTraversal
}

test('snapshots assisted projectile contact velocity instead of launch direction', () => {
  const world = createWorldState(
    'projectile-contact-traversal',
    800,
    600,
    prepareGameContent(),
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const target = spawnEnemy(world, world.player.x, world.player.y, 0)
  target.phase = 'ACTIVE'
  const weapon = world.weaponLoadout.equipped[0]
  const projectile = spawnProjectile(world, {
    sourceWeaponInstanceId: weapon.id,
    x: target.x,
    y: target.y,
    directionX: 1,
    directionY: 0,
    profile: weapon.resolvedProfile,
    targetEnemyId: target.id,
  })
  projectile.velocityX = 0
  projectile.velocityY = Math.hypot(
    projectile.velocityX,
    projectile.velocityY,
  )
  if (projectile.velocityY === 0) {
    projectile.velocityY = 1
  }
  runEnemySpatialIndexSystem(world)

  runCollisionSystem(world)

  const traversal = assertFixedDirection(drainSingleDamageEvent(world))
  assert.ok(Math.abs(traversal.directionX) < 1e-12)
  assert.ok(Math.abs(traversal.directionY - 1) < 1e-12)
})

test('marks each Cone stream to derive traversal from its own muzzle origin', () => {
  const world = createWorldState(
    'cone-origin-traversal',
    800,
    600,
    prepareGameContent(),
    FLAMETHROWER_WEAPON_ID,
  )

  runWeaponSystem(world, 50)

  const event = drainSingleDamageEvent(world)
  assert.deepEqual(event.frontierTraversal, {
    kind: DAMAGE_FRONTIER_TRAVERSAL.FROM_SHAPE_ORIGIN,
  })
})

test('snapshots orbit swept motion independently from outward knockback', () => {
  const world = createWorldState(
    'orbit-swept-traversal',
    800,
    600,
    prepareGameContent(),
    ORBIT_ENERGY_BALL_WEAPON_ID,
  )
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const deltaMs = 250
  const nextPhase = 0.9 * Math.PI * 2 * (deltaMs / 1_000)
  const nextX = world.player.x + Math.cos(nextPhase) * 80
  const nextY = world.player.y + Math.sin(nextPhase) * 80
  const target = spawnEnemy(
    world,
    (orbit.x + nextX) / 2,
    (orbit.y + nextY) / 2,
    0,
  )
  target.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, deltaMs)

  const event = drainSingleDamageEvent(world)
  const traversal = assertFixedDirection(event)
  const expectedX = event.shapeX - orbit.previousX
  const expectedY = event.shapeY - orbit.previousY
  const expectedLength = Math.hypot(expectedX, expectedY)
  assert.ok(expectedLength > 0)
  assert.ok(
    Math.abs(traversal.directionX - expectedX / expectedLength) < 1e-12,
  )
  assert.ok(
    Math.abs(traversal.directionY - expectedY / expectedLength) < 1e-12,
  )
  assert.notDeepEqual(
    [traversal.directionX, traversal.directionY],
    [event.rootKnockbackDirectionX, event.rootKnockbackDirectionY],
  )
})

test('uses deterministic instantaneous orbit motion for a zero-length sweep', () => {
  const world = createWorldState(
    'orbit-zero-sweep-traversal',
    800,
    600,
    prepareGameContent(),
    ORBIT_ENERGY_BALL_WEAPON_ID,
  )
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const target = spawnEnemy(world, orbit.x, orbit.y, 0)
  target.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 0)

  const event = drainSingleDamageEvent(world)
  const traversal = assertFixedDirection(event)
  assert.ok(Math.abs(traversal.directionX) < 1e-12)
  assert.ok(Math.abs(traversal.directionY - 1) < 1e-12)
  assert.ok(Math.abs((event.rootKnockbackDirectionX ?? 0) - 1) < 1e-12)
  assert.ok(Math.abs(event.rootKnockbackDirectionY ?? 0) < 1e-12)
})
