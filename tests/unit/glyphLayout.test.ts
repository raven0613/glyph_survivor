import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getCreatureDefinition,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import {
  getPrintableAsciiCharacter,
  getPrintableAsciiGlyphFrame,
} from '../../src/game/glyph/glyphFrame.ts'
import { defineGlyphBody } from '../../src/game/glyph/glyphLayout.ts'
import { GLYPH_MATERIAL } from '../../src/game/glyph/glyphStore.ts'

test('compiles the fixed BAT body into three stable gameplay slots', () => {
  const content = prepareGameContent()
  const body = getCreatureDefinition(content, 'enemy.bat').body

  assert.equal(body.id, 'enemy.bat.body')
  assert.equal(body.slots.length, 3)
  assert.deepEqual(
    body.slots.map((slot) => ({
      slotId: slot.slotId,
      character: slot.character,
      localX: slot.localX,
      localY: slot.localY,
      maxDurability: slot.maxDurability,
    })),
    [
      { slotId: 0, character: 'B', localX: -24, localY: 0, maxDurability: 1 },
      { slotId: 1, character: 'A', localX: 0, localY: 0, maxDurability: 1 },
      { slotId: 2, character: 'T', localX: 24, localY: 0, maxDurability: 1 },
    ],
  )
  assert.equal(body.broadPhaseRadius, 36)
  assert.ok(content.maximumEnemyBroadPhaseRadius > body.broadPhaseRadius)
})

test('copies and freezes body slots at the content boundary', () => {
  const sourceSlot = {
    slotId: 0,
    role: 'BODY' as const,
    character: 'B',
    topologyX: 0,
    topologyY: 0,
    localX: 0,
    localY: 0,
    maxDurability: 1,
    collisionRadius: 12,
    scale: 0.72,
    material: GLYPH_MATERIAL.BASIC,
  }
  const body = defineGlyphBody({
    id: 'test.fixed-body',
    expectedGlyphCount: 1,
    slots: [sourceSlot],
  })

  sourceSlot.character = 'X'
  sourceSlot.localX = 100

  assert.equal(body.slots[0].character, 'B')
  assert.equal(body.slots[0].localX, 0)
  assert.equal(Object.isFrozen(body), true)
  assert.equal(Object.isFrozen(body.slots), true)
  assert.equal(Object.isFrozen(body.slots[0]), true)
})

test('rejects ambiguous body slots before gameplay starts', () => {
  const duplicatedSlot = {
    slotId: 0,
    role: 'BODY' as const,
    character: 'B',
    topologyX: 0,
    topologyY: 0,
    localX: 0,
    localY: 0,
    maxDurability: 1,
    collisionRadius: 12,
    scale: 1,
    material: GLYPH_MATERIAL.BASIC,
  }

  assert.throws(
    () =>
      defineGlyphBody({
        id: 'test.invalid-body',
        expectedGlyphCount: 2,
        slots: [duplicatedSlot, { ...duplicatedSlot }],
      }),
    /duplicate slotId/,
  )
})

test('maps every supported glyph through the Printable ASCII frame contract', () => {
  assert.equal(getPrintableAsciiGlyphFrame(' '), 0)
  assert.equal(getPrintableAsciiCharacter(0), ' ')
  assert.equal(getPrintableAsciiCharacter(getPrintableAsciiGlyphFrame('~')), '~')
  assert.throws(() => getPrintableAsciiGlyphFrame('史'), /Printable ASCII/)
})
