import assert from 'node:assert/strict'
import test from 'node:test'
import { circlesIntersect } from '../../src/game/systems/combatGeometry.ts'
import { normalizeMovement } from '../../src/game/systems/movementVector.ts'

test('normalizes diagonal movement to unit length', () => {
  const movement = normalizeMovement(1, -1)

  assert.ok(Math.abs(Math.hypot(movement.x, movement.y) - 1) < 0.000_001)
})

test('returns zero movement when no direction is pressed', () => {
  assert.deepEqual(normalizeMovement(0, 0), { x: 0, y: 0 })
})

test('detects intersecting gameplay circles without square roots', () => {
  assert.equal(circlesIntersect(0, 0, 10, 15, 0, 6), true)
  assert.equal(circlesIntersect(0, 0, 10, 17, 0, 6), false)
})
