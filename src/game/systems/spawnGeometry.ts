import type { Bounds, CameraView } from '../runtime/cameraTransform.ts'
import { circlesIntersect } from './combatGeometry.ts'

export type SpawnSide = 'top' | 'right' | 'bottom' | 'left'

export interface CircleFootprint {
  readonly x: number
  readonly y: number
  readonly radius: number
}

const SPAWN_DISTANCE_MIN = 150
const SPAWN_DISTANCE_RANGE = 150
const FORWARD_SPAWN_CHANCE = 0.6
const SPAWN_SIDES: readonly SpawnSide[] = ['top', 'right', 'bottom', 'left']

function getForwardSide(moveX: number, moveY: number): SpawnSide | null {
  if (moveX === 0 && moveY === 0) {
    return null
  }

  if (Math.abs(moveX) >= Math.abs(moveY)) {
    return moveX >= 0 ? 'right' : 'left'
  }

  return moveY >= 0 ? 'bottom' : 'top'
}

export function chooseSpawnSide(
  moveX: number,
  moveY: number,
  random: () => number,
): SpawnSide {
  const forwardSide = getForwardSide(moveX, moveY)
  const biasRoll = random()

  if (forwardSide && biasRoll < FORWARD_SPAWN_CHANCE) {
    return forwardSide
  }

  const availableSides = forwardSide
    ? SPAWN_SIDES.filter((side) => side !== forwardSide)
    : SPAWN_SIDES
  const index = Math.min(
    Math.floor(random() * availableSides.length),
    availableSides.length - 1,
  )

  return availableSides[index]
}

export function createSpawnCandidate(
  camera: CameraView,
  side: SpawnSide,
  random: () => number,
): { readonly x: number; readonly y: number } {
  const distance = SPAWN_DISTANCE_MIN + random() * SPAWN_DISTANCE_RANGE

  if (side === 'top' || side === 'bottom') {
    return {
      x: camera.left + random() * camera.width,
      y: side === 'top' ? camera.top - distance : camera.bottom + distance,
    }
  }

  return {
    x: side === 'left' ? camera.left - distance : camera.right + distance,
    y: camera.top + random() * camera.height,
  }
}

function circleIntersectsRectangle(
  circle: CircleFootprint,
  rectangle: Bounds,
): boolean {
  const nearestX = Math.max(rectangle.left, Math.min(circle.x, rectangle.right))
  const nearestY = Math.max(rectangle.top, Math.min(circle.y, rectangle.bottom))
  const deltaX = circle.x - nearestX
  const deltaY = circle.y - nearestY

  return deltaX * deltaX + deltaY * deltaY <= circle.radius * circle.radius
}

export function isSpawnCandidateValid(
  candidate: { readonly x: number; readonly y: number },
  radius: number,
  camera: CameraView,
  world: Bounds,
  enemies: readonly CircleFootprint[],
  obstacles: readonly Bounds[],
): boolean {
  if (
    candidate.x - radius < world.left ||
    candidate.x + radius > world.right ||
    candidate.y - radius < world.top ||
    candidate.y + radius > world.bottom
  ) {
    return false
  }

  if (circleIntersectsRectangle({ ...candidate, radius }, camera)) {
    return false
  }

  if (
    enemies.some((enemy) =>
      circlesIntersect(
        candidate.x,
        candidate.y,
        radius,
        enemy.x,
        enemy.y,
        enemy.radius,
      ),
    )
  ) {
    return false
  }

  return !obstacles.some((obstacle) =>
    circleIntersectsRectangle({ ...candidate, radius }, obstacle),
  )
}
