import assert from 'node:assert/strict'
import test from 'node:test'
import { GLYPH_CELL_STATE } from '../../src/game/glyph/glyphStore.ts'
import { findLivingConnectedComponents } from '../../src/game/glyph/livingConnectedComponents.ts'
import {
  createGlyphTopologyIndex,
  findTopologyDistances,
} from '../../src/game/systems/glyphTopologyPath.ts'

test('canonical topology never joins different authored components', () => {
  const cells = [
    {
      id: 1,
      topologyComponentId: 'MAIN',
      topologyX: 0,
      topologyY: 0,
      worldX: 0,
      worldY: 0,
      state: GLYPH_CELL_STATE.HEALTHY,
    },
    {
      id: 2,
      topologyComponentId: 'SECONDARY',
      topologyX: 0,
      topologyY: 0,
      worldX: 0,
      worldY: 0,
      state: GLYPH_CELL_STATE.HEALTHY,
    },
    {
      id: 3,
      topologyComponentId: 'MAIN',
      topologyX: 1,
      topologyY: 0,
      worldX: 20,
      worldY: 0,
      state: GLYPH_CELL_STATE.HEALTHY,
    },
  ] as const

  const topology = createGlyphTopologyIndex(cells)
  assert.deepEqual(
    topology.neighborsById.get(1)?.map((cell) => cell.id),
    [3],
  )
  assert.equal(findTopologyDistances(topology, 1).has(2), false)

  const livingComponents = findLivingConnectedComponents(cells)
  assert.deepEqual(
    livingComponents.map((component) => component.map((cell) => cell.id)),
    [[1, 3], [2]],
  )
})
