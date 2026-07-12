export function normalizeMovement(
  horizontal: number,
  vertical: number,
): { readonly x: number; readonly y: number } {
  const length = Math.hypot(horizontal, vertical)

  if (length === 0) {
    return { x: 0, y: 0 }
  }

  return {
    x: horizontal / length,
    y: vertical / length,
  }
}
