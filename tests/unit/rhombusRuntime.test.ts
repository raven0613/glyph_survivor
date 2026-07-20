import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import {
  activateRhombusBossContent,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import {
  RHOMBUS_COMPONENT,
  RHOMBUS_ORBIT_DIRECTION,
} from '../../src/game/content/bosses/rhombusBoss.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../../src/game/glyph/glyphPosition.ts'
import {
  createWorldState,
  spawnEnemy,
} from '../../src/game/runtime/worldState.ts'
import {
  GLYPH_DEPTH_BAND,
  type EnemyState,
} from '../../src/game/runtime/worldEntities.ts'
import { runBossSpawnSystem } from '../../src/game/systems/bossSpawnSystem.ts'
import { runCreatureBodyMotionSystem } from '../../src/game/systems/creatureBodyMotionSystem.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runMovementSystem } from '../../src/game/systems/movementSystem.ts'
import {
  prepareProjectileTargetingSystem,
  runProjectileTargetingSystem,
} from '../../src/game/systems/projectileTargetingSystem.ts'
import { runWeaponSystem } from '../../src/game/systems/weaponSystem.ts'
import { resolveCreatureTargetAnchor } from '../../src/game/systems/creatureTargetAnchors.ts'

function createRhombusWorld(seed: string) {
  const content = activateRhombusBossContent(prepareGameContent())
  return createWorldState(
    seed,
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
}

function spawnActiveRhombus(world: ReturnType<typeof createRhombusWorld>): EnemyState {
  const rhombus = spawnEnemy(
    world,
    world.player.x,
    world.player.y,
    0,
    world.content.rhombusBossDefinition.creature,
  )
  rhombus.phase = 'ACTIVE'
  return rhombus
}

test('does not commit RHOMBUS before asset-backed content activation', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'rhombus-before-loading-activation',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  world.firstWaveBossSpawns.rhombus.pendingSide = 'right'

  runBossSpawnSystem(world)

  assert.equal(world.firstWaveBossSpawns.rhombus.committedEnemyId, null)
  assert.equal(world.firstWaveBossSpawns.rhombus.pendingSide, 'right')
})

test('first-wave Slime and RHOMBUS requests commit independently with separated footprints', () => {
  const world = createRhombusWorld('rhombus-first-wave')
  world.firstWaveBossSpawns.slime.pendingSide = 'left'
  world.firstWaveBossSpawns.rhombus.pendingSide = 'right'
  world.obstacles.push({
    left: world.player.x + world.viewportWidth / 2,
    top: 0,
    right: world.content.rhombusBossDefinition.maximumGameplayFootprintRadius +
      world.player.x +
      world.viewportWidth,
    bottom: world.player.y * 2,
  })

  runBossSpawnSystem(world)

  const slimeId = world.firstWaveBossSpawns.slime.committedEnemyId
  assert.notEqual(slimeId, null)
  assert.equal(world.firstWaveBossSpawns.rhombus.committedEnemyId, null)
  assert.equal(world.firstWaveBossSpawns.rhombus.pendingSide, 'right')

  world.obstacles.length = 0
  runBossSpawnSystem(world)

  const rhombusId = world.firstWaveBossSpawns.rhombus.committedEnemyId
  if (rhombusId === null) {
    assert.fail('Expected the RHOMBUS spawn retry to commit.')
  }
  const slime = world.enemyById.get(slimeId as number)
  const rhombus = world.enemyById.get(rhombusId)
  assert.ok(slime)
  assert.ok(rhombus)
  assert.equal(world.glyphStore.getOwnerGlyphs(rhombus.id).length, 463)
  assert.equal(rhombus.encounterId, rhombus.id)
  assert.ok(
    Math.hypot(rhombus.x - slime.x, rhombus.y - slime.y) >=
      rhombus.radius +
        slime.radius +
        world.content.rhombusBossDefinition.spawnProfile
          .bossSpawnSeparationPaddingWorldUnits,
  )
})

test('RHOMBUS advances each companion as one authoritative orbit group and holds after a revolution', () => {
  const world = createRhombusWorld('rhombus-orbit')
  const rhombus = spawnActiveRhombus(world)
  const definition = world.content.rhombusBossDefinition
  const secondaryProfile = definition.orbitProfiles.find(
    ({ topologyComponentId }) =>
      topologyComponentId === RHOMBUS_COMPONENT.SECONDARY,
  )
  assert.ok(secondaryProfile)
  assert.equal(secondaryProfile.direction, RHOMBUS_ORBIT_DIRECTION.CLOCKWISE)

  const glyphs = world.glyphStore.getOwnerGlyphs(rhombus.id)
  const main = glyphs.find(
    ({ topologyComponentId }) => topologyComponentId === RHOMBUS_COMPONENT.MAIN,
  )
  const secondary = glyphs.filter(
    ({ topologyComponentId }) =>
      topologyComponentId === RHOMBUS_COMPONENT.SECONDARY,
  )
  assert.ok(main)
  assert.equal(secondary.length, 41)
  const initialDeltaX = secondary[1].bodyMotionOffsetX - secondary[0].bodyMotionOffsetX
  const initialDeltaY = secondary[1].bodyMotionOffsetY - secondary[0].bodyMotionOffsetY

  runMovementSystem(world, secondaryProfile.revolutionDurationMs / 4)

  assert.equal(main.bodyMotionOffsetX, 0)
  assert.equal(main.bodyMotionOffsetY, 0)
  assert.equal(main.rotation, 0)
  for (const glyph of secondary) {
    assert.equal(glyph.rotation, 0)
    assert.equal(glyph.bodyMotionOffsetX, secondary[0].bodyMotionOffsetX)
    assert.equal(glyph.bodyMotionOffsetY, secondary[0].bodyMotionOffsetY)
  }
  assert.equal(
    secondary[1].bodyMotionOffsetX - secondary[0].bodyMotionOffsetX,
    initialDeltaX,
  )
  assert.equal(
    secondary[1].bodyMotionOffsetY - secondary[0].bodyMotionOffsetY,
    initialDeltaY,
  )

  runMovementSystem(world, (secondaryProfile.revolutionDurationMs * 3) / 4)
  const completedX = secondary[0].bodyMotionOffsetX
  const completedY = secondary[0].bodyMotionOffsetY
  const orbitState = rhombus.componentOrbitStates.find(
    ({ profileId }) => profileId === secondaryProfile.id,
  )
  assert.ok(orbitState)
  assert.equal(orbitState.pauseRemainingMs, secondaryProfile.postRevolutionPauseMs)

  runMovementSystem(world, secondaryProfile.postRevolutionPauseMs / 2)
  assert.equal(secondary[0].bodyMotionOffsetX, completedX)
  assert.equal(secondary[0].bodyMotionOffsetY, completedY)
})

test('RHOMBUS orbit updates only companion Glyphs while active and performs no transform writes while paused', () => {
  const world = createRhombusWorld('rhombus-orbit-hot-path')
  const rhombus = spawnActiveRhombus(world)

  for (const state of rhombus.componentOrbitStates) {
    state.initialDelayRemainingMs = 0
    state.pauseRemainingMs = 0
  }

  runCreatureBodyMotionSystem(world, 1_000 / 60)

  assert.equal(world.diagnostics.componentOrbitActiveGroupCount, 2)
  assert.equal(world.diagnostics.componentOrbitPausedGroupCount, 0)
  assert.equal(world.diagnostics.componentOrbitTransformEvaluationCount, 2)
  assert.equal(world.diagnostics.componentOrbitGlyphUpdateCount, 42)

  for (const state of rhombus.componentOrbitStates) {
    state.pauseRemainingMs = 1_000
  }
  const transformEvaluationsBefore =
    world.diagnostics.componentOrbitTransformEvaluationCount
  const glyphUpdatesBefore = world.diagnostics.componentOrbitGlyphUpdateCount

  runCreatureBodyMotionSystem(world, 100)

  assert.equal(world.diagnostics.componentOrbitActiveGroupCount, 0)
  assert.equal(world.diagnostics.componentOrbitPausedGroupCount, 2)
  assert.equal(
    world.diagnostics.componentOrbitTransformEvaluationCount,
    transformEvaluationsBefore,
  )
  assert.equal(
    world.diagnostics.componentOrbitGlyphUpdateCount,
    glyphUpdatesBefore,
  )
})

test('RHOMBUS resolves orbit depth bands without rotating upright body glyphs', () => {
  const world = createRhombusWorld('rhombus-depth-bands')
  const rhombus = spawnActiveRhombus(world)
  const secondaryProfile = world.content.rhombusBossDefinition.orbitProfiles.find(
    ({ topologyComponentId }) =>
      topologyComponentId === RHOMBUS_COMPONENT.SECONDARY,
  )
  assert.ok(secondaryProfile)

  runMovementSystem(world, secondaryProfile.revolutionDurationMs / 4)
  const secondaryState = rhombus.componentOrbitStates.find(
    ({ profileId }) => profileId === secondaryProfile.id,
  )
  assert.ok(secondaryState)
  assert.equal(secondaryState.depthBand, GLYPH_DEPTH_BAND.FRONT)

  const snapshot = createRenderSnapshot()
  writeRenderSnapshot(world, snapshot, 1)
  assert.equal(snapshot.enemiesFront.length, 41)
  assert.equal(snapshot.enemies.length, 422)
  assert.equal(snapshot.enemiesBehind.length, 0)
  assert.ok(
    [...snapshot.enemiesBehind, ...snapshot.enemies, ...snapshot.enemiesFront].every(
      ({ rotation }) => rotation === 0,
    ),
  )
})

test('RHOMBUS satellite starts upper-right and advances counter-clockwise after its stagger', () => {
  const world = createRhombusWorld('rhombus-satellite-orbit')
  const rhombus = spawnActiveRhombus(world)
  const profile = world.content.rhombusBossDefinition.orbitProfiles.find(
    ({ topologyComponentId }) =>
      topologyComponentId === RHOMBUS_COMPONENT.SATELLITE,
  )
  assert.ok(profile)
  assert.equal(profile.direction, RHOMBUS_ORBIT_DIRECTION.COUNTERCLOCKWISE)
  const state = rhombus.componentOrbitStates.find(
    ({ profileId }) => profileId === profile.id,
  )
  assert.ok(state)
  assert.ok(state.offsetX > 0)
  assert.ok(state.offsetY < 0)

  runMovementSystem(
    world,
    profile.initialDelayMs +
      profile.cadenceOffsetMs +
      profile.revolutionDurationMs / 4,
  )

  assert.ok(Math.abs(state.phaseRadians - (Math.PI * 3) / 2) < 0.000_001)
  const satellite = world.glyphStore
    .getOwnerGlyphs(rhombus.id)
    .find(
      ({ topologyComponentId }) =>
        topologyComponentId === RHOMBUS_COMPONENT.SATELLITE,
    )
  assert.ok(satellite)
  assert.equal(satellite.rotation, 0)
})

test('RHOMBUS target anchors follow their stable component transforms', () => {
  const world = createRhombusWorld('rhombus-target-anchors')
  const rhombus = spawnActiveRhombus(world)
  const { targetAnchors, orbitProfiles } = world.content.rhombusBossDefinition
  const secondaryAnchor = targetAnchors.find(
    ({ topologyComponentId }) =>
      topologyComponentId === RHOMBUS_COMPONENT.SECONDARY,
  )
  assert.ok(secondaryAnchor)
  const before = resolveCreatureTargetAnchor(
    rhombus,
    world.content.rhombusBossDefinition.creature,
    secondaryAnchor.id,
  )
  assert.ok(before)
  const profile = orbitProfiles.find(
    ({ topologyComponentId }) =>
      topologyComponentId === RHOMBUS_COMPONENT.SECONDARY,
  )
  assert.ok(profile)

  runMovementSystem(world, profile.revolutionDurationMs / 4)
  const after = resolveCreatureTargetAnchor(
    rhombus,
    world.content.rhombusBossDefinition.creature,
    secondaryAnchor.id,
  )
  assert.ok(after)
  assert.notDeepEqual(after, before)

  const secondaryGlyph = world.glyphStore
    .getOwnerGlyphs(rhombus.id)
    .find(
      ({ topologyComponentId }) =>
        topologyComponentId === RHOMBUS_COMPONENT.SECONDARY,
    )
  assert.ok(secondaryGlyph)
  assert.equal(after.x, getGlyphWorldX(rhombus.x, secondaryGlyph) - secondaryGlyph.localX)
  assert.equal(after.y, getGlyphWorldY(rhombus.y, secondaryGlyph) - secondaryGlyph.localY)
})

test('one assisted volley locks the RHOMBUS anchor nearest its unassisted trajectory', () => {
  const world = createRhombusWorld('rhombus-assisted-anchor')
  const rhombus = spawnEnemy(
    world,
    world.player.x + 250,
    world.player.y,
    0,
    world.content.rhombusBossDefinition.creature,
  )
  rhombus.phase = 'ACTIVE'
  const satelliteAnchor = world.content.rhombusBossDefinition.targetAnchors.find(
    ({ topologyComponentId }) =>
      topologyComponentId === RHOMBUS_COMPONENT.SATELLITE,
  )
  assert.ok(satelliteAnchor)
  const satellitePosition = resolveCreatureTargetAnchor(
    rhombus,
    world.content.rhombusBossDefinition.creature,
    satelliteAnchor.id,
  )
  assert.ok(satellitePosition)
  const deltaX = satellitePosition.x - world.player.x
  const deltaY = satellitePosition.y - world.player.y
  const inverseDistance = 1 / Math.hypot(deltaX, deltaY)
  world.player.aimX = deltaX * inverseDistance
  world.player.aimY = deltaY * inverseDistance

  runEnemySpatialIndexSystem(world)
  runWeaponSystem(world, 1_000 / 60)

  assert.ok(world.projectiles.length > 0)
  const projectile = world.projectiles[0]
  assert.equal(projectile.targetEnemyId, rhombus.id)
  assert.equal(projectile.targetAnchorId, satelliteAnchor.id)

  runMovementSystem(world, 500)
  prepareProjectileTargetingSystem(world)
  runProjectileTargetingSystem(world, 1_000 / 60)
  assert.equal(projectile.targetAnchorId, satelliteAnchor.id)
})
