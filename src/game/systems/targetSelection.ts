import type { EnemyPhase } from '../runtime/worldEntities.ts'

export interface TargetCandidate {
  readonly id: number
  readonly x: number
  readonly y: number
  readonly phase: EnemyPhase
  readonly trackingLoad: number
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
  const rangeSquared = range * range
  let bestTarget: T | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    if (candidate.phase !== 'ACTIVE') {
      continue
    }

    const deltaX = candidate.x - originX
    const deltaY = candidate.y - originY
    const distanceSquared = deltaX * deltaX + deltaY * deltaY

    if (distanceSquared > rangeSquared) {
      continue
    }

    if (distanceSquared > 0) {
      const inverseDistance = 1 / Math.sqrt(distanceSquared)
      const directionCos =
        (forwardX * deltaX + forwardY * deltaY) * inverseDistance

      if (directionCos < minimumDirectionCos) {
        continue
      }
    }

    const score =
      distanceSquared *
      (1 + candidate.trackingLoad * TRACKING_LOAD_DISTANCE_PENALTY)
    const winsTie = score === bestScore && candidate.id < (bestTarget?.id ?? Infinity)

    if (score < bestScore || winsTie) {
      bestTarget = candidate
      bestScore = score
    }
  }

  return bestTarget
}
