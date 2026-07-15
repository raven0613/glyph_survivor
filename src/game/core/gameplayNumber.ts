const GAMEPLAY_ZERO_EPSILON = 1e-9
const GAMEPLAY_DECIMAL_SCALE = 1e12

/** Applies the shared precision rule for finite, non-negative gameplay values. */
export function normalizeNonNegativeGameplayNumber(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('Gameplay value must be finite and non-negative.')
  }
  if (value <= GAMEPLAY_ZERO_EPSILON) {
    return 0
  }
  return Math.round(value * GAMEPLAY_DECIMAL_SCALE) / GAMEPLAY_DECIMAL_SCALE
}
