export function circlesIntersect(
  firstX: number,
  firstY: number,
  firstRadius: number,
  secondX: number,
  secondY: number,
  secondRadius: number,
): boolean {
  const deltaX = firstX - secondX
  const deltaY = firstY - secondY
  const combinedRadius = firstRadius + secondRadius

  return deltaX * deltaX + deltaY * deltaY <= combinedRadius * combinedRadius
}

export function getFirstSegmentCircleContactTime(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  circleX: number,
  circleY: number,
  combinedRadius: number,
): number | null {
  const offsetX = startX - circleX
  const offsetY = startY - circleY
  const radiusSquared = combinedRadius * combinedRadius
  if (offsetX * offsetX + offsetY * offsetY <= radiusSquared) {
    return 0
  }

  const segmentX = endX - startX
  const segmentY = endY - startY
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY
  if (segmentLengthSquared === 0) {
    return null
  }

  const projection = offsetX * segmentX + offsetY * segmentY
  const discriminant =
    projection * projection -
    segmentLengthSquared *
      (offsetX * offsetX + offsetY * offsetY - radiusSquared)
  if (discriminant < 0) {
    return null
  }

  const contactTime =
    (-projection - Math.sqrt(discriminant)) / segmentLengthSquared
  return contactTime >= 0 && contactTime <= 1 ? contactTime : null
}
