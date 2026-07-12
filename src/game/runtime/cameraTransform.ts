export interface CameraView {
  readonly centerX: number
  readonly centerY: number
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}

export interface Bounds {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface MovementBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export function calculateCameraView(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
): CameraView {
  const halfWidth = width / 2
  const halfHeight = height / 2

  return {
    centerX,
    centerY,
    left: centerX - halfWidth,
    top: centerY - halfHeight,
    right: centerX + halfWidth,
    bottom: centerY + halfHeight,
    width,
    height,
  }
}

export function calculatePlayerMovementBounds(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
): MovementBounds {
  const halfWidth = Math.min(viewportWidth, worldWidth) / 2
  const halfHeight = Math.min(viewportHeight, worldHeight) / 2

  return {
    minX: halfWidth,
    minY: halfHeight,
    maxX: worldWidth - halfWidth,
    maxY: worldHeight - halfHeight,
  }
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: CameraView,
): { readonly x: number; readonly y: number } {
  return {
    x: camera.left + screenX,
    y: camera.top + screenY,
  }
}

export function isInsideBounds(
  x: number,
  y: number,
  bounds: Bounds,
): boolean {
  return (
    x >= bounds.left &&
    x <= bounds.right &&
    y >= bounds.top &&
    y <= bounds.bottom
  )
}
