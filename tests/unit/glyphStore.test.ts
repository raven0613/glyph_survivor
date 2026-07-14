import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GLYPH_CELL_STATE,
  GLYPH_MATERIAL,
  createGlyphStore,
} from '../../src/game/glyph/glyphStore.ts'
import { getPrintableAsciiGlyphFrame } from '../../src/game/glyph/glyphFrame.ts'

test('derives owner durability only from its glyph cells', () => {
  const store = createGlyphStore()
  const outerGlyph = store.createGlyph({
    ownerId: 7,
    bodySlotId: 0,
    character: 'M',
    glyphFrame: getPrintableAsciiGlyphFrame('M'),
    baseCharacter: 'M',
    baseGlyphFrame: getPrintableAsciiGlyphFrame('M'),
    role: 'BODY',
    topologyX: 0,
    topologyY: 0,
    maxDurability: 1,
    collisionRadius: 12,
    scale: 1,
    material: GLYPH_MATERIAL.BASIC,
    baseTint: 0xc94b5f,
  })
  const innerGlyph = store.createGlyph({
    ownerId: 7,
    bodySlotId: 1,
    character: 'M',
    glyphFrame: getPrintableAsciiGlyphFrame('M'),
    baseCharacter: 'M',
    baseGlyphFrame: getPrintableAsciiGlyphFrame('M'),
    role: 'BODY',
    topologyX: 1,
    topologyY: 0,
    maxDurability: 2,
    collisionRadius: 12,
    scale: 1,
    material: GLYPH_MATERIAL.BASIC,
    baseTint: 0xc94b5f,
  })

  assert.deepEqual(store.getOwnerDurability(7), {
    currentDurability: 3,
    maxDurability: 3,
    livingGlyphCount: 2,
    glyphCount: 2,
  })

  store.applyDamage(innerGlyph.id, 1)
  store.applyDamage(outerGlyph.id, 1)

  assert.equal(store.getById(innerGlyph.id)?.state, GLYPH_CELL_STATE.DAMAGED)
  assert.equal(store.getById(outerGlyph.id)?.state, GLYPH_CELL_STATE.HUSK)
  assert.ok(outerGlyph.alpha > 0 && outerGlyph.alpha < innerGlyph.alpha)
  assert.deepEqual(store.getOwnerDurability(7), {
    currentDurability: 1,
    maxDurability: 3,
    livingGlyphCount: 1,
    glyphCount: 2,
  })
  assert.equal(store.isOwnerDepleted(7), false)
})

test('clamps glyph damage at zero and depletes an owner only once all glyphs are husks', () => {
  const store = createGlyphStore()
  const glyph = store.createGlyph({
    ownerId: 11,
    bodySlotId: 0,
    character: 'M',
    glyphFrame: getPrintableAsciiGlyphFrame('M'),
    baseCharacter: 'M',
    baseGlyphFrame: getPrintableAsciiGlyphFrame('M'),
    role: 'BODY',
    topologyX: 0,
    topologyY: 0,
    maxDurability: 2,
    collisionRadius: 12,
    scale: 1,
    material: GLYPH_MATERIAL.BASIC,
    baseTint: 0xc94b5f,
  })

  const result = store.applyDamage(glyph.id, 5)
  const repeatedResult = store.applyDamage(glyph.id, 1)

  assert.equal(result, 2)
  assert.equal(repeatedResult, 0)
  assert.equal(store.getById(glyph.id)?.currentDurability, 0)
  assert.equal(store.getById(glyph.id)?.state, GLYPH_CELL_STATE.HUSK)
  assert.equal(store.isOwnerDepleted(11), true)
})

test('rejects glyph definitions that cannot produce valid durability', () => {
  const store = createGlyphStore()

  assert.throws(
    () =>
      store.createGlyph({
        ownerId: 1,
        bodySlotId: 0,
        character: 'M',
        glyphFrame: getPrintableAsciiGlyphFrame('M'),
        baseCharacter: 'M',
        baseGlyphFrame: getPrintableAsciiGlyphFrame('M'),
        role: 'BODY',
        topologyX: 0,
        topologyY: 0,
        maxDurability: 0,
        collisionRadius: 12,
        scale: 1,
        material: GLYPH_MATERIAL.BASIC,
        baseTint: 0xc94b5f,
      }),
    /positive safe integer/,
  )
})

test('preserves fractional durability and normalizes accumulated damage to zero', () => {
  const store = createGlyphStore()
  const glyph = store.createGlyph({
    ownerId: 12,
    bodySlotId: 0,
    character: 'M',
    glyphFrame: getPrintableAsciiGlyphFrame('M'),
    baseCharacter: 'M',
    baseGlyphFrame: getPrintableAsciiGlyphFrame('M'),
    role: 'BODY',
    topologyX: 0,
    topologyY: 0,
    maxDurability: 1,
    collisionRadius: 12,
    scale: 1,
    material: GLYPH_MATERIAL.BASIC,
    baseTint: 0xc94b5f,
  })

  store.applyDamage(glyph.id, 0.125)
  assert.equal(glyph.currentDurability, 0.875)
  assert.equal(glyph.state, GLYPH_CELL_STATE.DAMAGED)

  for (let hit = 1; hit < 8; hit += 1) {
    store.applyDamage(glyph.id, 0.125)
  }

  assert.equal(glyph.currentDurability, 0)
  assert.equal(store.getOwnerDurability(12)?.currentDurability, 0)
  assert.equal(glyph.state, GLYPH_CELL_STATE.HUSK)
})
