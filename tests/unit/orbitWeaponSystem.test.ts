import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { getWeaponDefinition } from '../../src/game/content/gameContent.ts'
import { ORBIT_ENERGY_BALL_WEAPON_ID } from '../../src/game/content/weapons/orbitEnergyBallWeapon.ts'
import { PLAYER_ATTACK_VISUAL_ROLE } from '../../src/game/content/visuals/combatVisualTheme.ts'
import { PROTOTYPE_WEAPON_MODULE_ID } from '../../src/game/content/upgrades/prototypeWeaponModules.ts'
import { createWorldState, spawnEnemy } from '../../src/game/runtime/worldState.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runOrbitWeaponSystem } from '../../src/game/systems/orbitWeaponSystem.ts'
import { resolveWeaponProfile } from '../../src/game/systems/resolveWeaponProfile.ts'

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

function installRange(
  world: ReturnType<typeof createOrbitWorld>,
  rank: number,
): void {
  const weapon = world.weaponLoadout.equipped[0]
  weapon.moduleSlots[0] = {
    moduleDefinitionId: PROTOTYPE_WEAPON_MODULE_ID.RANGE,
    rank,
  }
  weapon.resolvedProfile = resolveWeaponProfile(
    getWeaponDefinition(world.content, weapon.definitionId),
    weapon.moduleSlots,
    world.content.weaponModuleDefinitionsById,
  )
  weapon.profileRevision += 1
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
  assert.equal(orbit.visualRoleId, PLAYER_ATTACK_VISUAL_ROLE.ORBIT_ENERGY)
  assert.equal(orbit.phaseRadians, Math.PI * 0.45)
  assert.ok(Math.abs(orbit.x - (first.player.x + Math.cos(Math.PI * 0.45) * 80)) < 1e-9)
  assert.ok(Math.abs(orbit.y - (first.player.y + Math.sin(Math.PI * 0.45) * 80)) < 1e-9)

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(first, snapshot, 1)
  assert.equal(snapshot.orbits.length, 1)
  assert.equal(snapshot.orbits[0].id, orbit.id)
  assert.equal(snapshot.orbits[0].glyphFrame, orbit.glyphFrame)
})

test('keeps Projectile Count balls evenly spaced around the current base phase', () => {
  const world = createOrbitWorld('multi-orbit')
  runOrbitWeaponSystem(world, 250)
  const weapon = world.weaponLoadout.equipped[0]
  weapon.moduleSlots[0] = {
    moduleDefinitionId: 'module.projectile-count',
    rank: 2,
  }
  weapon.resolvedProfile = resolveWeaponProfile(
    getWeaponDefinition(world.content, weapon.definitionId),
    weapon.moduleSlots,
    world.content.weaponModuleDefinitionsById,
  )

  runOrbitWeaponSystem(world, 0)

  assert.equal(world.orbitAttacks.length, 3)
  const basePhase = world.orbitAttacks[0].phaseRadians
  const normalizedOffsets = world.orbitAttacks.map(({ phaseRadians }) =>
    (phaseRadians - basePhase + Math.PI * 2) % (Math.PI * 2),
  )
  assert.ok(Math.abs(normalizedOffsets[0]) < 1e-12)
  assert.ok(Math.abs(normalizedOffsets[1] - (Math.PI * 2) / 3) < 1e-12)
  assert.ok(Math.abs(normalizedOffsets[2] - (Math.PI * 4) / 3) < 1e-12)
  assert.equal(
    new Set(
      world.orbitAttacks.map(({ contactStateByOwner }) =>
        contactStateByOwner,
      ),
    ).size,
    3,
  )
})

test('sweeps Range deterministically between base and maximum orbit radii', () => {
  const world = createOrbitWorld('range-radial-sweep')
  installRange(world, 3)

  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  assert.equal(orbit.currentRadius, 80)
  assert.equal(orbit.radialPhaseRadians, 0)

  runOrbitWeaponSystem(world, 1_000 / (0.9 * 2))

  assert.ok(Math.abs(orbit.radialPhaseRadians - Math.PI) < 1e-12)
  assert.ok(Math.abs(orbit.currentRadius - 120) < 1e-9)
  assert.ok(
    Math.abs(Math.hypot(orbit.x - world.player.x, orbit.y - world.player.y) - 120) <
      1e-9,
  )
  assert.equal(orbit.damageRadius, 16)
  assert.equal(orbit.rehitCooldownMs, 200)
})

test('offsets multi-ball radial phases from the shared deterministic phase', () => {
  const world = createOrbitWorld('range-multi-ball-radial-phase')
  const weapon = world.weaponLoadout.equipped[0]
  weapon.moduleSlots[0] = {
    moduleDefinitionId: 'module.projectile-count',
    rank: 2,
  }
  weapon.moduleSlots[1] = {
    moduleDefinitionId: PROTOTYPE_WEAPON_MODULE_ID.RANGE,
    rank: 2,
  }
  weapon.resolvedProfile = resolveWeaponProfile(
    getWeaponDefinition(world.content, weapon.definitionId),
    weapon.moduleSlots,
    world.content.weaponModuleDefinitionsById,
  )
  weapon.profileRevision += 1

  runOrbitWeaponSystem(world, 0)

  assert.equal(world.orbitAttacks.length, 3)
  assert.ok(Math.abs(world.orbitAttacks[0].currentRadius - 80) < 1e-9)
  assert.ok(Math.abs(world.orbitAttacks[1].currentRadius - 98) < 1e-9)
  assert.ok(Math.abs(world.orbitAttacks[2].currentRadius - 98) < 1e-9)
  assert.ok(
    Math.abs(world.orbitAttacks[1].radialPhaseRadians - (Math.PI * 2) / 3) <
      1e-12,
  )
  assert.ok(
    Math.abs(world.orbitAttacks[2].radialPhaseRadians - (Math.PI * 4) / 3) <
      1e-12,
  )
})

test('detects the earliest Glyph contact across the complete orbit sweep', () => {
  const world = createOrbitWorld('range-swept-contact')
  installRange(world, 1)
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const nextPhase = 0.9 * Math.PI * 2 * 0.25
  const nextRadius = 80 + (92 - 80) * ((1 - Math.cos(nextPhase)) / 2)
  const nextX = world.player.x + Math.cos(nextPhase) * nextRadius
  const nextY = world.player.y + Math.sin(nextPhase) * nextRadius
  const target = spawnEnemy(
    world,
    (orbit.x + nextX) / 2,
    (orbit.y + nextY) / 2,
    0,
  )
  target.phase = 'ACTIVE'
  const targetXBefore = target.x
  const targetYBefore = target.y
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 250)
  runDamageSystem(world)

  assert.equal(
    world.glyphStore.getOwnerGlyphs(target.id)[0].currentDurability,
    0.4,
  )
  assert.ok(
    Math.hypot(target.x - targetXBefore, target.y - targetYBefore) > 0,
  )
  assert.ok(world.diagnostics.orbitSweepCandidateCount > 0)
  assert.ok(world.diagnostics.orbitSweepPreciseTestCount > 0)
})

test('rebases a Range profile revision without creating a false attack sweep', () => {
  const world = createOrbitWorld('range-revision-rebase')
  runOrbitWeaponSystem(world, 1_000 / (0.9 * 2))
  const [orbit] = world.orbitAttacks
  const oldX = orbit.x
  const oldY = orbit.y
  const target = spawnEnemy(world, oldX, oldY, 0)
  target.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  installRange(world, 3)
  runOrbitWeaponSystem(world, 0)

  assert.ok(Math.abs(orbit.currentRadius - 120) < 1e-9)
  assert.equal(orbit.previousX, orbit.x)
  assert.equal(orbit.previousY, orbit.y)
  assert.equal(world.glyphDamageQueue.count, 0)
  assert.equal(orbit.contactStateByOwner.has(target.id), false)
})

test('throttles continuous overlap per owner only after Damage System confirms an Impact Cell', () => {
  const world = createOrbitWorld()
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const target = spawnEnemy(world, orbit.x, orbit.y, 0)
  target.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 1)
  assert.equal(
    orbit.contactStateByOwner.get(target.id)?.nextContinuousHitTimeMs,
    0,
  )
  runDamageSystem(world)
  assert.equal(
    orbit.contactStateByOwner.get(target.id)?.nextContinuousHitTimeMs,
    200,
  )

  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 0)
  world.runTimeMs = 199
  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 0)
  world.runTimeMs = 200
  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 1)
})

test('tracks the continuous-contact throttle independently for each owner', () => {
  const world = createOrbitWorld('orbit-per-owner-throttle')
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const first = spawnEnemy(world, orbit.x, orbit.y - 10, 0)
  const second = spawnEnemy(world, orbit.x, orbit.y + 10, 0)
  first.phase = 'ACTIVE'
  second.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 2)
  runDamageSystem(world)

  assert.equal(
    orbit.contactStateByOwner.get(first.id)?.nextContinuousHitTimeMs,
    200,
  )
  assert.equal(
    orbit.contactStateByOwner.get(second.id)?.nextContinuousHitTimeMs,
    200,
  )
})

test('commits the orbit throttle when the confirmed Impact Cell is a Husk', () => {
  const world = createOrbitWorld('orbit-husk-impact-throttle')
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const target = spawnEnemy(world, orbit.x, orbit.y, 0)
  target.phase = 'ACTIVE'
  const [glyph] = world.glyphStore.getOwnerGlyphs(target.id)
  world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 0)
  runDamageSystem(world)

  assert.equal(glyph.currentDurability, 0)
  assert.equal(
    orbit.contactStateByOwner.get(target.id)?.nextContinuousHitTimeMs,
    200,
  )
})

test('lets an orbit ball hit immediately after leaving and re-entering before 200ms', () => {
  const world = createOrbitWorld('orbit-contact-reentry')
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const target = spawnEnemy(world, orbit.x, orbit.y, 0)
  target.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 0)
  runDamageSystem(world)

  target.x = orbit.x + 100
  target.y = orbit.y
  target.previousX = target.x
  target.previousY = target.y
  runEnemySpatialIndexSystem(world)
  world.runTimeMs = 25
  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 0)

  target.x = orbit.x
  target.y = orbit.y
  target.previousX = target.x
  target.previousY = target.y
  runEnemySpatialIndexSystem(world)
  world.runTimeMs = 50
  runOrbitWeaponSystem(world, 0)

  assert.equal(world.glyphDamageQueue.count, 1)
})

test('does not start the orbit throttle when a queued contact no longer yields Impact Cells', () => {
  const world = createOrbitWorld('orbit-contact-no-impact')
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const target = spawnEnemy(world, orbit.x, orbit.y, 0)
  target.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 1)

  target.phase = 'COLLAPSING'
  target.x = orbit.x + 100
  target.previousX = target.x
  runDamageSystem(world)
  assert.equal(
    orbit.contactStateByOwner.get(target.id)?.nextContinuousHitTimeMs,
    0,
  )

  target.phase = 'ACTIVE'
  target.x = orbit.x
  target.previousX = target.x
  runEnemySpatialIndexSystem(world)
  runOrbitWeaponSystem(world, 0)

  assert.equal(world.glyphDamageQueue.count, 1)
})

test('detects a moving owner crossing a stationary orbit ball with relative sweep', () => {
  const world = createOrbitWorld('orbit-relative-owner-sweep')
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const target = spawnEnemy(world, orbit.x + 40, orbit.y, 0)
  target.phase = 'ACTIVE'
  target.previousX = orbit.x - 40
  target.previousY = orbit.y
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 0)
  runDamageSystem(world)

  assert.equal(
    world.glyphStore.getOwnerGlyphs(target.id)[0].currentDurability,
    0.4,
  )
  assert.equal(
    orbit.contactStateByOwner.get(target.id)?.nextContinuousHitTimeMs,
    200,
  )
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

  assert.equal(bat.x, orbit.x + 44)
  assert.equal(bat.y, orbit.y)
  assert.equal(bat.x + batGlyphs[2].localX, huskWorldXBefore + 20)
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
