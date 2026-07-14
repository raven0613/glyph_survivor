import assert from 'node:assert/strict'
import test from 'node:test'
import { getWeaponDefinition, prepareGameContent } from '../../src/game/content/gameContent.ts'
import {
  preparePrototypeRangeModule,
} from '../../src/game/content/upgrades/prototypeWeaponModules.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { FLAMETHROWER_WEAPON_ID } from '../../src/game/content/weapons/flamethrowerWeapon.ts'
import { runCleanupSystem } from '../../src/game/systems/cleanupSystem.ts'
import { runCollisionSystem } from '../../src/game/systems/collisionSystem.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { prepareProjectileTargetingSystem } from '../../src/game/systems/projectileTargetingSystem.ts'
import { runProjectileSystem } from '../../src/game/systems/projectileSystem.ts'
import { resolveWeaponProfile } from '../../src/game/systems/resolveWeaponProfile.ts'
import { runWeaponSystem } from '../../src/game/systems/weaponSystem.ts'
import { createWorldState, spawnEnemy } from '../../src/game/runtime/worldState.ts'

function installRange(
  world: ReturnType<typeof createWorldState>,
  rank: number,
  includeDamageSpread = false,
): void {
  const range = preparePrototypeRangeModule()
  const weapon = world.weaponLoadout.equipped[0]
  weapon.moduleSlots[0] = { moduleDefinitionId: range.id, rank }
  if (includeDamageSpread) {
    weapon.moduleSlots[1] = {
      moduleDefinitionId: 'module.damage-spread',
      rank: 1,
    }
  }
  weapon.resolvedProfile = resolveWeaponProfile(
    getWeaponDefinition(world.content, weapon.definitionId),
    weapon.moduleSlots,
    Object.freeze({
      ...world.content.weaponModuleDefinitionsById,
      [range.id]: range,
    }),
  )
}

test('uses Range for assisted acquisition and lock maintenance', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'range-assisted-targeting',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  installRange(world, 1)
  const target = spawnEnemy(
    world,
    world.player.x + 750,
    world.player.y,
    0,
  )
  target.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runWeaponSystem(world, 50)

  const [projectile] = world.projectiles
  assert.equal(projectile.targetEnemyId, target.id)
  assert.equal(projectile.trackingState, 'LOCKED')
  assert.ok(Math.abs(projectile.trackingRange - 805) < 1e-9)

  prepareProjectileTargetingSystem(world)
  assert.equal(projectile.targetEnemyId, target.id)
  assert.equal(projectile.trackingState, 'LOCKED')
})

test('checks collision on the final partial path segment and resets pooled Range state', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'range-final-partial-segment',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const weapon = world.weaponLoadout.equipped[0]
  runWeaponSystem(world, 50)
  const [projectile] = world.projectiles
  projectile.remainingTravelDistance = 5
  const finalX = projectile.x + 5
  const target = spawnEnemy(world, finalX, projectile.y, 0)
  target.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runProjectileSystem(world, 50)

  assert.equal(projectile.x, finalX)
  assert.equal(projectile.remainingTravelDistance, 0)
  assert.equal(projectile.rangeExhausted, true)
  assert.equal(projectile.isAlive, true)

  runCollisionSystem(world)
  runDamageSystem(world)
  assert.equal(
    world.glyphStore.getOwnerGlyphs(target.id)[0].currentDurability,
    0,
  )
  assert.equal(world.diagnostics.rangeExpiredProjectileCount, 0)

  runCleanupSystem(world)
  installRange(world, 1)
  weapon.cooldownRemainingMs = 0
  runWeaponSystem(world, 50)

  const [recycledProjectile] = world.projectiles
  assert.equal(recycledProjectile, projectile)
  assert.ok(
    Math.abs(recycledProjectile.remainingTravelDistance - 1_283.4) < 1e-9,
  )
  assert.equal(recycledProjectile.rangeExhausted, false)
})

test('expires a projectile only after its final Range collision check', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'range-expiration',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  runWeaponSystem(world, 50)
  const [projectile] = world.projectiles
  projectile.remainingTravelDistance = 3

  runProjectileSystem(world, 50)
  assert.equal(projectile.isAlive, true)
  assert.equal(projectile.rangeExhausted, true)

  runCollisionSystem(world)
  assert.equal(projectile.isAlive, false)
  assert.equal(world.diagnostics.rangeExpiredProjectileCount, 1)
})

test('consumes maximum travel distance along the actual guided path', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'range-guided-path-distance',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  runWeaponSystem(world, 50)
  const [projectile] = world.projectiles
  const startX = projectile.x
  const startY = projectile.y
  projectile.remainingTravelDistance = 10
  projectile.velocityX = 60
  projectile.velocityY = 0

  runProjectileSystem(world, 50)
  projectile.velocityX = 0
  projectile.velocityY = 80
  runProjectileSystem(world, 50)

  assert.equal(projectile.x, startX + 3)
  assert.equal(projectile.y, startY + 4)
  assert.equal(Math.hypot(projectile.x - startX, projectile.y - startY), 5)
  assert.equal(projectile.remainingTravelDistance, 3)
})

test('shares the Range-adjusted Cone length with damage and flame presentation', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'range-cone',
    800,
    600,
    content,
    FLAMETHROWER_WEAPON_ID,
  )
  installRange(world, 1, true)
  const directTarget = spawnEnemy(
    world,
    world.player.x + 200,
    world.player.y,
    0,
  )
  const spreadTarget = spawnEnemy(
    world,
    world.player.x + 230,
    world.player.y,
    0,
  )
  directTarget.phase = 'ACTIVE'
  spreadTarget.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runWeaponSystem(world, 50)
  runDamageSystem(world)

  assert.equal(world.flameEmitters.length, 1)
  assert.ok(Math.abs(world.flameEmitters[0].range - 184) < 1e-9)
  assert.equal(world.flameEmitters[0].fullAngleRadians, Math.PI / 2)
  assert.equal(
    world.glyphStore.getOwnerGlyphs(directTarget.id)[0].currentDurability,
    0.875,
  )
  assert.equal(
    world.glyphStore.getOwnerGlyphs(spreadTarget.id)[0].currentDurability,
    0.975,
  )
})
