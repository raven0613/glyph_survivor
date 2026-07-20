import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import {
  HOSTILE_PROJECTILE_PHASE,
  type HostileProjectileState,
} from '../runtime/hostileProjectileState.ts'
import {
  PLAYER_DAMAGE_SOURCE_KIND,
  type PlayerDamageCandidate,
} from '../runtime/playerSurvival.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { getFirstSegmentCircleContactTime } from './combatGeometry.ts'
import {
  solveArchimedeanSpiralTheta,
  writeArchimedeanSpiralPose,
  type ArchimedeanSpiralPose,
} from './rhombusSpiralGeometry.ts'

const MAX_CURVE_SWEEP_ANGLE_RADIANS = Math.PI / 12
const MAX_CURVE_SWEEP_DISTANCE = 12
const MAX_CURVE_SWEEP_SEGMENTS = 64

function beginDissipation(
  world: WorldState,
  projectile: HostileProjectileState,
): void {
  if (
    projectile.phase !== HOSTILE_PROJECTILE_PHASE.STAGED_IN_RING &&
    projectile.phase !== HOSTILE_PROJECTILE_PHASE.ACTIVE
  ) {
    return
  }
  const durationMs =
    world.content.combatVisualTheme.effects.rhombus.hostileSpike
      .dissipationDurationMs
  projectile.phase = HOSTILE_PROJECTILE_PHASE.DISSIPATING
  projectile.previousX = projectile.x
  projectile.previousY = projectile.y
  projectile.previousTravelledDistance = projectile.travelledDistance
  projectile.dissipationDurationMs = durationMs
  projectile.dissipationRemainingMs = durationMs
  world.diagnostics.hostileProjectilesFrozenForDissipation += 1
}

export function beginAllHostileProjectileDissipation(world: WorldState): void {
  for (const projectile of world.hostileProjectiles) {
    beginDissipation(world, projectile)
  }
}

export function runHostileProjectileDissipationSystem(
  world: WorldState,
  deltaMs: number,
): void {
  for (const projectile of world.hostileProjectiles) {
    if (projectile.phase !== HOSTILE_PROJECTILE_PHASE.DISSIPATING) {
      continue
    }
    projectile.dissipationRemainingMs = Math.max(
      0,
      projectile.dissipationRemainingMs - deltaMs,
    )
    if (projectile.dissipationRemainingMs === 0) {
      projectile.phase = HOSTILE_PROJECTILE_PHASE.SPENT
      world.diagnostics.hostileProjectilesDissipated += 1
    }
  }
}

function sourceCanAttack(
  world: WorldState,
  projectile: HostileProjectileState,
): boolean {
  const source = world.enemyById.get(projectile.sourceOwnerId)
  return source?.phase === 'ACTIVE'
}

function relativeSegmentOverlapsOriginBounds(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  radius: number,
): boolean {
  return (
    Math.min(startX, endX) <= radius &&
    Math.max(startX, endX) >= -radius &&
    Math.min(startY, endY) <= radius &&
    Math.max(startY, endY) >= -radius
  )
}

function getCurveSweepSegmentCount(
  projectile: HostileProjectileState,
  previousThetaRadians: number,
  playerTravelDistance: number,
): number {
  const pathDistance =
    projectile.travelledDistance - projectile.previousTravelledDistance
  const angleDistance = projectile.thetaRadians - previousThetaRadians
  return Math.min(
    MAX_CURVE_SWEEP_SEGMENTS,
    Math.max(
      1,
      Math.ceil(pathDistance / MAX_CURVE_SWEEP_DISTANCE),
      Math.ceil(angleDistance / MAX_CURVE_SWEEP_ANGLE_RADIANS),
      Math.ceil(playerTravelDistance / MAX_CURVE_SWEEP_DISTANCE),
    ),
  )
}

function hasCurvedSweptPlayerContact(
  world: WorldState,
  projectile: HostileProjectileState,
  samplePose: ArchimedeanSpiralPose,
): boolean {
  const playerDeltaX = world.player.x - world.player.previousX
  const playerDeltaY = world.player.y - world.player.previousY
  const playerTravelDistance = Math.hypot(playerDeltaX, playerDeltaY)
  const previousThetaRadians = solveArchimedeanSpiralTheta(
    projectile.previousTravelledDistance,
    projectile.spiralTightness,
    projectile.initialRadius,
  )
  const segmentCount = getCurveSweepSegmentCount(
    projectile,
    previousThetaRadians,
    playerTravelDistance,
  )
  const combinedRadius =
    GAME_CONFIG.playerCollisionRadius + projectile.collisionRadius
  const pathDistance =
    projectile.travelledDistance - projectile.previousTravelledDistance
  let segmentStartX = projectile.previousX
  let segmentStartY = projectile.previousY
  let foundBroadPhaseCandidate = false

  for (let segmentIndex = 1; segmentIndex <= segmentCount; segmentIndex += 1) {
    const endTimeRatio = segmentIndex / segmentCount
    const startTimeRatio = (segmentIndex - 1) / segmentCount
    const sampledDistance =
      projectile.previousTravelledDistance + pathDistance * endTimeRatio
    const sampledTheta = solveArchimedeanSpiralTheta(
      sampledDistance,
      projectile.spiralTightness,
      projectile.initialRadius,
    )
    writeArchimedeanSpiralPose(
      samplePose,
      projectile.originX,
      projectile.originY,
      sampledTheta,
      projectile.spiralTightness,
      projectile.initialRadius,
      projectile.initialPhaseRadians,
      projectile.directionSign,
    )

    const playerStartX = world.player.previousX + playerDeltaX * startTimeRatio
    const playerStartY = world.player.previousY + playerDeltaY * startTimeRatio
    const playerEndX = world.player.previousX + playerDeltaX * endTimeRatio
    const playerEndY = world.player.previousY + playerDeltaY * endTimeRatio
    const relativeStartX = segmentStartX - playerStartX
    const relativeStartY = segmentStartY - playerStartY
    const relativeEndX = samplePose.x - playerEndX
    const relativeEndY = samplePose.y - playerEndY

    if (
      relativeSegmentOverlapsOriginBounds(
        relativeStartX,
        relativeStartY,
        relativeEndX,
        relativeEndY,
        combinedRadius,
      )
    ) {
      if (!foundBroadPhaseCandidate) {
        world.diagnostics.hostileProjectileSweptBroadPhaseCandidates += 1
        foundBroadPhaseCandidate = true
      }
      world.diagnostics.hostileProjectileSweptPreciseTests += 1
      if (
        getFirstSegmentCircleContactTime(
          relativeStartX,
          relativeStartY,
          relativeEndX,
          relativeEndY,
          0,
          0,
          combinedRadius,
        ) !== null
      ) {
        return true
      }
    }

    segmentStartX = samplePose.x
    segmentStartY = samplePose.y
  }
  return false
}

function appendDamageCandidate(
  world: WorldState,
  projectile: HostileProjectileState,
): void {
  const index = world.playerDamageCandidateCount
  const candidate =
    world.playerDamageCandidates[index] ?? ({} as PlayerDamageCandidate)
  candidate.eventId = projectile.eventId
  candidate.sourceKind = PLAYER_DAMAGE_SOURCE_KIND.ENEMY_PROJECTILE
  candidate.sourceId = projectile.id
  candidate.amount = projectile.damage
  candidate.route = projectile.damageRoute
  world.playerDamageCandidates[index] = candidate
  world.playerDamageCandidateCount += 1
}

function moveProjectile(
  projectile: HostileProjectileState,
  deltaMs: number,
): boolean {
  projectile.previousX = projectile.x
  projectile.previousY = projectile.y
  projectile.previousTravelledDistance = projectile.travelledDistance
  const remainingDistance =
    Math.max(
      0,
      projectile.maximumTravelDistance - projectile.travelledDistance,
    )
  const stepDistance = Math.min(
    remainingDistance,
    projectile.flightSpeed * (deltaMs / 1_000),
  )
  projectile.travelledDistance += stepDistance
  projectile.thetaRadians = solveArchimedeanSpiralTheta(
    projectile.travelledDistance,
    projectile.spiralTightness,
    projectile.initialRadius,
  )
  writeArchimedeanSpiralPose(
    projectile,
    projectile.originX,
    projectile.originY,
    projectile.thetaRadians,
    projectile.spiralTightness,
    projectile.initialRadius,
    projectile.initialPhaseRadians,
    projectile.directionSign,
  )
  return projectile.travelledDistance >= projectile.maximumTravelDistance
}

export function runHostileProjectileSystem(
  world: WorldState,
  deltaMs: number,
): void {
  runHostileProjectileDissipationSystem(world, deltaMs)
  const samplePose = world.hostileProjectileSweepSample
  world.diagnostics.activeStagedHostileProjectileCount = 0
  world.diagnostics.activeReleasedHostileProjectileCount = 0
  world.diagnostics.activeDissipatingHostileProjectileCount = 0
  for (const projectile of world.hostileProjectiles) {
    if (projectile.phase === HOSTILE_PROJECTILE_PHASE.STAGED_IN_RING) {
      if (!sourceCanAttack(world, projectile)) {
        beginDissipation(world, projectile)
      }
      if (projectile.phase === HOSTILE_PROJECTILE_PHASE.STAGED_IN_RING) {
        world.diagnostics.activeStagedHostileProjectileCount += 1
      } else {
        world.diagnostics.activeDissipatingHostileProjectileCount += 1
      }
      continue
    }
    if (projectile.phase === HOSTILE_PROJECTILE_PHASE.DISSIPATING) {
      world.diagnostics.activeDissipatingHostileProjectileCount += 1
      continue
    }
    if (projectile.phase !== HOSTILE_PROJECTILE_PHASE.ACTIVE) {
      continue
    }
    if (!sourceCanAttack(world, projectile)) {
      beginDissipation(world, projectile)
      world.diagnostics.activeDissipatingHostileProjectileCount += 1
      continue
    }
    const rangeExhausted = moveProjectile(projectile, deltaMs)
    if (hasCurvedSweptPlayerContact(world, projectile, samplePose)) {
      appendDamageCandidate(world, projectile)
      projectile.phase = HOSTILE_PROJECTILE_PHASE.SPENT
      world.diagnostics.hostileProjectilePreciseHits += 1
      if (
        world.runTimeMs < world.player.survival.damageInvulnerableUntilMs
      ) {
        world.diagnostics.hostileProjectilesConsumedWhileInvulnerable += 1
      }
      continue
    }
    if (rangeExhausted) {
      projectile.phase = HOSTILE_PROJECTILE_PHASE.SPENT
      world.diagnostics.hostileProjectilesExpired += 1
      continue
    }
    world.diagnostics.activeReleasedHostileProjectileCount += 1
  }
}
