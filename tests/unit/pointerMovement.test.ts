import assert from 'node:assert/strict'
import test from 'node:test'
import { hasPointerPositionChanged } from '../../src/game/host/pointerMovement.ts'

test('ignores sub-pixel pointer jitter below the aim update threshold', () => {
  assert.equal(hasPointerPositionChanged(100, 100, 100.2, 100.2, 0.5), false)
})

test('reports pointer movement at or beyond the aim update threshold', () => {
  assert.equal(hasPointerPositionChanged(100, 100, 100.5, 100, 0.5), true)
})
