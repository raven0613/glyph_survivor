import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import type { ProjectileState } from '../runtime/worldEntities.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { steerProjectileTowardTarget } from './homingSteering.ts'
import {
  canMaintainTargetLock,
  getStateAfterTargetLoss,
} from './projectileTrackingRules.ts'
import { selectBestProjectileTarget } from './targetSelection.ts'

export function prepareProjectileTargetingSystem(world: WorldState): void {
  for (const projectile of world.projectiles) {
    if (!projectile.isAlive || projectile.trackingState !== 'LOCKED') {
      continue
    }

    const target =
      projectile.targetEnemyId === null
        ? undefined
        : world.enemyById.get(projectile.targetEnemyId)

    if (!target || !canMaintainTargetLock(projectile, target)) {
      projectile.targetEnemyId = null
      projectile.trackingState = getStateAfterTargetLoss(
        projectile.trackingMode,
      )
      continue
    }

    target.trackingLoad += 1
  }
}

function tryAcquireHomingTarget(
  world: WorldState,
  projectile: ProjectileState,
): void {
  const speed = Math.hypot(projectile.velocityX, projectile.velocityY)
  const forwardX = speed === 0 ? projectile.launchDirectionX : projectile.velocityX / speed
  const forwardY = speed === 0 ? projectile.launchDirectionY : projectile.velocityY / speed
  const candidates = world.enemySpatialHash.queryCircle(
    projectile.x,
    projectile.y,
    projectile.trackingRange,
    world.targetCandidates,
  )
  const target = selectBestProjectileTarget(
    candidates,
    projectile.x,
    projectile.y,
    forwardX,
    forwardY,
    projectile.trackingRange,
    -1,
  )

  world.diagnostics.targetSearchCount += 1
  projectile.nextTargetSearchTimeMs =
    world.runTimeMs + projectile.retargetIntervalMs

  if (!target) {
    return
  }

  projectile.targetEnemyId = target.id
  projectile.trackingState = 'LOCKED'
  target.trackingLoad += 1
  world.diagnostics.targetReacquireCount += 1
}

function reacquireHomingTargets(world: WorldState): void {
  const projectileCount = world.projectiles.length

  if (projectileCount === 0 || world.activeEnemyCount === 0) {
    return
  }

  let index = world.targetSearchCursor % projectileCount
  let inspectedCount = 0
  let searchCount = 0

  while (
    inspectedCount < projectileCount &&
    searchCount < GAME_CONFIG.targetSearchBudgetPerStep
  ) {
    const projectile = world.projectiles[index]

    if (
      projectile.isAlive &&
      projectile.trackingMode === 'HOMING' &&
      projectile.trackingState === 'SEEKING' &&
      world.runTimeMs >= projectile.nextTargetSearchTimeMs
    ) {
      tryAcquireHomingTarget(world, projectile)
      searchCount += 1
    }

    inspectedCount += 1
    index = (index + 1) % projectileCount
  }

  world.targetSearchCursor = index
}

export function runProjectileTargetingSystem(
  world: WorldState,
  deltaMs: number,
): void {
  reacquireHomingTargets(world)

  for (const projectile of world.projectiles) {
    if (!projectile.isAlive || projectile.trackingState !== 'LOCKED') {
      continue
    }

    const target =
      projectile.targetEnemyId === null
        ? undefined
        : world.enemyById.get(projectile.targetEnemyId)

    if (target) {
      steerProjectileTowardTarget(projectile, target, deltaMs)
    }
  }
}
