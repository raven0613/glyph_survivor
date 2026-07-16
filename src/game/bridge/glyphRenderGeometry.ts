import type { CameraView } from '../runtime/cameraTransform.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'

export const COLLAPSE_SCATTER_DISTANCE = 42
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

export function interpolate(
  previous: number,
  current: number,
  alpha: number,
): number {
  return previous + (current - previous) * alpha
}

export function isWorldPositionVisible(
  x: number,
  y: number,
  camera: CameraView,
): boolean {
  return (
    x >= camera.left - GAME_CONFIG.renderMargin &&
    x <= camera.right + GAME_CONFIG.renderMargin &&
    y >= camera.top - GAME_CONFIG.renderMargin &&
    y <= camera.bottom + GAME_CONFIG.renderMargin
  )
}
