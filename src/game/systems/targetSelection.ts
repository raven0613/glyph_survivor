import {
  isEnemyCombatPhase,
  type EnemyPhase,
} from '../runtime/worldEntities.ts'

export interface TargetCandidate {
  readonly id: number
  readonly x: number
  readonly y: number
  readonly phase: EnemyPhase
  readonly trackingLoad: number
}

export interface TargetAnchorPoint {
  readonly id: string | null
  readonly x: number
  readonly y: number
}

export interface ProjectileTargetLock<T extends TargetCandidate> {
  readonly target: T
  readonly anchorId: string | null
  readonly x: number
  readonly y: number
}

const TRACKING_LOAD_DISTANCE_PENALTY = 0.35

export function selectBestProjectileTarget<T extends TargetCandidate>(
  candidates: readonly T[],
  originX: number,
  originY: number,
  forwardX: number,
  forwardY: number,
  range: number,
  minimumDirectionCos: number,
): T | null {
  return (
    selectBestProjectileTargetLock(
      candidates,
      originX,
      originY,
      forwardX,
      forwardY,
      range,
      minimumDirectionCos,
      (candidate) => [
        { id: null, x: candidate.x, y: candidate.y },
      ],
    )?.target ?? null
  )
}

export function selectBestProjectileTargetLock<T extends TargetCandidate>(
  candidates: readonly T[],
  originX: number,
  originY: number,
  forwardX: number,
  forwardY: number,
  range: number,
  minimumDirectionCos: number,
  resolveAnchors: (candidate: T) => readonly TargetAnchorPoint[],
): ProjectileTargetLock<T> | null {
  const rangeSquared = range * range
  let bestTarget: ProjectileTargetLock<T> | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    if (!isEnemyCombatPhase(candidate.phase)) {
      continue
    }

    let selectedAnchor: TargetAnchorPoint | null = null
    let selectedDistanceSquared = Number.POSITIVE_INFINITY
    let selectedMissDistanceSquared = Number.POSITIVE_INFINITY
    let selectedForwardDistance = Number.POSITIVE_INFINITY
    for (const anchor of resolveAnchors(candidate)) {
      const deltaX = anchor.x - originX
      const deltaY = anchor.y - originY
      const distanceSquared = deltaX * deltaX + deltaY * deltaY
      if (distanceSquared > rangeSquared) {
        continue
      }
      const forwardDistance = forwardX * deltaX + forwardY * deltaY
      if (distanceSquared > 0) {
        const directionCos = forwardDistance / Math.sqrt(distanceSquared)
        if (directionCos < minimumDirectionCos) {
          continue
        }
      }
      const missDistanceSquared = Math.max(
        0,
        distanceSquared - forwardDistance * forwardDistance,
      )
      const stableAnchorId = anchor.id ?? ''
      const selectedStableAnchorId = selectedAnchor?.id ?? ''
      const winsTie =
        missDistanceSquared === selectedMissDistanceSquared &&
        (forwardDistance < selectedForwardDistance ||
          (forwardDistance === selectedForwardDistance &&
            stableAnchorId < selectedStableAnchorId))
      if (
        missDistanceSquared < selectedMissDistanceSquared ||
        winsTie
      ) {
        selectedAnchor = anchor
        selectedDistanceSquared = distanceSquared
        selectedMissDistanceSquared = missDistanceSquared
        selectedForwardDistance = forwardDistance
      }
    }
    if (!selectedAnchor) {
      continue
    }

    const score =
      selectedDistanceSquared *
      (1 + candidate.trackingLoad * TRACKING_LOAD_DISTANCE_PENALTY)
    const winsTie =
      score === bestScore && candidate.id < (bestTarget?.target.id ?? Infinity)

    if (score < bestScore || winsTie) {
      bestTarget = {
        target: candidate,
        anchorId: selectedAnchor.id,
        x: selectedAnchor.x,
        y: selectedAnchor.y,
      }
      bestScore = score
    }
  }

  return bestTarget
}
