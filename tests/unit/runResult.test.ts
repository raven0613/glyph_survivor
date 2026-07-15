import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { FLAMETHROWER_WEAPON_ID } from '../../src/game/content/weapons/flamethrowerWeapon.ts'
import { ORBIT_ENERGY_BALL_WEAPON_ID } from '../../src/game/content/weapons/orbitEnergyBallWeapon.ts'
import { finalizeRunResult } from '../../src/game/runtime/runResult.ts'
import {
  advanceEquippedWeaponTime,
  recordWeaponDamage,
  synchronizeEquippedWeaponStatistics,
} from '../../src/game/runtime/runStatistics.ts'
import {
  equipWeapon,
  replaceWeapon,
} from '../../src/game/runtime/weaponLoadout.ts'
import { createWorldState } from '../../src/game/runtime/worldState.ts'

function createWorld(seed: string) {
  return createWorldState(
    seed,
    800,
    600,
    prepareGameContent(),
    BASIC_PROJECTILE_WEAPON_ID,
  )
}

test('tracks equipped RUNNING time and isolates replacement Weapon Instance damage', () => {
  const world = createWorld('replacement-stat-isolation')
  const initialWeapon = world.weaponLoadout.equipped[0]
  const flame = equipWeapon(
    world.weaponLoadout,
    world.content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
  )
  advanceEquippedWeaponTime(
    world.runStatistics,
    world.weaponLoadout,
    1_000,
  )
  recordWeaponDamage(world.runStatistics, initialWeapon.id, 4)
  recordWeaponDamage(world.runStatistics, flame.id, 6)

  const replacement = replaceWeapon(
    world.weaponLoadout,
    world.content.weaponDefinitionsById[ORBIT_ENERGY_BALL_WEAPON_ID],
    initialWeapon.id,
  )
  synchronizeEquippedWeaponStatistics(
    world.runStatistics,
    world.weaponLoadout,
  )
  advanceEquippedWeaponTime(
    world.runStatistics,
    world.weaponLoadout,
    1_000,
  )
  recordWeaponDamage(world.runStatistics, initialWeapon.id, 3)

  const result = finalizeRunResult(world)

  assert.deepEqual(
    result.weapons.map(({ instanceId }) => instanceId),
    [replacement.id, flame.id],
  )
  assert.equal(result.weapons[0].totalDamage, 0)
  assert.equal(result.weapons[0].equippedGameplayTimeMs, 1_000)
  assert.equal(result.weapons[0].averageEquippedDps, 0)
  assert.equal(result.weapons[1].totalDamage, 6)
  assert.equal(result.weapons[1].equippedGameplayTimeMs, 2_000)
  assert.equal(result.weapons[1].averageEquippedDps, 3)
  assert.equal(result.weapons[1].isHighestDamage, true)
  assert.equal(
    world.runStatistics.weaponByInstanceId.get(initialWeapon.id)?.totalDamage,
    7,
  )
})

test('uses acquisition order for a positive damage tie and awards no crown at all zero', () => {
  const tiedWorld = createWorld('positive-damage-tie')
  const first = tiedWorld.weaponLoadout.equipped[0]
  const second = equipWeapon(
    tiedWorld.weaponLoadout,
    tiedWorld.content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
  )
  synchronizeEquippedWeaponStatistics(
    tiedWorld.runStatistics,
    tiedWorld.weaponLoadout,
  )
  recordWeaponDamage(tiedWorld.runStatistics, first.id, 5)
  recordWeaponDamage(tiedWorld.runStatistics, second.id, 5)

  const tiedResult = finalizeRunResult(tiedWorld)

  assert.equal(tiedResult.weapons[0].isHighestDamage, true)
  assert.equal(tiedResult.weapons[1].isHighestDamage, false)

  const zeroWorld = createWorld('zero-damage-no-crown')
  advanceEquippedWeaponTime(
    zeroWorld.runStatistics,
    zeroWorld.weaponLoadout,
    1_000,
  )

  const zeroResult = finalizeRunResult(zeroWorld)

  assert.equal(zeroResult.weapons[0].averageEquippedDps, 0)
  assert.equal(zeroResult.weapons[0].isHighestDamage, false)
})

test('creates one deeply immutable death-time result with Module Rank summaries', () => {
  const world = createWorld('immutable-run-result')
  const weapon = world.weaponLoadout.equipped[0]
  weapon.moduleSlots[0] = {
    moduleDefinitionId: world.content.weaponModuleDefinitions[0].id,
    rank: 1,
  }
  world.runTimeMs = 12_345
  world.player.level = 4
  world.runStatistics.killCount = 7

  const result = finalizeRunResult(world)
  weapon.moduleSlots[0] = null
  const repeatedResult = finalizeRunResult(world)

  assert.equal(result, repeatedResult)
  assert.equal(result.gameplayTimeMs, 12_345)
  assert.equal(result.killCount, 7)
  assert.equal(result.finalPlayerLevel, 4)
  assert.equal(result.weapons[0].moduleSlots[0]?.rank, 1)
  assert.equal(result.weapons[0].averageEquippedDps, null)
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.weapons), true)
  assert.equal(Object.isFrozen(result.weapons[0]), true)
  assert.equal(Object.isFrozen(result.weapons[0].moduleSlots), true)
  assert.equal(Object.isFrozen(result.weapons[0].moduleSlots[0]), true)
})
