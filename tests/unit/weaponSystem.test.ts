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
import { FLAMETHROWER_WEAPON_ID } from '../../src/game/content/weapons/flamethrowerWeapon.ts'
import { defineWeapon } from '../../src/game/content/weapons/weaponDefinition.ts'
import { createWorldState, spawnEnemy } from '../../src/game/runtime/worldState.ts'
import { equipWeapon } from '../../src/game/runtime/weaponLoadout.ts'
import { runCleanupSystem } from '../../src/game/systems/cleanupSystem.ts'
import { resolveWeaponProfile } from '../../src/game/systems/resolveWeaponProfile.ts'
import { runWeaponSystem } from '../../src/game/systems/weaponSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runCollisionSystem } from '../../src/game/systems/collisionSystem.ts'
import {
  getPlayerAttackAppearance,
  PLAYER_ATTACK_VISUAL_ROLE,
} from '../../src/game/content/visuals/combatVisualTheme.ts'

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

function installProjectileCount(
  world: ReturnType<typeof createWorldState>,
  rank: number,
): void {
  const weapon = world.weaponLoadout.equipped[0]
  weapon.moduleSlots[0] = {
    moduleDefinitionId: 'module.projectile-count',
    rank,
  }
  weapon.resolvedProfile = resolveWeaponProfile(
    getWeaponDefinition(world.content, weapon.definitionId),
    weapon.moduleSlots,
    world.content.weaponModuleDefinitionsById,
  )
}

function getDirectionAngle(x: number, y: number): number {
  return Math.atan2(y, x)
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
  assert.deepEqual(weapon.moduleSlots, [null, null, null, null])
})

test('updates cooldown independently for each equipped weapon in stable order', () => {
  const world = createWeaponTestWorld()
  const basicDefinition = getWeaponDefinition(
    world.content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  if (basicDefinition.baseProfile.targetStrategyId !== 'AIM_ASSISTED') {
    throw new Error('Expected assisted projectile definition.')
  }
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
  const projectileProfile = weapon.resolvedProfile
  if (projectileProfile.targetStrategyId !== 'AIM_ASSISTED') {
    throw new Error('Expected assisted projectile profile.')
  }

  runWeaponSystem(world, 50)

  const [projectile] = world.projectiles
  assert.ok(projectile)
  const assistedAppearance = getPlayerAttackAppearance(
    world.content.combatVisualTheme,
    PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
  )
  assert.deepEqual(
    {
      sourceWeaponInstanceId: projectile.sourceWeaponInstanceId,
      speed: Math.hypot(projectile.velocityX, projectile.velocityY),
      radius: projectile.radius,
      damage: projectile.damage,
      remainingTravelDistance: projectile.remainingTravelDistance,
      rangeExhausted: projectile.rangeExhausted,
      trackingMode: projectile.trackingMode,
      trackingState: projectile.trackingState,
      glyphFrame: projectile.glyphFrame,
      visualRoleId: projectile.visualRoleId,
      visualScale: projectile.visualScale,
      visualAlpha: projectile.visualAlpha,
      visualTint: projectile.visualTint,
    },
    {
      sourceWeaponInstanceId: weapon.id,
      speed: 620,
      radius: 7,
      damage: 1,
      remainingTravelDistance: 1_116,
      rangeExhausted: false,
      trackingMode: 'ASSISTED',
      trackingState: 'BALLISTIC',
      glyphFrame: projectileProfile.projectilePresentation.glyphFrame,
      visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
      visualScale: 0.55,
      visualAlpha: assistedAppearance.core.alpha,
      visualTint: assistedAppearance.core.tint,
    },
  )

  const changedDefinition = defineWeapon({
    ...getWeaponDefinition(world.content, BASIC_PROJECTILE_WEAPON_ID),
    id: 'weapon.test-changed-profile',
    baseProfile: {
      ...projectileProfile,
      damageAmount: 99,
      projectilePresentation: {
        ...projectileProfile.projectilePresentation,
        scale: 2,
        visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.ORBIT_ENERGY,
      },
    },
  })
  weapon.resolvedProfile = resolveWeaponProfile(changedDefinition)

  assert.equal(projectile.damage, 1)
  assert.equal(
    projectile.visualRoleId,
    PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
  )
  assert.equal(projectile.visualScale, 0.55)
  assert.equal(projectile.visualTint, assistedAppearance.core.tint)

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
  const orbitAppearance = getPlayerAttackAppearance(
    world.content.combatVisualTheme,
    PLAYER_ATTACK_VISUAL_ROLE.ORBIT_ENERGY,
  )
  assert.equal(recycledProjectile, projectile)
  assert.equal(recycledProjectile.damage, 99)
  assert.equal(
    recycledProjectile.visualRoleId,
    PLAYER_ATTACK_VISUAL_ROLE.ORBIT_ENERGY,
  )
  assert.equal(recycledProjectile.visualScale, 2)
  assert.equal(recycledProjectile.visualTint, orbitAppearance.core.tint)
})

test('emits one centered assisted volley from one target query', () => {
  const world = createWeaponTestWorld()
  const target = spawnEnemy(world, world.player.x + 100, world.player.y, 0)
  target.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)
  installProjectileCount(world, 1)

  runWeaponSystem(world, 50)

  assert.equal(world.projectiles.length, 2)
  assert.equal(world.diagnostics.targetSearchCount, 1)
  assert.equal(world.diagnostics.attackEmissionCount, 2)
  assert.equal(target.trackingLoad, 2)
  assert.deepEqual(
    world.projectiles.map(({ targetEnemyId }) => targetEnemyId),
    [target.id, target.id],
  )
  const expectedHalfSpacing = (4 * Math.PI) / 180
  assert.ok(
    Math.abs(
      getDirectionAngle(
        world.projectiles[0].launchDirectionX,
        world.projectiles[0].launchDirectionY,
      ) + expectedHalfSpacing,
    ) < 1e-12,
  )
  assert.ok(
    Math.abs(
      getDirectionAngle(
        world.projectiles[1].launchDirectionX,
        world.projectiles[1].launchDirectionY,
      ) - expectedHalfSpacing,
    ) < 1e-12,
  )
  assert.equal(world.weaponLoadout.equipped[0].attackSequence, 1)
})

test('flamethrower damages only cone impacts without spawning gameplay projectiles', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'flamethrower-system',
    800,
    600,
    content,
    FLAMETHROWER_WEAPON_ID,
  )
  const inside = spawnEnemy(world, world.player.x + 100, world.player.y, 0)
  const behind = spawnEnemy(world, world.player.x - 100, world.player.y, 0)
  inside.phase = 'ACTIVE'
  behind.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runWeaponSystem(world, 50)
  assert.equal(world.glyphDamageQueue.count, 1)
  runDamageSystem(world)

  assert.equal(world.projectiles.length, 0)
  assert.equal(world.diagnostics.targetSearchCount, 0)
  assert.equal(world.flameEmitters.length, 1)
  assert.equal(world.glyphStore.getOwnerGlyphs(inside.id)[0].currentDurability, 0.875)
  assert.equal(world.glyphStore.getOwnerGlyphs(behind.id)[0].currentDurability, 1)

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)
  assert.equal(snapshot.flameEmitters.length, 1)
  assert.equal(snapshot.flameEmitters[0].particleCount, 12)
})

test('emits centered Cone streams as independent overlapping attack events', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'flamethrower-projectile-count',
    800,
    600,
    content,
    FLAMETHROWER_WEAPON_ID,
  )
  const target = spawnEnemy(world, world.player.x + 100, world.player.y, 0)
  target.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)
  installProjectileCount(world, 1)

  runWeaponSystem(world, 50)

  assert.equal(world.glyphDamageQueue.count, 2)
  assert.equal(world.flameEmitters.length, 2)
  assert.equal(world.diagnostics.attackEmissionCount, 2)
  const expectedHalfSpacing = (5 * Math.PI) / 180
  assert.ok(
    Math.abs(
      getDirectionAngle(
        world.flameEmitters[0].directionX,
        world.flameEmitters[0].directionY,
      ) + expectedHalfSpacing,
    ) < 1e-12,
  )
  assert.ok(
    Math.abs(
      getDirectionAngle(
        world.flameEmitters[1].directionX,
        world.flameEmitters[1].directionY,
      ) - expectedHalfSpacing,
    ) < 1e-12,
  )

  runDamageSystem(world)
  assert.equal(
    world.glyphStore.getOwnerGlyphs(target.id)[0].currentDurability,
    0.75,
  )
})

test('snapshots the resolved Knockback multiplier into projectile impacts', () => {
  const world = createWeaponTestWorld()
  const weapon = world.weaponLoadout.equipped[0]
  weapon.moduleSlots[0] = {
    moduleDefinitionId: 'module.knockback',
    rank: 1,
  }
  weapon.resolvedProfile = resolveWeaponProfile(
    getWeaponDefinition(world.content, weapon.definitionId),
    weapon.moduleSlots,
    world.content.weaponModuleDefinitionsById,
  )
  const enemy = spawnEnemy(
    world,
    world.player.x + 22,
    world.player.y,
    0,
  )
  enemy.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runWeaponSystem(world, 50)
  runCollisionSystem(world)
  runDamageSystem(world)

  const glyph = world.glyphStore.getOwnerGlyphs(enemy.id)[0]
  assert.equal(world.projectiles[0].impactStrengthMultiplier, 1.25)
  assert.equal(glyph.velocityX, 70 * 1.25)
  assert.equal(glyph.velocityY, 0)
})
