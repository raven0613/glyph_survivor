import {
  RHOMBUS_ORBIT_DIRECTION,
  RHOMBUS_SPIRAL_DIRECTION_MODE,
  type RhombusAttackProfile,
} from '../content/bosses/rhombusBoss.ts'
import {
  HOSTILE_PROJECTILE_PHASE,
  type HostileProjectileState,
  type RhombusSpiralAttackState,
} from '../runtime/hostileProjectileState.ts'
import type { EnemyState } from '../runtime/worldEntities.ts'
import {
  getNextEntityId,
  getNextPlayerDamageEventId,
  type WorldState,
} from '../runtime/worldState.ts'
import { writeArchimedeanSpiralPose } from './rhombusSpiralGeometry.ts'

const FULL_TURN_RADIANS = Math.PI * 2

function normalizeRadians(value: number): number {
  const normalized = value % FULL_TURN_RADIANS
  return normalized < 0 ? normalized + FULL_TURN_RADIANS : normalized
}

function resolveDirectionSign(
  profile: Readonly<RhombusAttackProfile>,
  waveIndex: number,
): -1 | 1 {
  let direction = profile.firstWaveDirection
  if (profile.spiralDirectionMode === RHOMBUS_SPIRAL_DIRECTION_MODE.CLOCKWISE) {
    direction = RHOMBUS_ORBIT_DIRECTION.CLOCKWISE
  } else if (
    profile.spiralDirectionMode ===
    RHOMBUS_SPIRAL_DIRECTION_MODE.COUNTERCLOCKWISE
  ) {
    direction = RHOMBUS_ORBIT_DIRECTION.COUNTERCLOCKWISE
  } else if (waveIndex % 2 === 1) {
    direction =
      profile.firstWaveDirection === RHOMBUS_ORBIT_DIRECTION.CLOCKWISE
        ? RHOMBUS_ORBIT_DIRECTION.COUNTERCLOCKWISE
        : RHOMBUS_ORBIT_DIRECTION.CLOCKWISE
  }
  // Positive screen-space angles turn clockwise because world Y grows downward.
  return direction === RHOMBUS_ORBIT_DIRECTION.CLOCKWISE ? 1 : -1
}

function getSlotAngle(
  profile: Readonly<RhombusAttackProfile>,
  directionSign: -1 | 1,
  slotIndex: number,
): number {
  return normalizeRadians(
    profile.launchRingInitialPhaseRadians +
      directionSign *
        ((FULL_TURN_RADIANS * slotIndex) / profile.spikesPerWave),
  )
}

function createStagedProjectile(
  world: WorldState,
  enemy: Readonly<EnemyState>,
  profile: Readonly<RhombusAttackProfile>,
  waveIndex: number,
  slotIndex: number,
  directionSign: -1 | 1,
): HostileProjectileState {
  const pooled = world.hostileProjectilePool.pop()
  if (!pooled) {
    world.diagnostics.hostileProjectilePoolMisses += 1
  }
  const projectile = pooled ?? ({} as HostileProjectileState)
  Object.assign(projectile, {
    id: getNextEntityId(world),
    eventId: getNextPlayerDamageEventId(world),
    sourceOwnerId: enemy.id,
    sourceEncounterId: enemy.encounterId,
    waveIndex,
    waveSlotIndex: slotIndex,
    phase: HOSTILE_PROJECTILE_PHASE.STAGED_IN_RING,
    originX: enemy.x,
    originY: enemy.y,
    x: enemy.x,
    y: enemy.y,
    previousX: enemy.x,
    previousY: enemy.y,
    tangentX: 0,
    tangentY: 0,
    tangentRotation: 0,
    launchOffsetX: 0,
    launchOffsetY: 0,
    launchTangentX: 0,
    launchTangentY: 0,
    launchTangentRotation: 0,
    thetaRadians: 0,
    directionSign,
    travelledDistance: 0,
    previousTravelledDistance: 0,
    maximumTravelDistance: profile.maximumTravelDistanceWorldUnits,
    flightSpeed: profile.flightSpeedWorldUnitsPerSecond,
    spiralTightness: profile.spiralTightnessWorldUnitsPerRadian,
    initialRadius: profile.launchRingRadiusWorldUnits,
    initialPhaseRadians: getSlotAngle(profile, directionSign, slotIndex),
    collisionRadius: profile.projectileCollisionRadiusWorldUnits,
    pairSpacing: profile.pairSpacingWorldUnits,
    damage: profile.damage,
    damageRoute: profile.damageRoute,
    leftGlyphFrame: profile.leftGlyphFrame,
    rightGlyphFrame: profile.rightGlyphFrame,
    fontBankId: profile.fontBankId,
    visualScale: profile.visualScale,
    dissipationRemainingMs: 0,
    dissipationDurationMs: 0,
  })
  writeArchimedeanSpiralPose(
    projectile,
    enemy.x,
    enemy.y,
    0,
    projectile.spiralTightness,
    projectile.initialRadius,
    projectile.initialPhaseRadians,
    projectile.directionSign,
  )
  projectile.launchOffsetX = projectile.x - enemy.x
  projectile.launchOffsetY = projectile.y - enemy.y
  projectile.launchTangentX = projectile.tangentX
  projectile.launchTangentY = projectile.tangentY
  projectile.launchTangentRotation = projectile.tangentRotation
  projectile.previousX = projectile.x
  projectile.previousY = projectile.y
  world.hostileProjectiles.push(projectile)
  world.diagnostics.hostileProjectilesStaged += 1
  return projectile
}

function getOrCreateAttackState(
  world: WorldState,
  enemy: Readonly<EnemyState>,
): RhombusSpiralAttackState {
  const existing = world.rhombusAttackStates.get(enemy.id)
  if (existing) {
    return existing
  }
  const state: RhombusSpiralAttackState = {
    ownerId: enemy.id,
    waveIndex: 0,
    phase: 'WAITING_FOR_FORMATION',
    directionSign: 1,
    nextSlotIndex: 0,
    timeUntilNextActionMs: 0,
    waveProjectiles: [],
  }
  world.rhombusAttackStates.set(enemy.id, state)
  return state
}

function formWave(
  world: WorldState,
  enemy: Readonly<EnemyState>,
  profile: Readonly<RhombusAttackProfile>,
  state: RhombusSpiralAttackState,
): void {
  state.waveProjectiles.length = 0
  state.directionSign = resolveDirectionSign(profile, state.waveIndex)
  state.nextSlotIndex = 0
  for (let slotIndex = 0; slotIndex < profile.spikesPerWave; slotIndex += 1) {
    state.waveProjectiles.push(
      createStagedProjectile(
        world,
        enemy,
        profile,
        state.waveIndex,
        slotIndex,
        state.directionSign,
      ),
    )
  }
  state.phase = 'HOLDING_RING'
  state.timeUntilNextActionMs = profile.launchRingHoldMs
  world.diagnostics.hostileProjectileWavesFormed += 1
}

function updateStagedRing(
  enemy: Readonly<EnemyState>,
  state: RhombusSpiralAttackState,
): void {
  for (
    let slotIndex = state.nextSlotIndex;
    slotIndex < state.waveProjectiles.length;
    slotIndex += 1
  ) {
    const projectile = state.waveProjectiles[slotIndex]
    if (projectile.phase !== HOSTILE_PROJECTILE_PHASE.STAGED_IN_RING) {
      continue
    }
    projectile.previousX = projectile.x
    projectile.previousY = projectile.y
    projectile.originX = enemy.x
    projectile.originY = enemy.y
    projectile.x = enemy.x + projectile.launchOffsetX
    projectile.y = enemy.y + projectile.launchOffsetY
    projectile.tangentX = projectile.launchTangentX
    projectile.tangentY = projectile.launchTangentY
    projectile.tangentRotation = projectile.launchTangentRotation
  }
}

function releaseNextProjectile(
  world: WorldState,
  enemy: Readonly<EnemyState>,
  profile: Readonly<RhombusAttackProfile>,
  state: RhombusSpiralAttackState,
): void {
  const projectile = state.waveProjectiles[state.nextSlotIndex]
  if (projectile?.phase !== HOSTILE_PROJECTILE_PHASE.STAGED_IN_RING) {
    throw new Error('RHOMBUS launch ring lost its next staged projectile.')
  }
  projectile.originX = enemy.x
  projectile.originY = enemy.y
  projectile.previousX = projectile.x
  projectile.previousY = projectile.y
  projectile.previousTravelledDistance = 0
  projectile.travelledDistance = 0
  projectile.thetaRadians = 0
  projectile.phase = HOSTILE_PROJECTILE_PHASE.ACTIVE
  world.diagnostics.hostileProjectilesReleased += 1

  state.nextSlotIndex += 1
  if (state.nextSlotIndex >= profile.spikesPerWave) {
    state.waveProjectiles.length = 0
    state.waveIndex += 1
    state.phase = 'WAITING_FOR_FORMATION'
    state.timeUntilNextActionMs = profile.waveIntervalMs
    return
  }
  state.phase = 'RELEASING'
  state.timeUntilNextActionMs = profile.emissionIntervalMs
}

function advanceScheduler(
  world: WorldState,
  enemy: Readonly<EnemyState>,
  profile: Readonly<RhombusAttackProfile>,
  state: RhombusSpiralAttackState,
  deltaMs: number,
): void {
  updateStagedRing(enemy, state)
  let remainingDeltaMs = deltaMs
  while (remainingDeltaMs >= state.timeUntilNextActionMs) {
    remainingDeltaMs -= state.timeUntilNextActionMs
    if (state.phase === 'WAITING_FOR_FORMATION') {
      formWave(world, enemy, profile, state)
    } else {
      releaseNextProjectile(world, enemy, profile, state)
    }
  }
  state.timeUntilNextActionMs -= remainingDeltaMs
}

export function runRhombusSpiralAttackSystem(
  world: WorldState,
  deltaMs: number,
): void {
  const definition = world.content.rhombusBossDefinition
  for (const [ownerId, state] of world.rhombusAttackStates) {
    const owner = world.enemyById.get(ownerId)
    if (
      owner?.definitionId !== definition.creature.id ||
      owner.phase !== 'ACTIVE'
    ) {
      state.waveProjectiles.length = 0
      world.rhombusAttackStates.delete(ownerId)
    }
  }
  for (const enemy of world.enemies) {
    if (
      enemy.definitionId !== definition.creature.id ||
      enemy.phase !== 'ACTIVE'
    ) {
      continue
    }
    advanceScheduler(
      world,
      enemy,
      definition.attackProfile,
      getOrCreateAttackState(world, enemy),
      deltaMs,
    )
  }
}
