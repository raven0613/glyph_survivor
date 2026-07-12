import {
  calculateCameraView,
  screenToWorld,
} from '../runtime/cameraTransform.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { normalizeMovement } from './movementVector.ts'

export function runAimSystem(world: WorldState): void {
  const input = world.input
  const player = world.player

  if (
    !input.hasPointer ||
    input.pointerRevision === player.lastProcessedPointerRevision
  ) {
    return
  }

  player.lastProcessedPointerRevision = input.pointerRevision
  const camera = calculateCameraView(
    player.x,
    player.y,
    world.viewportWidth,
    world.viewportHeight,
  )
  const pointer = screenToWorld(
    input.pointerScreenX,
    input.pointerScreenY,
    camera,
  )
  const aim = normalizeMovement(pointer.x - player.x, pointer.y - player.y)

  if (aim.x !== 0 || aim.y !== 0) {
    player.aimX = aim.x
    player.aimY = aim.y
  }
}
