export function getCenteredEmissionAngleOffset(
  emissionIndex: number,
  emissionCount: number,
  angleSpacingRadians: number,
): number {
  if (
    !Number.isSafeInteger(emissionCount) ||
    emissionCount <= 0
  ) {
    throw new RangeError('emissionCount must be a positive safe integer.')
  }
  if (
    !Number.isSafeInteger(emissionIndex) ||
    emissionIndex < 0 ||
    emissionIndex >= emissionCount
  ) {
    throw new RangeError('emissionIndex must identify an emission in the volley.')
  }
  if (!Number.isFinite(angleSpacingRadians) || angleSpacingRadians < 0) {
    throw new RangeError(
      'angleSpacingRadians must be finite and non-negative.',
    )
  }
  return (emissionIndex - (emissionCount - 1) / 2) * angleSpacingRadians
}
