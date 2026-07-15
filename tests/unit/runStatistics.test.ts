import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { ORBIT_ENERGY_BALL_WEAPON_ID } from '../../src/game/content/weapons/orbitEnergyBallWeapon.ts'
import { PLAYER_ATTACK_VISUAL_ROLE } from '../../src/game/content/visuals/combatVisualTheme.ts'
import { DAMAGE_TARGET_MODE } from '../../src/game/glyph/localDamage.ts'
import { spawnProjectile } from '../../src/game/runtime/spawnProjectile.ts'
import { synchronizeEquippedWeaponStatistics } from '../../src/game/runtime/runStatistics.ts'
import { replaceWeapon } from '../../src/game/runtime/weaponLoadout.ts'
import { createWorldState, spawnEnemy } from '../../src/game/runtime/worldState.ts'
import { runCollisionSystem } from '../../src/game/systems/collisionSystem.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runDeathSystem } from '../../src/game/systems/deathSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'

function createWorld(seed: string) {
  return createWorldState(
    seed,
    800,
    600,
    prepareGameContent(),
    BASIC_PROJECTILE_WEAPON_ID,
  )
}

test('attributes only the actual clamped Glyph durability delta to the source Weapon Instance', () => {
  const world = createWorld('actual-weapon-damage')
  const weapon = world.weaponLoadout.equipped[0]
  const zombie = spawnEnemy(world, world.player.x, world.player.y, 0)
  zombie.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  world.glyphDamageQueue.enqueue({
    attackEventId: 1,
    sourceWeaponInstanceId: weapon.id,
    visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
    primaryScope: 'LOCKED_OWNER',
    ownerId: zombie.id,
    shapeKind: 'CIRCLE',
    shapeX: zombie.x,
    shapeY: zombie.y,
    shapeRadius: 20,
    shapeDirectionX: 0,
    shapeDirectionY: 0,
    shapeRange: 0,
    shapeHalfAngleRadians: 0,
    targetMode: DAMAGE_TARGET_MODE.SINGLE,
    amount: 99,
    impactStrengthMultiplier: 1,
    impactDirectionX: 1,
    impactDirectionY: 0,
  })

  runDamageSystem(world)

  assert.equal(
    world.runStatistics.weaponByInstanceId.get(weapon.id)?.totalDamage,
    1,
  )
})

test('keeps an in-flight attack attributed to its retired Weapon Instance', () => {
  const world = createWorld('retired-in-flight-attribution')
  const retiredWeapon = world.weaponLoadout.equipped[0]
  const zombie = spawnEnemy(world, world.player.x, world.player.y, 0)
  zombie.phase = 'ACTIVE'
  spawnProjectile(world, {
    sourceWeaponInstanceId: retiredWeapon.id,
    x: zombie.x,
    y: zombie.y,
    directionX: 1,
    directionY: 0,
    profile: retiredWeapon.resolvedProfile,
    targetEnemyId: zombie.id,
  })
  const replacement = replaceWeapon(
    world.weaponLoadout,
    world.content.weaponDefinitionsById[ORBIT_ENERGY_BALL_WEAPON_ID],
    retiredWeapon.id,
  )
  synchronizeEquippedWeaponStatistics(
    world.runStatistics,
    world.weaponLoadout,
  )
  runEnemySpatialIndexSystem(world)

  runCollisionSystem(world)
  runDamageSystem(world)

  assert.equal(
    world.runStatistics.weaponByInstanceId.get(retiredWeapon.id)?.totalDamage,
    1,
  )
  assert.equal(
    world.runStatistics.weaponByInstanceId.get(replacement.id)?.totalDamage,
    0,
  )
})

test('counts ordinary enemies and Boss encounters only at their formal death transition', () => {
  const world = createWorld('formal-kill-count')
  const zombie = spawnEnemy(world, world.player.x, world.player.y, 0)
  zombie.phase = 'ACTIVE'
  const zombieGlyph = world.glyphStore.getOwnerGlyphs(zombie.id)[0]
  world.glyphStore.applyDamage(zombieGlyph.id, zombieGlyph.currentDurability)

  runDeathSystem(world)
  assert.equal(world.runStatistics.killCount, 0)

  runDeathSystem(world, zombie.collapseDurationMs)
  runDeathSystem(world, zombie.collapseDurationMs)
  assert.equal(world.runStatistics.killCount, 1)

  const slime = spawnEnemy(
    world,
    world.player.x,
    world.player.y,
    0,
    world.content.slimeBossDefinition,
  )
  slime.phase = 'ACTIVE'
  for (const glyph of world.glyphStore.getOwnerGlyphs(slime.id)) {
    world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
  }

  runDeathSystem(world)
  assert.equal(world.runStatistics.killCount, 1)

  runDeathSystem(world, slime.collapseDurationMs)
  runDeathSystem(world, slime.collapseDurationMs)
  assert.equal(world.runStatistics.killCount, 2)
})
