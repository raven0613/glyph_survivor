import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getDamageSpreadBandIndex,
  getGlyphExteriorDistanceToDamageShape,
} from '../../src/game/systems/damageSpreadGeometry.ts'
import type { DamageSelectionCell } from '../../src/game/systems/glyphDamageSelection.ts'
import { GLYPH_CELL_STATE } from '../../src/game/glyph/glyphStore.ts'

function cell(
  worldX: number,
  worldY: number,
  collisionRadius = 2,
): DamageSelectionCell {
  return {
    id: 1,
    state: GLYPH_CELL_STATE.HEALTHY,
    topologyX: 0,
    topologyY: 0,
    worldX,
    worldY,
    collisionRadius,
  }
}

test('classifies Circle spread bands from the shape exterior including Glyph radius', () => {
  const shape = { kind: 'CIRCLE' as const, x: 0, y: 0, radius: 10 }

  assert.equal(getGlyphExteriorDistanceToDamageShape(cell(12, 0), shape), 0)
  assert.equal(getDamageSpreadBandIndex(cell(36, 0), shape, 24, 3), 0)
  assert.equal(getDamageSpreadBandIndex(cell(46, 0), shape, 24, 3), 1)
  assert.equal(getDamageSpreadBandIndex(cell(85, 0), shape, 24, 3), null)
})

test('measures Cone spread once from its complete arc and side boundaries', () => {
  const shape = {
    kind: 'CONE' as const,
    x: 0,
    y: 0,
    directionX: 1,
    directionY: 0,
    range: 100,
    halfAngleRadians: Math.PI / 4,
  }

  assert.equal(getDamageSpreadBandIndex(cell(110, 0, 5), shape, 24, 3), 0)
  assert.equal(getDamageSpreadBandIndex(cell(60, 70, 5), shape, 24, 3), 0)
  assert.equal(getDamageSpreadBandIndex(cell(-40, 0, 5), shape, 24, 3), 1)
  assert.equal(getDamageSpreadBandIndex(cell(50, 0, 5), shape, 24, 3), null)
})
