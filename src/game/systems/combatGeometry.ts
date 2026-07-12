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
