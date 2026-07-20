import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import {
  RHOMBUS_ORBIT_DIRECTION,
} from '../../src/game/content/bosses/rhombusBoss.ts'
import {
  activateRhombusBossContent,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { GAME_CONFIG } from '../../src/game/runtime/gameConfig.ts'
import { beginPlayerDamageCandidateCollection } from '../../src/game/runtime/playerDamageCandidateBuffer.ts'
import {
  HOSTILE_PROJECTILE_PHASE,
} from '../../src/game/runtime/hostileProjectileState.ts'
import {
  createWorldState,
  spawnEnemy,
} from '../../src/game/runtime/worldState.ts'
import { runCleanupSystem } from '../../src/game/systems/cleanupSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runHostileProjectileSystem } from '../../src/game/systems/hostileProjectileSystem.ts'
import { runPlayerContactSystem } from '../../src/game/systems/playerContactSystem.ts'
import { runPlayerSurvivalSystem } from '../../src/game/systems/playerSurvivalSystem.ts'
import { runRhombusSpiralAttackSystem } from '../../src/game/systems/rhombusSpiralAttackSystem.ts'
import {
  solveArchimedeanSpiralTheta,
  writeArchimedeanSpiralPose,
} from '../../src/game/systems/rhombusSpiralGeometry.ts'

function createActiveRhombusWorld(seed: string) {
  const content = activateRhombusBossContent(prepareGameContent())
  const world = createWorldState(
    seed,
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const rhombus = spawnEnemy(
    world,
    world.player.x + 300,
    world.player.y,
    0,
    content.rhombusBossDefinition.creature,
  )
  rhombus.phase = 'ACTIVE'
  return { content, rhombus, world }
}

const POSITION_EPSILON = 0.000_001
const FULL_TURN_RADIANS = Math.PI * 2

function normalizeRadians(value: number): number {
  const normalized = value % FULL_TURN_RADIANS
  return normalized < 0 ? normalized + FULL_TURN_RADIANS : normalized
}

function assertNear(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < POSITION_EPSILON,
    `Expected ${actual} to be within ${POSITION_EPSILON} of ${expected}.`,
  )
}

function formFirstWave(
  world: ReturnType<typeof createActiveRhombusWorld>['world'],
): void {
  runRhombusSpiralAttackSystem(world, 0)
}

function releaseFirstSpike(
  world: ReturnType<typeof createActiveRhombusWorld>['world'],
  launchRingHoldMs: number,
) {
  runRhombusSpiralAttackSystem(world, launchRingHoldMs)
  return world.hostileProjectiles[0]
}

test('RHOMBUS forms one complete evenly spaced launch ring with curve-tangent spikes', () => {
  const { content, rhombus, world } = createActiveRhombusWorld(
    'rhombus-hostile-ring-formation',
  )
  const profile = content.rhombusBossDefinition.attackProfile

  formFirstWave(world)

  assert.equal(world.hostileProjectiles.length, profile.spikesPerWave)
  assert.equal(world.diagnostics.hostileProjectileWavesFormed, 1)
  assert.equal(world.diagnostics.hostileProjectilesStaged, profile.spikesPerWave)
  assert.equal(world.diagnostics.hostileProjectilesReleased, 0)
  world.hostileProjectiles.forEach((projectile, slotIndex) => {
    const expectedSlotAngle = normalizeRadians(
      profile.launchRingInitialPhaseRadians +
        (FULL_TURN_RADIANS * slotIndex) / profile.spikesPerWave,
    )
    const expectedPose = {
      x: 0,
      y: 0,
      tangentX: 0,
      tangentY: 0,
      tangentRotation: 0,
    }
    writeArchimedeanSpiralPose(
      expectedPose,
      rhombus.x,
      rhombus.y,
      0,
      profile.spiralTightnessWorldUnitsPerRadian,
      profile.launchRingRadiusWorldUnits,
      expectedSlotAngle,
      1,
    )

    assert.equal(projectile.phase, HOSTILE_PROJECTILE_PHASE.STAGED_IN_RING)
    assert.equal(projectile.waveIndex, 0)
    assert.equal(projectile.waveSlotIndex, slotIndex)
    assert.equal(projectile.directionSign, 1)
    assertNear(projectile.initialPhaseRadians, expectedSlotAngle)
    assertNear(
      Math.hypot(projectile.x - rhombus.x, projectile.y - rhombus.y),
      profile.launchRingRadiusWorldUnits,
    )
    assertNear(projectile.x, expectedPose.x)
    assertNear(projectile.y, expectedPose.y)
    assertNear(projectile.tangentRotation, expectedPose.tangentRotation)
  })

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)
  assert.equal(snapshot.projectiles.length, profile.spikesPerWave * 2)
})

test('staged RHOMBUS spikes follow the Boss without collision, then release one at a time', () => {
  const { content, rhombus, world } = createActiveRhombusWorld(
    'rhombus-hostile-cadence',
  )
  const profile = content.rhombusBossDefinition.attackProfile
  formFirstWave(world)
  const first = world.hostileProjectiles[0]
  const second = world.hostileProjectiles[1]
  world.player.x = first.x
  world.player.y = first.y
  world.player.previousX = first.x
  world.player.previousY = first.y

  beginPlayerDamageCandidateCollection(world)
  runHostileProjectileSystem(world, GAME_CONFIG.fixedStepMs)
  assert.equal(world.playerDamageCandidateCount, 0)
  assert.equal(first.travelledDistance, 0)
  assert.equal(
    world.diagnostics.activeStagedHostileProjectileCount,
    profile.spikesPerWave,
  )
  assert.equal(world.diagnostics.activeReleasedHostileProjectileCount, 0)
  assert.equal(world.diagnostics.activeDissipatingHostileProjectileCount, 0)

  const previousFirstX = first.x
  const previousFirstY = first.y
  rhombus.x += 80
  rhombus.y -= 35
  runRhombusSpiralAttackSystem(world, profile.launchRingHoldMs - 1)
  assertNear(first.x, previousFirstX + 80)
  assertNear(first.y, previousFirstY - 35)
  assert.equal(first.phase, HOSTILE_PROJECTILE_PHASE.STAGED_IN_RING)

  runRhombusSpiralAttackSystem(world, 1)
  assert.equal(first.phase, HOSTILE_PROJECTILE_PHASE.ACTIVE)
  assert.equal(second.phase, HOSTILE_PROJECTILE_PHASE.STAGED_IN_RING)
  assert.equal(first.originX, rhombus.x)
  assert.equal(first.originY, rhombus.y)
  assert.equal(world.diagnostics.hostileProjectilesReleased, 1)

  beginPlayerDamageCandidateCollection(world)
  runHostileProjectileSystem(world, 100)
  assertNear(
    first.travelledDistance,
    profile.flightSpeedWorldUnitsPerSecond * 0.1,
  )
  assert.notEqual(first.x, rhombus.x)
  assertNear(Math.hypot(first.tangentX, first.tangentY), 1)
  assert.equal(second.travelledDistance, 0)
  assert.equal(
    world.diagnostics.activeStagedHostileProjectileCount,
    profile.spikesPerWave - 1,
  )
  assert.equal(world.diagnostics.activeReleasedHostileProjectileCount, 1)

  runRhombusSpiralAttackSystem(world, profile.emissionIntervalMs - 1)
  assert.equal(second.phase, HOSTILE_PROJECTILE_PHASE.STAGED_IN_RING)
  runRhombusSpiralAttackSystem(world, 1)
  assert.equal(second.phase, HOSTILE_PROJECTILE_PHASE.ACTIVE)
})

test('clockwise RHOMBUS waves wait after their final emission and preserve direction', () => {
  const { content, world } = createActiveRhombusWorld(
    'rhombus-hostile-alternation',
  )
  const profile = content.rhombusBossDefinition.attackProfile

  formFirstWave(world)
  releaseFirstSpike(world, profile.launchRingHoldMs)
  for (let index = 1; index < profile.spikesPerWave; index += 1) {
    runRhombusSpiralAttackSystem(world, profile.emissionIntervalMs)
  }
  assert.equal(world.hostileProjectiles.length, profile.spikesPerWave)
  assert.ok(
    world.hostileProjectiles.every(
      ({ directionSign }) => directionSign === 1,
    ),
  )

  runRhombusSpiralAttackSystem(world, profile.waveIntervalMs - 1)
  assert.equal(world.hostileProjectiles.length, profile.spikesPerWave)
  runRhombusSpiralAttackSystem(world, 1)

  assert.equal(world.hostileProjectiles.length, profile.spikesPerWave * 2)
  const secondWave = world.hostileProjectiles.slice(profile.spikesPerWave)
  assert.ok(
    secondWave.every(
      ({ directionSign, phase }) =>
        directionSign === 1 &&
        phase === HOSTILE_PROJECTILE_PHASE.STAGED_IN_RING,
    ),
  )
  assertNear(
    secondWave[1].initialPhaseRadians,
    normalizeRadians(
      profile.launchRingInitialPhaseRadians +
        FULL_TURN_RADIANS / profile.spikesPerWave,
    ),
  )
  assert.equal(
    world.rhombusAttackStates.get(world.hostileProjectiles[0].sourceOwnerId)
      ?.waveIndex,
    1,
  )
})

test('one swept RHOMBUS spike consumes once and appends one shared incoming-damage candidate', () => {
  const { content, world } = createActiveRhombusWorld(
    'rhombus-hostile-swept-hit',
  )
  const profile = content.rhombusBossDefinition.attackProfile
  world.player.survival.currentShieldLayers = 0
  world.player.survival.maximumShieldLayers = 0
  world.player.survival.damageInvulnerableUntilMs = 60_000
  const initialHealth = world.player.survival.currentHealth

  formFirstWave(world)
  const first = world.hostileProjectiles[0]
  world.player.x = first.x
  world.player.y = first.y
  world.player.previousX = first.x
  world.player.previousY = first.y
  releaseFirstSpike(world, profile.launchRingHoldMs)
  beginPlayerDamageCandidateCollection(world)
  runHostileProjectileSystem(world, GAME_CONFIG.fixedStepMs)

  assert.equal(world.playerDamageCandidateCount, 1)
  assert.equal(world.playerDamageCandidates[0].eventId, first.eventId)
  assert.equal(first.phase, HOSTILE_PROJECTILE_PHASE.SPENT)
  runPlayerSurvivalSystem(world)
  assert.equal(world.player.survival.currentHealth, initialHealth)

  runCleanupSystem(world)
  assert.equal(world.hostileProjectiles.length, profile.spikesPerWave - 1)
  assert.equal(world.hostileProjectilePool.length, 1)
  beginPlayerDamageCandidateCollection(world)
  runHostileProjectileSystem(world, profile.emissionIntervalMs)
  assert.equal(world.playerDamageCandidateCount, 0)
})

test('RHOMBUS spike collision sweeps the authoritative curve instead of its endpoint chord', () => {
  const { content, rhombus, world } = createActiveRhombusWorld(
    'rhombus-hostile-curved-sweep',
  )
  const profile = content.rhombusBossDefinition.attackProfile
  const playerPose = {
    x: 0,
    y: 0,
    tangentX: 0,
    tangentY: 0,
    tangentRotation: 0,
  }
  const travelledDistance = profile.maximumTravelDistanceWorldUnits * 0.75
  const playerTheta = solveArchimedeanSpiralTheta(
    travelledDistance / 2,
    profile.spiralTightnessWorldUnitsPerRadian,
    profile.launchRingRadiusWorldUnits,
  )
  writeArchimedeanSpiralPose(
    playerPose,
    rhombus.x,
    rhombus.y,
    playerTheta,
    profile.spiralTightnessWorldUnitsPerRadian,
    profile.launchRingRadiusWorldUnits,
    profile.launchRingInitialPhaseRadians,
    1,
  )
  world.player.x = playerPose.x
  world.player.y = playerPose.y
  world.player.previousX = playerPose.x
  world.player.previousY = playerPose.y

  formFirstWave(world)
  const first = releaseFirstSpike(world, profile.launchRingHoldMs)
  beginPlayerDamageCandidateCollection(world)
  runHostileProjectileSystem(
    world,
    (travelledDistance / profile.flightSpeedWorldUnitsPerSecond) * 1_000,
  )

  assert.equal(world.playerDamageCandidateCount, 1)
  assert.equal(
    first.phase,
    HOSTILE_PROJECTILE_PHASE.SPENT,
  )
})

test('RHOMBUS spike sweep catches relative crossings with player movement', () => {
  const { content, world } = createActiveRhombusWorld(
    'rhombus-hostile-relative-sweep',
  )
  const profile = content.rhombusBossDefinition.attackProfile
  formFirstWave(world)
  const first = releaseFirstSpike(world, profile.launchRingHoldMs)
  world.player.previousX = first.x - 40
  world.player.previousY = first.y
  world.player.x = first.x + 40
  world.player.y = first.y

  beginPlayerDamageCandidateCollection(world)
  runHostileProjectileSystem(world, GAME_CONFIG.fixedStepMs)

  assert.equal(world.playerDamageCandidateCount, 1)
  assert.equal(
    first.phase,
    HOSTILE_PROJECTILE_PHASE.SPENT,
  )
})

test('RHOMBUS spike render interpolation remains on the authoritative curve', () => {
  const { content, world } = createActiveRhombusWorld(
    'rhombus-hostile-curve-interpolation',
  )
  const profile = content.rhombusBossDefinition.attackProfile
  formFirstWave(world)
  const projectile = releaseFirstSpike(world, profile.launchRingHoldMs)
  const travelledDistance = profile.launchRingRadiusWorldUnits * 0.5
  beginPlayerDamageCandidateCollection(world)
  runHostileProjectileSystem(
    world,
    (travelledDistance / profile.flightSpeedWorldUnitsPerSecond) * 1_000,
  )

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 0.5)
  const interpolatedDistance = projectile.travelledDistance / 2
  const expectedTheta = solveArchimedeanSpiralTheta(
    interpolatedDistance,
    projectile.spiralTightness,
    projectile.initialRadius,
  )
  const expectedPose = {
    x: 0,
    y: 0,
    tangentX: 0,
    tangentY: 0,
    tangentRotation: 0,
  }
  writeArchimedeanSpiralPose(
    expectedPose,
    projectile.originX,
    projectile.originY,
    expectedTheta,
    projectile.spiralTightness,
    projectile.initialRadius,
    projectile.initialPhaseRadians,
    projectile.directionSign,
  )
  const renderedCenterX =
    (snapshot.projectiles[0].x + snapshot.projectiles[1].x) / 2
  const renderedCenterY =
    (snapshot.projectiles[0].y + snapshot.projectiles[1].y) / 2

  assert.ok(Math.abs(renderedCenterX - expectedPose.x) < 0.000_001)
  assert.ok(Math.abs(renderedCenterY - expectedPose.y) < 0.000_001)
  assert.ok(
    Math.abs(snapshot.projectiles[0].rotation - expectedPose.tangentRotation) <
      0.000_001,
  )
})

test('contact and hostile spikes append to one candidate buffer before one survival resolve', () => {
  const { rhombus, world } = createActiveRhombusWorld(
    'rhombus-hostile-shared-buffer',
  )
  rhombus.x = world.player.x
  rhombus.y = world.player.y
  world.player.survival.currentShieldLayers = 0
  world.player.survival.maximumShieldLayers = 0

  const profile = world.content.rhombusBossDefinition.attackProfile
  formFirstWave(world)
  const first = world.hostileProjectiles[0]
  world.player.x = first.x
  world.player.y = first.y
  world.player.previousX = first.x
  world.player.previousY = first.y
  releaseFirstSpike(world, profile.launchRingHoldMs)
  beginPlayerDamageCandidateCollection(world)
  runHostileProjectileSystem(world, GAME_CONFIG.fixedStepMs)
  runEnemySpatialIndexSystem(world)
  runPlayerContactSystem(world)

  assert.equal(world.playerDamageCandidateCount, 2)
  runPlayerSurvivalSystem(world)
  assert.equal(world.playerDamageStepOutcome.acceptedSourceId, rhombus.id)
})

test('RHOMBUS collapse freezes staged and active spikes into bounded dissipation presentations', () => {
  const { content, rhombus, world } = createActiveRhombusWorld(
    'rhombus-hostile-collapse-cancel',
  )
  const appearance = content.combatVisualTheme.effects.rhombus.hostileSpike
  const profile = content.rhombusBossDefinition.attackProfile
  formFirstWave(world)
  const activeProjectile = releaseFirstSpike(world, profile.launchRingHoldMs)
  const stagedProjectile = world.hostileProjectiles[1]
  beginPlayerDamageCandidateCollection(world)
  runHostileProjectileSystem(world, 120)
  const activeFrozenX = activeProjectile.x
  const activeFrozenY = activeProjectile.y
  const stagedFrozenX = stagedProjectile.x
  const stagedFrozenY = stagedProjectile.y

  rhombus.phase = 'COLLAPSING'
  runRhombusSpiralAttackSystem(world, 0)
  beginPlayerDamageCandidateCollection(world)
  runHostileProjectileSystem(world, GAME_CONFIG.fixedStepMs)

  assert.ok(
    world.hostileProjectiles.every(
      ({ phase }) => phase === HOSTILE_PROJECTILE_PHASE.DISSIPATING,
    ),
  )
  assert.equal(activeProjectile.x, activeFrozenX)
  assert.equal(activeProjectile.y, activeFrozenY)
  assert.equal(stagedProjectile.x, stagedFrozenX)
  assert.equal(stagedProjectile.y, stagedFrozenY)
  assert.equal(world.playerDamageCandidateCount, 0)
  assert.equal(world.diagnostics.activeStagedHostileProjectileCount, 0)
  assert.equal(world.diagnostics.activeReleasedHostileProjectileCount, 0)
  assert.equal(
    world.diagnostics.activeDissipatingHostileProjectileCount,
    profile.spikesPerWave,
  )
  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)
  assert.equal(snapshot.projectiles.length, profile.spikesPerWave * 2)
  assert.equal(
    snapshot.effects.length,
    appearance.particleCount * profile.spikesPerWave,
  )
  assert.deepEqual(
    snapshot.projectiles.slice(0, 2).map(({ glyphFrame }) => glyphFrame),
    [
      profile.leftGlyphFrame,
      profile.rightGlyphFrame,
    ],
  )
  assert.ok(
    Math.abs(
      Math.hypot(
        snapshot.projectiles[1].x - snapshot.projectiles[0].x,
        snapshot.projectiles[1].y - snapshot.projectiles[0].y,
      ) - profile.pairSpacingWorldUnits,
    ) < POSITION_EPSILON,
  )
  assert.equal(
    snapshot.projectiles[0].rotation,
    snapshot.projectiles[1].rotation,
  )

  runHostileProjectileSystem(world, appearance.dissipationDurationMs)
  runCleanupSystem(world)
  assert.equal(world.hostileProjectiles.length, 0)
  assert.equal(world.hostileProjectilePool.length, profile.spikesPerWave)
})

test('authored first wave direction remains explicit in prepared RHOMBUS content', () => {
  const content = prepareGameContent()
  assert.equal(
    content.rhombusBossDefinition.attackProfile.firstWaveDirection,
    RHOMBUS_ORBIT_DIRECTION.CLOCKWISE,
  )
})
