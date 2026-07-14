import assert from 'node:assert/strict'
import test from 'node:test'
import { getCenteredEmissionAngleOffset } from '../../src/game/systems/attackEmissionAngles.ts'

test('centers even and odd emission counts around the aim axis', () => {
  const spacing = (8 * Math.PI) / 180

  assert.deepEqual(
    [0, 1].map((index) =>
      getCenteredEmissionAngleOffset(index, 2, spacing),
    ),
    [-spacing / 2, spacing / 2],
  )
  assert.deepEqual(
    [0, 1, 2].map((index) =>
      getCenteredEmissionAngleOffset(index, 3, spacing),
    ),
    [-spacing, 0, spacing],
  )
})

test('rejects invalid emission indexes and spacing', () => {
  assert.throws(
    () => getCenteredEmissionAngleOffset(2, 2, 0.1),
    /emissionIndex/,
  )
  assert.throws(
    () => getCenteredEmissionAngleOffset(0, 2, Number.NaN),
    /angleSpacingRadians/,
  )
})
