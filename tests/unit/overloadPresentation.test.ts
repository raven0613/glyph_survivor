import assert from 'node:assert/strict'
import test from 'node:test'
import { Matrix } from 'pixi.js'
import { calculateOverloadCompression } from '../../src/game/bridge/overloadPresentation.ts'
import { PROTOTYPE_COMBAT_VISUAL_THEME } from '../../src/game/content/visuals/prototypeCombatVisualTheme.ts'
import { writeOverloadDeformationMatrix } from '../../src/game/rendering/overloadDeformationPool.ts'

test('uses a quick attack, explicit hold, and clean settle for compression', () => {
  const profile =
    PROTOTYPE_COMBAT_VISUAL_THEME.effects.runModifiers.overload.compression
  const totalDurationMs =
    profile.attackDurationMs +
    profile.holdDurationMs +
    profile.settleDurationMs

  const start = calculateOverloadCompression(0, profile)
  const attackEnd = calculateOverloadCompression(
    profile.attackDurationMs,
    profile,
  )
  const holdEnd = calculateOverloadCompression(
    profile.attackDurationMs + profile.holdDurationMs,
    profile,
  )
  const settled = calculateOverloadCompression(totalDurationMs, profile)

  assert.deepEqual(start, { parallelScale: 1, perpendicularScale: 1 })
  assert.equal(attackEnd.parallelScale, profile.parallelScale)
  assert.equal(attackEnd.perpendicularScale, profile.perpendicularScale)
  assert.deepEqual(holdEnd, attackEnd)
  assert.deepEqual(settled, { parallelScale: 1, perpendicularScale: 1 })
})

test('compresses along an arbitrary world-space impact axis', () => {
  const axis = Math.SQRT1_2
  const matrix = new Matrix()
  writeOverloadDeformationMatrix(matrix, {
    id: 1,
    glyphFrame: 1,
    x: 10,
    y: 20,
    rotation: 0,
    scale: 1,
    alpha: 1,
    tint: 0xffffff,
    axisX: axis,
    axisY: axis,
    parallelScale: 0.7,
    perpendicularScale: 1.1,
  })

  const transformedAxisX = matrix.a * axis + matrix.c * axis
  const transformedAxisY = matrix.b * axis + matrix.d * axis
  const normalX = -axis
  const normalY = axis
  const transformedNormalX = matrix.a * normalX + matrix.c * normalY
  const transformedNormalY = matrix.b * normalX + matrix.d * normalY

  assert.ok(
    Math.abs(Math.hypot(transformedAxisX, transformedAxisY) - 0.7) < 1e-9,
  )
  assert.ok(
    Math.abs(Math.hypot(transformedNormalX, transformedNormalY) - 1.1) < 1e-9,
  )
  assert.equal(matrix.tx, 10)
  assert.equal(matrix.ty, 20)
})
