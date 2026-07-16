import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DAMAGE_FRONTIER_TRAVERSAL,
  DAMAGE_TARGET_MODE,
  type DamageFrontierTraversal,
} from '../../src/game/glyph/localDamage.ts'
import { GLYPH_CELL_STATE } from '../../src/game/glyph/glyphStore.ts'
import {
  selectGlyphDamage,
  type DamageSelectionCell,
} from '../../src/game/systems/glyphDamageSelection.ts'

const FIXED_RIGHT = Object.freeze({
  kind: DAMAGE_FRONTIER_TRAVERSAL.FIXED_DIRECTION,
  directionX: 1,
  directionY: 0,
}) satisfies DamageFrontierTraversal

const FROM_SHAPE_ORIGIN = Object.freeze({
  kind: DAMAGE_FRONTIER_TRAVERSAL.FROM_SHAPE_ORIGIN,
}) satisfies DamageFrontierTraversal

function createCell(
  id: number,
  topologyX: number,
  state: DamageSelectionCell['state'],
  options: {
    readonly topologyY?: number
    readonly worldX?: number
    readonly worldY?: number
    readonly collisionRadius?: number
  } = {},
): DamageSelectionCell {
  const topologyY = options.topologyY ?? 0
  return {
    id,
    state,
    topologyX,
    topologyY,
    worldX: options.worldX ?? topologyX * 20,
    worldY: options.worldY ?? topologyY * 20,
    collisionRadius: options.collisionRadius ?? 8,
  }
}

function circleAtOrigin(radius = 2) {
  return { kind: 'CIRCLE', x: 0, y: 0, radius } as const
}

test('prioritizes a living impact cell over a husk source', () => {
  const husk = createCell(1, 0, GLYPH_CELL_STATE.HUSK)
  const living = createCell(2, 1, GLYPH_CELL_STATE.HEALTHY)

  const selection = selectGlyphDamage(
    [husk, living],
    { kind: 'CIRCLE', x: 10, y: 0, radius: 4 },
    DAMAGE_TARGET_MODE.SINGLE,
    FIXED_RIGHT,
  )

  assert.deepEqual(selection.impactCells.map((cell) => cell.id), [1, 2])
  assert.deepEqual(
    selection.immediateDamageTargets.map((cell) => cell.id),
    [2],
  )
  assert.deepEqual(selection.frontierTransfers, [])
})

test('prefers a forward living cell over a closer side frontier', () => {
  const cells = [
    createCell(1, 0, GLYPH_CELL_STATE.HUSK),
    createCell(2, 1, GLYPH_CELL_STATE.HUSK),
    createCell(3, 2, GLYPH_CELL_STATE.DAMAGED),
    createCell(4, 0, GLYPH_CELL_STATE.HEALTHY, { topologyY: 1 }),
  ]

  const selection = selectGlyphDamage(
    cells,
    circleAtOrigin(),
    DAMAGE_TARGET_MODE.SINGLE,
    FIXED_RIGHT,
  )

  assert.deepEqual(selection.immediateDamageTargets, [])
  assert.deepEqual(
    selection.frontierTransfers.map(({ targetCell }) => targetCell.id),
    [3],
  )
  assert.deepEqual(
    selection.frontierTransfers[0]?.pathCells.map((cell) => cell.id),
    [1, 2, 3],
  )
})

test('falls back to the nearest topology frontier after the forward ray is drilled through', () => {
  const cells = [
    createCell(1, 0, GLYPH_CELL_STATE.HUSK),
    createCell(2, 1, GLYPH_CELL_STATE.HUSK),
    createCell(3, 0, GLYPH_CELL_STATE.HEALTHY, { topologyY: 1 }),
  ]

  const selection = selectGlyphDamage(
    cells,
    circleAtOrigin(),
    DAMAGE_TARGET_MODE.SINGLE,
    FIXED_RIGHT,
  )

  assert.equal(selection.frontierTransfers[0]?.targetCell.id, 3)
  assert.deepEqual(
    selection.frontierTransfers[0]?.pathCells.map((cell) => cell.id),
    [1, 3],
  )
})

test('selects the first living Glyph Circle intersected by the forward ray', () => {
  const cells = [
    createCell(1, 0, GLYPH_CELL_STATE.HUSK),
    createCell(2, 1, GLYPH_CELL_STATE.HUSK),
    createCell(3, 2, GLYPH_CELL_STATE.HEALTHY),
    createCell(4, 3, GLYPH_CELL_STATE.HEALTHY),
  ]

  const selection = selectGlyphDamage(
    cells,
    circleAtOrigin(),
    DAMAGE_TARGET_MODE.SINGLE,
    FIXED_RIGHT,
  )

  assert.equal(selection.frontierTransfers[0]?.targetCell.id, 3)
})

test('uses forward progress before stable ID when equal-length topology paths exist', () => {
  const cells = [
    createCell(1, 0, GLYPH_CELL_STATE.HUSK),
    createCell(2, 0, GLYPH_CELL_STATE.HUSK, {
      topologyY: 1,
      worldX: 0,
      worldY: 20,
    }),
    createCell(3, 1, GLYPH_CELL_STATE.HUSK, {
      worldX: 20,
      worldY: 0,
    }),
    createCell(4, 1, GLYPH_CELL_STATE.HEALTHY, {
      topologyY: 1,
      worldX: 40,
      worldY: 0,
    }),
  ]

  const selection = selectGlyphDamage(
    cells,
    circleAtOrigin(),
    DAMAGE_TARGET_MODE.SINGLE,
    FIXED_RIGHT,
  )

  assert.deepEqual(
    selection.frontierTransfers[0]?.pathCells.map((cell) => cell.id),
    [1, 3, 4],
  )
})

test('fills an area quota with unique forward targets from stable husk sources', () => {
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
    FIXED_RIGHT,
  )

  assert.deepEqual(selection.impactCells.map((cell) => cell.id), [2, 1, 3])
  assert.deepEqual(
    selection.frontierTransfers.map(({ targetCell }) => targetCell.id),
    [4, 5, 6],
  )
})

test('continues to the next legal target when multiple husk sources share a candidate', () => {
  const cells = [
    createCell(1, 0, GLYPH_CELL_STATE.HUSK, {
      worldX: 0,
      worldY: -4,
      collisionRadius: 2,
    }),
    createCell(2, 0, GLYPH_CELL_STATE.HUSK, {
      topologyY: 1,
      worldX: 0,
      worldY: 4,
      collisionRadius: 2,
    }),
    createCell(3, 1, GLYPH_CELL_STATE.HEALTHY, {
      worldX: 20,
      worldY: 0,
      collisionRadius: 5,
    }),
    createCell(4, 1, GLYPH_CELL_STATE.HEALTHY, {
      topologyY: 1,
      worldX: 40,
      worldY: 4,
      collisionRadius: 2,
    }),
  ]

  const selection = selectGlyphDamage(
    cells,
    circleAtOrigin(3),
    DAMAGE_TARGET_MODE.AREA,
    FIXED_RIGHT,
  )

  assert.deepEqual(
    selection.frontierTransfers.map(({ targetCell }) => targetCell.id),
    [3, 4],
  )
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
    FIXED_RIGHT,
  )

  assert.deepEqual(
    selection.frontierTransfers.map(({ targetCell }) => targetCell.id),
    [4],
  )
})

test('uses one muzzle-to-impact ray for each Cone husk source', () => {
  const cells = [
    createCell(1, 0, GLYPH_CELL_STATE.HUSK, {
      worldX: 20,
      worldY: -6,
      collisionRadius: 2,
    }),
    createCell(2, 1, GLYPH_CELL_STATE.HUSK, {
      worldX: 200,
      worldY: -60,
      collisionRadius: 2,
    }),
    createCell(3, 2, GLYPH_CELL_STATE.HEALTHY, {
      worldX: 60,
      worldY: -18,
      collisionRadius: 2,
    }),
    createCell(4, 0, GLYPH_CELL_STATE.HUSK, {
      topologyY: 1,
      worldX: 20,
      worldY: 6,
      collisionRadius: 2,
    }),
    createCell(5, 1, GLYPH_CELL_STATE.HUSK, {
      topologyY: 1,
      worldX: 200,
      worldY: 60,
      collisionRadius: 2,
    }),
    createCell(6, 2, GLYPH_CELL_STATE.HEALTHY, {
      topologyY: 1,
      worldX: 60,
      worldY: 18,
      collisionRadius: 2,
    }),
  ]

  const selection = selectGlyphDamage(
    cells,
    {
      kind: 'CONE',
      x: 0,
      y: 0,
      directionX: 1,
      directionY: 0,
      range: 30,
      halfAngleRadians: Math.PI / 4,
    },
    DAMAGE_TARGET_MODE.AREA,
    FROM_SHAPE_ORIGIN,
  )

  assert.deepEqual(selection.impactCells.map((cell) => cell.id), [1, 4])
  assert.deepEqual(
    selection.frontierTransfers.map(({ targetCell }) => targetCell.id),
    [3, 6],
  )
})

test('uses the Cone axis when a husk source is exactly at the muzzle origin', () => {
  const cells = [
    createCell(1, 0, GLYPH_CELL_STATE.HUSK, {
      worldX: 0,
      worldY: 0,
      collisionRadius: 2,
    }),
    createCell(2, 0, GLYPH_CELL_STATE.HEALTHY, {
      topologyY: 1,
      worldX: 0,
      worldY: 20,
      collisionRadius: 2,
    }),
    createCell(3, 1, GLYPH_CELL_STATE.HEALTHY, {
      worldX: 20,
      worldY: 0,
      collisionRadius: 2,
    }),
  ]

  const selection = selectGlyphDamage(
    cells,
    {
      kind: 'CONE',
      x: 0,
      y: 0,
      directionX: 1,
      directionY: 0,
      range: 10,
      halfAngleRadians: Math.PI / 4,
    },
    DAMAGE_TARGET_MODE.AREA,
    FROM_SHAPE_ORIGIN,
  )

  assert.deepEqual(selection.impactCells.map((cell) => cell.id), [1])
  assert.equal(selection.frontierTransfers[0]?.targetCell.id, 3)
})

test('cone damage includes cell radii at its angular boundary and rejects cells behind it', () => {
  const inside = {
    ...createCell(1, 0, GLYPH_CELL_STATE.HEALTHY),
    worldX: 80,
    worldY: 80,
  }
  const boundary = {
    ...createCell(2, 0, GLYPH_CELL_STATE.HEALTHY),
    worldX: 80,
    worldY: 88,
  }
  const behind = {
    ...createCell(3, 0, GLYPH_CELL_STATE.HEALTHY),
    worldX: -20,
    worldY: 0,
  }

  const selection = selectGlyphDamage(
    [inside, boundary, behind],
    {
      kind: 'CONE',
      x: 0,
      y: 0,
      directionX: 1,
      directionY: 0,
      range: 160,
      halfAngleRadians: Math.PI / 4,
    },
    DAMAGE_TARGET_MODE.AREA,
    FROM_SHAPE_ORIGIN,
  )

  assert.deepEqual(selection.impactCells.map((cell) => cell.id), [1, 2])
  assert.deepEqual(
    selection.immediateDamageTargets.map((cell) => cell.id),
    [1, 2],
  )
})
