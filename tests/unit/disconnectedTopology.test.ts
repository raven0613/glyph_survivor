import assert from 'node:assert/strict'
import test from 'node:test'
import { GLYPH_CELL_STATE } from '../../src/game/glyph/glyphCell.ts'
import { classifyDisconnectedTopology } from '../../src/game/glyph/disconnectedTopology.ts'

const PARAMETERS = Object.freeze({
  protectedComponentRatio: 0.8,
  isolationBonusScale: 0.6,
  maximumDamageMultiplier: 1.6,
})

function living(id: number, topologyX: number, topologyY: number) {
  return {
    id,
    state: GLYPH_CELL_STATE.HEALTHY,
    topologyX,
    topologyY,
  }
}

test('protects every component at or above eighty percent of the largest component', () => {
  const cells = [
    ...Array.from({ length: 5 }, (_, index) => living(index + 1, index, 0)),
    ...Array.from({ length: 4 }, (_, index) => living(index + 6, index, 2)),
    living(10, 9, 9),
  ]

  const snapshot = classifyDisconnectedTopology(7, cells, PARAMETERS)

  assert.equal(snapshot.totalLivingCellCount, 10)
  assert.equal(snapshot.largestComponentSize, 5)
  assert.equal(snapshot.componentByGlyphId.get(1)?.multiplier, 1)
  assert.equal(snapshot.componentByGlyphId.get(6)?.multiplier, 1)
  assert.ok(
    Math.abs((snapshot.componentByGlyphId.get(10)?.multiplier ?? 0) - 1.54) <
      1e-9,
  )
  assert.equal(snapshot.protectedComponentCount, 2)
  assert.equal(snapshot.vulnerableComponentCount, 1)
})

test('treats authored floating Cells as ordinary vulnerable components', () => {
  const snapshot = classifyDisconnectedTopology(
    3,
    [living(1, 0, 0), living(2, 1, 0), living(3, 8, 8)],
    PARAMETERS,
  )

  assert.equal(snapshot.componentByGlyphId.get(3)?.isProtected, false)
  assert.ok((snapshot.componentByGlyphId.get(3)?.severity ?? 0) > 0)
})

test('naturally leaves one-component one-letter and two-letter bodies at one-times damage', () => {
  const oneLetter = classifyDisconnectedTopology(
    1,
    [living(1, 0, 0)],
    PARAMETERS,
  )
  const twoLetter = classifyDisconnectedTopology(
    2,
    [living(1, 0, 0), living(2, 0, 1)],
    PARAMETERS,
  )

  assert.equal(oneLetter.componentByGlyphId.get(1)?.multiplier, 1)
  assert.equal(twoLetter.componentByGlyphId.get(1)?.multiplier, 1)
  assert.equal(twoLetter.componentByGlyphId.get(2)?.multiplier, 1)
})

test('excludes Husk Cells from nodes and connectivity', () => {
  const snapshot = classifyDisconnectedTopology(
    4,
    [
      living(1, 0, 0),
      { ...living(2, 1, 0), state: GLYPH_CELL_STATE.HUSK },
      living(3, 2, 0),
    ],
    PARAMETERS,
  )

  assert.equal(snapshot.totalLivingCellCount, 2)
  assert.equal(snapshot.componentByGlyphId.has(2), false)
  assert.equal(snapshot.components.length, 2)
})
