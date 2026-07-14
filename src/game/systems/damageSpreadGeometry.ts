import type {
  ConeDamageShape,
  DamageSelectionCell,
  DamageSelectionShape,
} from './glyphDamageSelection.ts'

function distanceToSegment(
  pointX: number,
  pointY: number,
  endX: number,
  endY: number,
): number {
  const lengthSquared = endX * endX + endY * endY
  if (lengthSquared === 0) {
    return Math.hypot(pointX, pointY)
  }
  const projection = Math.max(
    0,
    Math.min(1, (pointX * endX + pointY * endY) / lengthSquared),
  )
  return Math.hypot(
    pointX - endX * projection,
    pointY - endY * projection,
  )
}

function getPointDistanceToCone(
  pointX: number,
  pointY: number,
  shape: ConeDamageShape,
): number {
  const directionLength = Math.hypot(shape.directionX, shape.directionY)
  if (directionLength === 0) {
    return Number.POSITIVE_INFINITY
  }
  const directionX = shape.directionX / directionLength
  const directionY = shape.directionY / directionLength
  const deltaX = pointX - shape.x
  const deltaY = pointY - shape.y
  const localX = deltaX * directionX + deltaY * directionY
  const localY = -deltaX * directionY + deltaY * directionX
  const distance = Math.hypot(localX, localY)
  if (shape.halfAngleRadians >= Math.PI) {
    return Math.max(0, distance - shape.range)
  }
  const absoluteAngle = Math.abs(Math.atan2(localY, localX))
  if (absoluteAngle <= shape.halfAngleRadians) {
    return Math.max(0, distance - shape.range)
  }
  const sideAngle = Math.sign(localY || 1) * shape.halfAngleRadians
  return distanceToSegment(
    localX,
    localY,
    Math.cos(sideAngle) * shape.range,
    Math.sin(sideAngle) * shape.range,
  )
}

/** Returns a non-positive value when the Glyph Circle intersects the shape. */
export function getGlyphExteriorDistanceToDamageShape(
  cell: DamageSelectionCell,
  shape: DamageSelectionShape,
): number {
  if (shape.kind === 'CIRCLE') {
    return (
      Math.hypot(cell.worldX - shape.x, cell.worldY - shape.y) -
      shape.radius -
      cell.collisionRadius
    )
  }
  return (
    getPointDistanceToCone(cell.worldX, cell.worldY, shape) -
    cell.collisionRadius
  )
}

export function intersectsDamageShape(
  cell: DamageSelectionCell,
  shape: DamageSelectionShape,
): boolean {
  return getGlyphExteriorDistanceToDamageShape(cell, shape) <= 0
}

export function getDamageSpreadBandIndex(
  cell: DamageSelectionCell,
  shape: DamageSelectionShape,
  bandWidth: number,
  bandCount: number,
): number | null {
  if (!Number.isFinite(bandWidth) || bandWidth <= 0) {
    throw new RangeError('bandWidth must be finite and greater than zero.')
  }
  if (!Number.isSafeInteger(bandCount) || bandCount <= 0) {
    throw new RangeError('bandCount must be a positive safe integer.')
  }
  const exteriorDistance = getGlyphExteriorDistanceToDamageShape(cell, shape)
  if (exteriorDistance <= 0) {
    return null
  }
  const bandIndex = Math.ceil(exteriorDistance / bandWidth) - 1
  return bandIndex < bandCount ? bandIndex : null
}
