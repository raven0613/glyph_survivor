import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DAMAGE_TARGET_MODE,
  selectGlyphDamage,
  type DamageSelectionCell,
} from '../../src/game/systems/glyphDamageSelection.ts'
import { GLYPH_CELL_STATE } from '../../src/game/glyph/glyphStore.ts'

function createCell(
  id: number,
  topologyX: number,
  state: DamageSelectionCell['state'],
): DamageSelectionCell {
  return {
    id,
    state,
    topologyX,
    topologyY: 0,
    worldX: topologyX * 20,
    worldY: 0,
    collisionRadius: 8,
  }
}

test('prioritizes a living impact cell over a closer husk', () => {
  const husk = createCell(1, 0, GLYPH_CELL_STATE.HUSK)
  const living = createCell(2, 1, GLYPH_CELL_STATE.HEALTHY)

  const selection = selectGlyphDamage(
    [husk, living],
    { kind: 'CIRCLE', x: 10, y: 0, radius: 4 },
    DAMAGE_TARGET_MODE.SINGLE,
  )

  assert.deepEqual(selection.impactCells.map((cell) => cell.id), [1, 2])
  assert.deepEqual(selection.damageTargets.map((cell) => cell.id), [2])
})

test('advances point damage through a husk region to the nearest living frontier', () => {
  const cells = [
    createCell(1, 0, GLYPH_CELL_STATE.HUSK),
    createCell(2, 1, GLYPH_CELL_STATE.HUSK),
    createCell(3, 2, GLYPH_CELL_STATE.DAMAGED),
    createCell(4, 3, GLYPH_CELL_STATE.HEALTHY),
  ]

  const selection = selectGlyphDamage(
    cells,
    { kind: 'CIRCLE', x: 0, y: 0, radius: 2 },
    DAMAGE_TARGET_MODE.SINGLE,
  )

  assert.deepEqual(selection.impactCells.map((cell) => cell.id), [1])
  assert.deepEqual(selection.damageTargets.map((cell) => cell.id), [3])
})

test('fills an area quota with unique living cells beyond the impact shape', () => {
  const cells = [
    createCell(1, 0, GLYPH_CELL_STATE.HUSK),
    createCell(2, 1, GLYPH_CELL_STATE.HUSK),
    createCell(3, 2, GLYPH_CELL_STATE.HUSK),
    createCell(4, 3, GLYPH_CELL_STATE.DAMAGED),
    createCell(5, 4, GLYPH_CELL_STATE.HEALTHY),
    createCell(6, 5, GLYPH_CELL_STATE.HEALTHY),
    createCell(7, 6, GLYPH_CELL_STATE.HEALTHY),
  ]

  const selection = selectGlyphDamage(
    cells,
    { kind: 'CIRCLE', x: 20, y: 0, radius: 28 },
    DAMAGE_TARGET_MODE.AREA,
  )

  assert.deepEqual(selection.impactCells.map((cell) => cell.id), [2, 1, 3])
  assert.deepEqual(selection.damageTargets.map((cell) => cell.id), [4, 5, 6])
})

test('does not stack an unfilled area quota onto the last living cell', () => {
  const cells = [
    createCell(1, 0, GLYPH_CELL_STATE.HUSK),
    createCell(2, 1, GLYPH_CELL_STATE.HUSK),
    createCell(3, 2, GLYPH_CELL_STATE.HUSK),
    createCell(4, 3, GLYPH_CELL_STATE.HEALTHY),
  ]

  const selection = selectGlyphDamage(
    cells,
    { kind: 'CIRCLE', x: 20, y: 0, radius: 28 },
    DAMAGE_TARGET_MODE.AREA,
  )

  assert.deepEqual(selection.damageTargets.map((cell) => cell.id), [4])
})
