import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import { normalizeNonNegativeGameplayNumber } from '../../src/game/core/gameplayNumber.ts'
import {
  getWeaponDefinition,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import { ORBIT_ENERGY_BALL_WEAPON_ID } from '../../src/game/content/weapons/orbitEnergyBallWeapon.ts'
import { ATTACK_PATTERN } from '../../src/game/content/weapons/weaponDefinition.ts'
import { PLAYER_ATTACK_VISUAL_ROLE } from '../../src/game/content/visuals/combatVisualTheme.ts'
import { PROTOTYPE_WEAPON_MODULE_ID } from '../../src/game/content/upgrades/prototypeWeaponModules.ts'
import { createWorldState, spawnEnemy } from '../../src/game/runtime/worldState.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runOrbitWeaponSystem } from '../../src/game/systems/orbitWeaponSystem.ts'
import {
  resolveWeaponProfile,
  type ResolvedOrbitWeaponProfile,
} from '../../src/game/systems/resolveWeaponProfile.ts'

const FULL_CIRCLE_RADIANS = Math.PI * 2
const MILLISECONDS_PER_SECOND = 1_000

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

type OrbitWorld = ReturnType<typeof createOrbitWorld>

function getResolvedOrbitProfile(
  world: OrbitWorld,
): ResolvedOrbitWeaponProfile {
  const profile = world.weaponLoadout.equipped[0]?.resolvedProfile
  if (profile?.attackPattern.kind !== ATTACK_PATTERN.PERSISTENT_ORBIT) {
    throw new Error('Orbit test world must equip a persistent orbit weapon.')
  }
  return profile
}

function getDurabilityAfterConfiguredHit(
  currentDurability: number,
  damageAmount: number,
): number {
  return normalizeNonNegativeGameplayNumber(
    Math.max(0, currentDurability - damageAmount),
  )
}

function assertApproximatelyEqual(
  actual: number,
  expected: number,
  tolerance = 1e-9,
): void {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}.`,
  )
}

function getFirstConfiguredModuleRank(
  world: OrbitWorld,
  moduleDefinitionId: string,
): number {
  const definition = world.content.weaponModuleDefinitionsById[
    moduleDefinitionId
  ]
  const rank = definition?.ranks[0]
  if (!rank) {
    throw new Error(
      `Orbit test requires at least one configured rank for ${moduleDefinitionId}.`,
    )
  }
  return rank.rank
}

function getLastConfiguredModuleRank(
  world: OrbitWorld,
  moduleDefinitionId: string,
): number {
  const definition = world.content.weaponModuleDefinitionsById[
    moduleDefinitionId
  ]
  if (!definition) {
    throw new Error(
      `Orbit test requires a configured definition for ${moduleDefinitionId}.`,
    )
  }
  const rank = definition.ranks[definition.ranks.length - 1]
  if (!rank) {
    throw new Error(
      `Orbit test requires at least one configured rank for ${moduleDefinitionId}.`,
    )
  }
  return rank.rank
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
  const elapsedMs = 250
  const profile = getResolvedOrbitProfile(first)

  runOrbitWeaponSystem(first, elapsedMs)
  runOrbitWeaponSystem(second, elapsedMs)

  assert.equal(first.projectiles.length, 0)
  assert.equal(first.orbitAttacks.length, 1)
  assert.deepEqual(first.orbitAttacks, second.orbitAttacks)
  const [orbit] = first.orbitAttacks
  const expectedPhase =
    (profile.attackPattern.angularSpeedRevolutionsPerSecond *
      FULL_CIRCLE_RADIANS *
      (elapsedMs / MILLISECONDS_PER_SECOND)) %
    FULL_CIRCLE_RADIANS
  assert.equal(orbit.visualRoleId, PLAYER_ATTACK_VISUAL_ROLE.ORBIT_ENERGY)
  assertApproximatelyEqual(orbit.phaseRadians, expectedPhase)
  assertApproximatelyEqual(
    orbit.x,
    first.player.x +
      Math.cos(expectedPhase) * profile.attackPattern.orbitRadius,
  )
  assertApproximatelyEqual(
    orbit.y,
    first.player.y +
      Math.sin(expectedPhase) * profile.attackPattern.orbitRadius,
  )

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
    moduleDefinitionId: PROTOTYPE_WEAPON_MODULE_ID.PROJECTILE_COUNT,
    rank: getLastConfiguredModuleRank(
      world,
      PROTOTYPE_WEAPON_MODULE_ID.PROJECTILE_COUNT,
    ),
  }
  weapon.resolvedProfile = resolveWeaponProfile(
    getWeaponDefinition(world.content, weapon.definitionId),
    weapon.moduleSlots,
    world.content.weaponModuleDefinitionsById,
  )

  runOrbitWeaponSystem(world, 0)

  const profile = getResolvedOrbitProfile(world)
  const ballCount = profile.attackPattern.ballCount
  assert.equal(world.orbitAttacks.length, ballCount)
  const basePhase = world.orbitAttacks[0].phaseRadians
  const normalizedOffsets = world.orbitAttacks.map(({ phaseRadians }) =>
    (phaseRadians - basePhase + FULL_CIRCLE_RADIANS) %
      FULL_CIRCLE_RADIANS,
  )
  for (const [index, offset] of normalizedOffsets.entries()) {
    assertApproximatelyEqual(
      offset,
      (FULL_CIRCLE_RADIANS * index) / ballCount,
      1e-12,
    )
  }
  assert.equal(
    new Set(
      world.orbitAttacks.map(({ contactStateByOwner }) =>
        contactStateByOwner,
      ),
    ).size,
    ballCount,
  )
})

test('sweeps Range deterministically between base and maximum orbit radii', () => {
  const world = createOrbitWorld('range-radial-sweep')
  installRange(
    world,
    getLastConfiguredModuleRank(
      world,
      PROTOTYPE_WEAPON_MODULE_ID.RANGE,
    ),
  )
  const profile = getResolvedOrbitProfile(world)

  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  assert.equal(orbit.currentRadius, profile.attackPattern.orbitRadius)
  assert.equal(orbit.radialPhaseRadians, 0)

  runOrbitWeaponSystem(
    world,
    MILLISECONDS_PER_SECOND /
      (profile.attackPattern.angularSpeedRevolutionsPerSecond * 2),
  )

  assertApproximatelyEqual(orbit.radialPhaseRadians, Math.PI, 1e-12)
  assertApproximatelyEqual(
    orbit.currentRadius,
    profile.attackPattern.maximumOrbitRadius,
  )
  assertApproximatelyEqual(
    Math.hypot(orbit.x - world.player.x, orbit.y - world.player.y),
    profile.attackPattern.maximumOrbitRadius,
  )
  assert.equal(orbit.damageRadius, profile.damageShape.radius)
  assert.equal(orbit.rehitCooldownMs, profile.rehitCooldownMs)
})

test('offsets multi-ball radial phases from the shared deterministic phase', () => {
  const world = createOrbitWorld('range-multi-ball-radial-phase')
  const weapon = world.weaponLoadout.equipped[0]
  weapon.moduleSlots[0] = {
    moduleDefinitionId: PROTOTYPE_WEAPON_MODULE_ID.PROJECTILE_COUNT,
    rank: getLastConfiguredModuleRank(
      world,
      PROTOTYPE_WEAPON_MODULE_ID.PROJECTILE_COUNT,
    ),
  }
  weapon.moduleSlots[1] = {
    moduleDefinitionId: PROTOTYPE_WEAPON_MODULE_ID.RANGE,
    rank: getFirstConfiguredModuleRank(
      world,
      PROTOTYPE_WEAPON_MODULE_ID.RANGE,
    ),
  }
  weapon.resolvedProfile = resolveWeaponProfile(
    getWeaponDefinition(world.content, weapon.definitionId),
    weapon.moduleSlots,
    world.content.weaponModuleDefinitionsById,
  )
  weapon.profileRevision += 1

  runOrbitWeaponSystem(world, 0)

  const profile = getResolvedOrbitProfile(world)
  const ballCount = profile.attackPattern.ballCount
  assert.equal(world.orbitAttacks.length, ballCount)
  for (const [index, orbit] of world.orbitAttacks.entries()) {
    const radialPhase = (FULL_CIRCLE_RADIANS * index) / ballCount
    const expectedRadius =
      profile.attackPattern.orbitRadius +
      (profile.attackPattern.maximumOrbitRadius -
        profile.attackPattern.orbitRadius) *
        ((1 - Math.cos(radialPhase)) / 2)
    assertApproximatelyEqual(orbit.radialPhaseRadians, radialPhase, 1e-12)
    assertApproximatelyEqual(orbit.currentRadius, expectedRadius)
  }
})

test('detects the earliest Glyph contact across the complete orbit sweep', () => {
  const world = createOrbitWorld('range-swept-contact')
  installRange(
    world,
    getFirstConfiguredModuleRank(
      world,
      PROTOTYPE_WEAPON_MODULE_ID.RANGE,
    ),
  )
  const profile = getResolvedOrbitProfile(world)
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const elapsedMs = 250
  const nextPhase =
    profile.attackPattern.angularSpeedRevolutionsPerSecond *
    FULL_CIRCLE_RADIANS *
    (elapsedMs / MILLISECONDS_PER_SECOND)
  const nextRadius =
    profile.attackPattern.orbitRadius +
    (profile.attackPattern.maximumOrbitRadius -
      profile.attackPattern.orbitRadius) *
      ((1 - Math.cos(nextPhase)) / 2)
  const nextX = world.player.x + Math.cos(nextPhase) * nextRadius
  const nextY = world.player.y + Math.sin(nextPhase) * nextRadius
  const target = spawnEnemy(
    world,
    (orbit.x + nextX) / 2,
    (orbit.y + nextY) / 2,
    0,
  )
  target.phase = 'ACTIVE'
  const [targetGlyph] = world.glyphStore.getOwnerGlyphs(target.id)
  const durabilityBefore = targetGlyph.currentDurability
  const targetXBefore = target.x
  const targetYBefore = target.y
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, elapsedMs)
  runDamageSystem(world)

  assert.equal(
    targetGlyph.currentDurability,
    getDurabilityAfterConfiguredHit(durabilityBefore, profile.damageAmount),
  )
  assert.ok(
    Math.hypot(target.x - targetXBefore, target.y - targetYBefore) > 0,
  )
  assert.ok(world.diagnostics.orbitSweepCandidateCount > 0)
  assert.ok(world.diagnostics.orbitSweepPreciseTestCount > 0)
})

test('rebases a Range profile revision without creating a false attack sweep', () => {
  const world = createOrbitWorld('range-revision-rebase')
  const baseProfile = getResolvedOrbitProfile(world)
  runOrbitWeaponSystem(
    world,
    MILLISECONDS_PER_SECOND /
      (baseProfile.attackPattern.angularSpeedRevolutionsPerSecond * 2),
  )
  const [orbit] = world.orbitAttacks
  const oldX = orbit.x
  const oldY = orbit.y
  const target = spawnEnemy(world, oldX, oldY, 0)
  target.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  installRange(
    world,
    getLastConfiguredModuleRank(
      world,
      PROTOTYPE_WEAPON_MODULE_ID.RANGE,
    ),
  )
  const rangeProfile = getResolvedOrbitProfile(world)
  runOrbitWeaponSystem(world, 0)

  assertApproximatelyEqual(
    orbit.currentRadius,
    rangeProfile.attackPattern.maximumOrbitRadius,
  )
  assert.equal(orbit.previousX, orbit.x)
  assert.equal(orbit.previousY, orbit.y)
  assert.equal(world.glyphDamageQueue.count, 0)
  assert.equal(orbit.contactStateByOwner.has(target.id), false)
})

test('throttles continuous overlap per owner only after Damage System confirms an Impact Cell', () => {
  const world = createOrbitWorld()
  const profile = getResolvedOrbitProfile(world)
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
    profile.rehitCooldownMs,
  )

  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 0)
  world.runTimeMs = profile.rehitCooldownMs / 2
  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 0)
  world.runTimeMs = profile.rehitCooldownMs
  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 1)
})

test('tracks the continuous-contact throttle independently for each owner', () => {
  const world = createOrbitWorld('orbit-per-owner-throttle')
  const profile = getResolvedOrbitProfile(world)
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
    profile.rehitCooldownMs,
  )
  assert.equal(
    orbit.contactStateByOwner.get(second.id)?.nextContinuousHitTimeMs,
    profile.rehitCooldownMs,
  )
})

test('commits the orbit throttle when the confirmed Impact Cell is a Husk', () => {
  const world = createOrbitWorld('orbit-husk-impact-throttle')
  const profile = getResolvedOrbitProfile(world)
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
    profile.rehitCooldownMs,
  )
})

test('lets an orbit ball hit immediately after leaving and re-entering before the configured cooldown', () => {
  const world = createOrbitWorld('orbit-contact-reentry')
  const profile = getResolvedOrbitProfile(world)
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const target = spawnEnemy(world, orbit.x, orbit.y, 0)
  target.phase = 'ACTIVE'
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 0)
  runDamageSystem(world)

  target.x = orbit.x + orbit.damageRadius * 10
  target.y = orbit.y
  target.previousX = target.x
  target.previousY = target.y
  runEnemySpatialIndexSystem(world)
  world.runTimeMs = profile.rehitCooldownMs / 4
  runOrbitWeaponSystem(world, 0)
  assert.equal(world.glyphDamageQueue.count, 0)

  target.x = orbit.x
  target.y = orbit.y
  target.previousX = target.x
  target.previousY = target.y
  runEnemySpatialIndexSystem(world)
  world.runTimeMs = profile.rehitCooldownMs / 2
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
  target.x = orbit.x + orbit.damageRadius * 10
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
  const profile = getResolvedOrbitProfile(world)
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const crossingDistance = orbit.damageRadius * 2.5
  const target = spawnEnemy(world, orbit.x + crossingDistance, orbit.y, 0)
  target.phase = 'ACTIVE'
  const [targetGlyph] = world.glyphStore.getOwnerGlyphs(target.id)
  const durabilityBefore = targetGlyph.currentDurability
  target.previousX = orbit.x - crossingDistance
  target.previousY = orbit.y
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 0)
  runDamageSystem(world)

  assert.equal(
    targetGlyph.currentDurability,
    getDurabilityAfterConfiguredHit(durabilityBefore, profile.damageAmount),
  )
  assert.equal(
    orbit.contactStateByOwner.get(target.id)?.nextContinuousHitTimeMs,
    profile.rehitCooldownMs,
  )
})

test('applies outward whole-body knockback while local damage stays shape-based', () => {
  const world = createOrbitWorld()
  const profile = getResolvedOrbitProfile(world)
  runOrbitWeaponSystem(world, 0)
  const [orbit] = world.orbitAttacks
  const bat = spawnEnemy(
    world,
    orbit.x + orbit.damageRadius * 1.5,
    orbit.y,
    0,
    world.content.ordinaryEnemyDefinitions[2],
  )
  bat.phase = 'ACTIVE'
  const batGlyphs = world.glyphStore.getOwnerGlyphs(bat.id)
  world.glyphStore.applyDamage(
    batGlyphs[2].id,
    batGlyphs[2].currentDurability,
  )
  const batXBefore = bat.x
  const huskWorldXBefore = bat.x + batGlyphs[2].localX
  const durabilityBefore = batGlyphs.map(
    ({ currentDurability }) => currentDurability,
  )
  const localPositions = batGlyphs
    .map(({ localX, localY }) => [localX, localY])
  runEnemySpatialIndexSystem(world)

  runOrbitWeaponSystem(world, 0)
  runDamageSystem(world)

  assert.equal(bat.x, batXBefore + profile.rootKnockbackDistance)
  assert.equal(bat.y, orbit.y)
  assert.equal(
    bat.x + batGlyphs[2].localX,
    huskWorldXBefore + profile.rootKnockbackDistance,
  )
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
    durabilityBefore.map((currentDurability) =>
      currentDurability === 0
        ? 0
        : getDurabilityAfterConfiguredHit(
            currentDurability,
            profile.damageAmount,
          ),
    ),
  )
})
