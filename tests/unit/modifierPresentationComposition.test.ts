import assert from 'node:assert/strict'
import test from 'node:test'
import {
  composeModifierPresentationMotion,
  resolveVolatileSourceScaleMultiplier,
} from '../../src/game/bridge/modifierPresentationComposition.ts'
import { PROTOTYPE_COMBAT_VISUAL_THEME } from '../../src/game/content/visuals/prototypeCombatVisualTheme.ts'

test('centrally clamps simultaneous Modifier motion without mutating either channel', () => {
  const disconnected = { offsetX: 5, offsetY: 4, rotation: 0.04 }
  const volatile = { offsetX: 3, offsetY: 2, rotation: 0.03 }
  const limits =
    PROTOTYPE_COMBAT_VISUAL_THEME.effects.runModifiers.composition

  const result = composeModifierPresentationMotion(
    disconnected,
    volatile,
    limits,
  )

  assert.ok(Math.hypot(result.offsetX, result.offsetY) <= limits.maximumOffset)
  assert.ok(Math.abs(result.rotation) <= limits.maximumRotation)
  assert.deepEqual(disconnected, { offsetX: 5, offsetY: 4, rotation: 0.04 })
  assert.deepEqual(volatile, { offsetX: 3, offsetY: 2, rotation: 0.03 })
})

test('preserves sub-limit motion exactly', () => {
  const result = composeModifierPresentationMotion(
    { offsetX: 1, offsetY: -2, rotation: 0.01 },
    { offsetX: -0.25, offsetY: 0.5, rotation: -0.005 },
    { maximumOffset: 6, maximumRotation: 0.05 },
  )

  assert.deepEqual(result, {
    offsetX: 0.75,
    offsetY: -1.5,
    rotation: 0.005,
  })
})

test('lets OVERLOAD deformation own transient scale while retaining VOLATILE overlays', () => {
  assert.equal(resolveVolatileSourceScaleMultiplier(0.74, false), 0.74)
  assert.equal(resolveVolatileSourceScaleMultiplier(0.74, true), 1)
})
