import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import {
  getWeaponDefinition,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { defineWeapon } from '../../src/game/content/weapons/weaponDefinition.ts'
import { createWorldState } from '../../src/game/runtime/worldState.ts'
import { equipWeapon } from '../../src/game/runtime/weaponLoadout.ts'
import { runCleanupSystem } from '../../src/game/systems/cleanupSystem.ts'
import { resolveWeaponProfile } from '../../src/game/systems/resolveWeaponProfile.ts'
import { runWeaponSystem } from '../../src/game/systems/weaponSystem.ts'

function createWeaponTestWorld() {
  const content = prepareGameContent()
  return createWorldState(
    'weapon-system',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
}

test('creates one stable weapon instance with fixed empty module slots', () => {
  const world = createWeaponTestWorld()
  const [weapon] = world.weaponLoadout.equipped

  assert.equal('weaponCooldownMs' in world, false)
  assert.equal(world.weaponLoadout.maximumEquippedWeapons, 3)
  assert.equal(world.weaponLoadout.equipped.length, 1)
  assert.equal(weapon.id, 1)
  assert.equal(weapon.definitionId, BASIC_PROJECTILE_WEAPON_ID)
  assert.equal(weapon.equipmentSlot, 0)
  assert.equal(weapon.cooldownRemainingMs, 0)
  assert.equal(weapon.attackSequence, 0)
  assert.equal(weapon.profileRevision, 0)
  assert.deepEqual(weapon.moduleSlots, [null, null, null])
})

test('updates cooldown independently for each equipped weapon in stable order', () => {
  const world = createWeaponTestWorld()
  const basicDefinition = getWeaponDefinition(
    world.content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const slowerDefinition = defineWeapon({
    ...basicDefinition,
    id: 'weapon.test-slower-projectile',
    baseProfile: {
      ...basicDefinition.baseProfile,
      fireIntervalMs: 500,
    },
  })
  const firstWeapon = world.weaponLoadout.equipped[0]
  const secondWeapon = equipWeapon(world.weaponLoadout, slowerDefinition)
  secondWeapon.cooldownRemainingMs = 100

  runWeaponSystem(world, 50)

  assert.deepEqual(
    world.projectiles.map((projectile) => projectile.sourceWeaponInstanceId),
    [firstWeapon.id],
  )
  assert.equal(firstWeapon.cooldownRemainingMs, 170)
  assert.equal(secondWeapon.cooldownRemainingMs, 50)
  assert.equal(firstWeapon.attackSequence, 1)
  assert.equal(secondWeapon.attackSequence, 0)

  runWeaponSystem(world, 50)

  assert.deepEqual(
    world.projectiles.map((projectile) => projectile.sourceWeaponInstanceId),
    [firstWeapon.id, secondWeapon.id],
  )
  assert.equal(firstWeapon.cooldownRemainingMs, 120)
  assert.equal(secondWeapon.cooldownRemainingMs, 500)
  assert.equal(firstWeapon.attackSequence, 1)
  assert.equal(secondWeapon.attackSequence, 1)
})

test('snapshots assisted projectile combat and ASCII presentation at emission', () => {
  const world = createWeaponTestWorld()
  const weapon = world.weaponLoadout.equipped[0]

  runWeaponSystem(world, 50)

  const [projectile] = world.projectiles
  assert.ok(projectile)
  assert.deepEqual(
    {
      sourceWeaponInstanceId: projectile.sourceWeaponInstanceId,
      speed: Math.hypot(projectile.velocityX, projectile.velocityY),
      radius: projectile.radius,
      damage: projectile.damage,
      lifetimeMs: projectile.lifetimeMs,
      trackingMode: projectile.trackingMode,
      trackingState: projectile.trackingState,
      glyphFrame: projectile.glyphFrame,
      visualScale: projectile.visualScale,
      visualAlpha: projectile.visualAlpha,
      visualTint: projectile.visualTint,
    },
    {
      sourceWeaponInstanceId: weapon.id,
      speed: 620,
      radius: 7,
      damage: 1,
      lifetimeMs: 1_800,
      trackingMode: 'ASSISTED',
      trackingState: 'BALLISTIC',
      glyphFrame: weapon.resolvedProfile.projectilePresentation.glyphFrame,
      visualScale: 0.55,
      visualAlpha: 1,
      visualTint: 0x66ddff,
    },
  )

  const changedDefinition = defineWeapon({
    ...getWeaponDefinition(world.content, BASIC_PROJECTILE_WEAPON_ID),
    id: 'weapon.test-changed-profile',
    baseProfile: {
      ...weapon.resolvedProfile,
      damageAmount: 99,
      projectilePresentation: {
        ...weapon.resolvedProfile.projectilePresentation,
        scale: 2,
        tint: 0xff0000,
      },
    },
  })
  weapon.resolvedProfile = resolveWeaponProfile(changedDefinition)

  assert.equal(projectile.damage, 1)
  assert.equal(projectile.visualScale, 0.55)
  assert.equal(projectile.visualTint, 0x66ddff)

  const renderSnapshot = createRenderSnapshot()
  writeRenderSnapshot(world, renderSnapshot, 1)
  assert.deepEqual(renderSnapshot.projectiles, [
    {
      id: projectile.id,
      glyphFrame: projectile.glyphFrame,
      x: projectile.x,
      y: projectile.y,
      rotation: 0,
      scale: projectile.visualScale,
      alpha: projectile.visualAlpha,
      tint: projectile.visualTint,
    },
  ])

  projectile.isAlive = false
  runCleanupSystem(world)
  weapon.cooldownRemainingMs = 0
  runWeaponSystem(world, 50)

  const [recycledProjectile] = world.projectiles
  assert.equal(recycledProjectile, projectile)
  assert.equal(recycledProjectile.damage, 99)
  assert.equal(recycledProjectile.visualScale, 2)
  assert.equal(recycledProjectile.visualTint, 0xff0000)
})
