import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { ORBIT_ENERGY_BALL_WEAPON_ID } from '../../src/game/content/weapons/orbitEnergyBallWeapon.ts'
import { createWorldState, spawnEnemy } from '../../src/game/runtime/worldState.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runOrbitWeaponSystem } from '../../src/game/systems/orbitWeaponSystem.ts'

function createOrbitWorld(seed = 'orbit-system') {
  const content = prepareGameContent()
  return createWorldState(
    seed,
    800,
    600,
    content,
    ORBIT_ENERGY_BALL_WEAPON_ID,
  )
}

test('advances a deterministic owner-relative orbit without projectiles', () => {
  const first = createOrbitWorld('same-orbit')
  const second = createOrbitWorld('same-orbit')

  runOrbitWeaponSystem(first, 250)
  runOrbitWeaponSystem(second, 250)

  assert.equal(first.projectiles.length, 0)
  assert.equal(first.orbitAttacks.length, 1)
  assert.deepEqual(first.orbitAttacks, second.orbitAttacks)
  const [orbit] = first.orbitAttacks
  assert.equal(orbit.phaseRadians, Math.PI * 0.45)
  assert.ok(Math.abs(orbit.x - (first.player.x + Math.cos(Math.PI * 0.45) * 80)) < 1e-9)
  assert.ok(Math.abs(orbit.y - (first.player.y + Math.sin(Math.PI * 0.45) * 80)) < 1e-9)

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(first, snapshot, 1)
  assert.equal(snapshot.orbits.length, 1)
  assert.equal(snapshot.orbits[0].id, orbit.id)
  assert.equal(snapshot.orbits[0].glyphFrame, orbit.glyphFrame)
})

test('gates repeat hits per owner and starts cooldown only for a precise impact', () => {
  const world = createOrbitWorld()
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const nearMiss = spawnEnemy(
    world,
    orbit.x + orbit.damageRadius + 30,
    orbit.y,
    0,
  )
  nearMiss.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 0)

  nearMiss.x = orbit.x
  nearMiss.previousX = orbit.x
  runEnemySpatialIndexSystem(world)
  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 1)

  const secondOwner = spawnEnemy(world, orbit.x, orbit.y, 0)
  secondOwner.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)
  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 2)

  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 2)
  world.runTimeMs = 499
  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 2)
  world.runTimeMs = 500
  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 4)
})

test('applies outward whole-body knockback while local damage stays shape-based', () => {
  const world = createOrbitWorld()
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const bat = spawnEnemy(
    world,
    orbit.x + 24,
    orbit.y,
    0,
    world.content.ordinaryEnemyDefinitions[2],
  )
  bat.phase = 'ACTIVE'
  const batGlyphs = world.glyphStore.getOwnerGlyphs(bat.id)
  world.glyphStore.applyDamage(batGlyphs[2].id, 1)
  const huskWorldXBefore = bat.x + batGlyphs[2].localX
  const localPositions = batGlyphs
    .map(({ localX, localY }) => [localX, localY])
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 0)
  runDamageSystem(world)

  assert.equal(bat.x, orbit.x + 40)
  assert.equal(bat.y, orbit.y)
  assert.equal(bat.x + batGlyphs[2].localX, huskWorldXBefore + 16)
  assert.deepEqual(
    world.glyphStore
      .getOwnerGlyphs(bat.id)
      .map(({ localX, localY }) => [localX, localY]),
    localPositions,
  )
  assert.deepEqual(
    world.glyphStore
      .getOwnerGlyphs(bat.id)
      .map(({ currentDurability }) => currentDurability),
    [0.4, 0.4, 0],
  )
})
