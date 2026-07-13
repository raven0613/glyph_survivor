import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import {
  getCreatureDefinition,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../../src/game/glyph/glyphPosition.ts'
import { GLYPH_CELL_STATE } from '../../src/game/glyph/glyphStore.ts'
import { createWorldState, spawnEnemy } from '../../src/game/runtime/worldState.ts'
import { runCreatureBodyMotionBehavior } from '../../src/game/systems/creatureBodyMotionStrategies.ts'
import { runMovementSystem } from '../../src/game/systems/movementSystem.ts'

function spawnActiveOrdinaryEnemy(definitionId: string) {
  const content = prepareGameContent()
  const world = createWorldState(`motion-${definitionId}`, 800, 600, content)
  const definition = getCreatureDefinition(content, definitionId)
  const enemy = spawnEnemy(world, 1_800, 2_000, 0, definition)
  enemy.phase = 'ACTIVE'
  enemy.bodyMotionPhaseOffset = 0
  return { world, definition, enemy }
}

test('moves BAT wing cells on a crisp offset beat while keeping B restrained', () => {
  const { world, enemy } = spawnActiveOrdinaryEnemy('enemy.bat')
  const [bGlyph, aGlyph, tGlyph] = world.glyphStore.getOwnerGlyphs(enemy.id)

  runMovementSystem(world, 45)

  assert.ok(Math.abs(aGlyph.bodyMotionOffsetY) > 0)
  assert.ok(Math.abs(tGlyph.bodyMotionOffsetY) > 0)
  assert.notEqual(aGlyph.bodyMotionOffsetY, tGlyph.bodyMotionOffsetY)
  assert.ok(
    Math.abs(bGlyph.bodyMotionOffsetY) < Math.abs(aGlyph.bodyMotionOffsetY),
  )
  assert.equal(aGlyph.bodyMotionOffsetX, 0)
  assert.equal(tGlyph.bodyMotionOffsetX, 0)
})

test('keeps an active BAT husk on its authored wing motion track', () => {
  const { world, enemy } = spawnActiveOrdinaryEnemy('enemy.bat')
  const [, aGlyph] = world.glyphStore.getOwnerGlyphs(enemy.id)
  world.glyphStore.applyDamage(aGlyph.id, aGlyph.currentDurability)

  runMovementSystem(world, 45)

  assert.equal(aGlyph.state, GLYPH_CELL_STATE.HUSK)
  assert.equal(Number.isFinite(aGlyph.bodyMotionOffsetY), true)
  assert.notEqual(aGlyph.bodyMotionOffsetY, 0)
})

test('rattles BO cells independently and returns them to neutral when stopped', () => {
  const { world, enemy } = spawnActiveOrdinaryEnemy('enemy.bone')
  const [bGlyph, oGlyph] = world.glyphStore.getOwnerGlyphs(enemy.id)

  runMovementSystem(world, 55)

  assert.notDeepEqual(
    [bGlyph.bodyMotionOffsetX, bGlyph.bodyMotionOffsetY, bGlyph.rotation],
    [oGlyph.bodyMotionOffsetX, oGlyph.bodyMotionOffsetY, oGlyph.rotation],
  )
  assert.ok(Math.abs(bGlyph.rotation) + Math.abs(oGlyph.rotation) > 0)

  world.player.x = enemy.x
  world.player.y = enemy.y
  runMovementSystem(world, 1_000 / 60)

  assert.deepEqual(
    [
      bGlyph.bodyMotionOffsetX,
      bGlyph.bodyMotionOffsetY,
      bGlyph.rotation,
      oGlyph.bodyMotionOffsetX,
      oGlyph.bodyMotionOffsetY,
      oGlyph.rotation,
    ],
    [0, 0, 0, 0, 0, 0],
  )
})

test('keeps the Z bottom pivot stable while its authoritative center rocks', () => {
  const { world, enemy } = spawnActiveOrdinaryEnemy('enemy.zombie')
  const [glyph] = world.glyphStore.getOwnerGlyphs(enemy.id)

  runMovementSystem(world, 120)

  assert.notEqual(glyph.rotation, 0)
  assert.notEqual(glyph.bodyMotionOffsetX, 0)
  const pivotLength = glyph.bodyMotionOffsetX / Math.sin(glyph.rotation)
  assert.ok(pivotLength > 0)
  assert.ok(
    Math.abs(
      glyph.bodyMotionOffsetY -
        pivotLength * (1 - Math.cos(glyph.rotation)),
    ) < 0.000_001,
  )
  assert.equal(
    getGlyphWorldX(enemy.x, glyph),
    enemy.x + glyph.localX + glyph.bodyMotionOffsetX + glyph.offsetX,
  )
  assert.equal(
    getGlyphWorldY(enemy.y, glyph),
    enemy.y + glyph.localY + glyph.bodyMotionOffsetY + glyph.offsetY,
  )
})

test('publishes authoritative glyph rotation through the render snapshot', () => {
  const { world, enemy } = spawnActiveOrdinaryEnemy('enemy.zombie')
  const [glyph] = world.glyphStore.getOwnerGlyphs(enemy.id)
  runMovementSystem(world, 120)
  const snapshot = createRenderSnapshot()

  writeRenderSnapshot(world, snapshot, 1)

  const renderGlyph = snapshot.enemies.find((candidate) => candidate.id === glyph.id)
  assert.ok(renderGlyph)
  assert.equal(renderGlyph.rotation, glyph.rotation)
})

test('recomputes body motion from phase without accumulating drift', () => {
  const { world, definition, enemy } = spawnActiveOrdinaryEnemy('enemy.bat')
  enemy.behaviorElapsedMs = 90
  runCreatureBodyMotionBehavior(world, enemy, definition)
  const firstPose = world.glyphStore
    .getOwnerGlyphs(enemy.id)
    .map((glyph) => [
      glyph.bodyMotionOffsetX,
      glyph.bodyMotionOffsetY,
      glyph.rotation,
    ])

  runCreatureBodyMotionBehavior(world, enemy, definition)

  assert.deepEqual(
    world.glyphStore
      .getOwnerGlyphs(enemy.id)
      .map((glyph) => [
        glyph.bodyMotionOffsetX,
        glyph.bodyMotionOffsetY,
        glyph.rotation,
      ]),
    firstPose,
  )
})
