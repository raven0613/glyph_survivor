export function hasPointerPositionChanged(
  previousX: number,
  previousY: number,
  nextX: number,
  nextY: number,
  minimumDistance: number,
): boolean {
  const deltaX = nextX - previousX
  const deltaY = nextY - previousY

  return (
    deltaX * deltaX + deltaY * deltaY >= minimumDistance * minimumDistance
  )
}
