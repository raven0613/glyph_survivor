import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GLYPH_FONT_BANK,
  getGlyphAtlasFrame,
} from '../../src/game/glyph/glyphFontBank.ts'
import { PRINTABLE_ASCII_GLYPH_COUNT } from '../../src/game/glyph/glyphFrame.ts'
import { preparePrototypeGlyphFontBanks } from '../../src/game/content/visuals/glyphFontBanks.ts'
import { loadRequiredGlyphFonts } from '../../src/game/rendering/loadRequiredGlyphFonts.ts'

test('prepared font banks reserve stable non-overlapping Printable ASCII frames', () => {
  const banks = preparePrototypeGlyphFontBanks()

  assert.deepEqual(
    banks.ordered.map((bank) => bank.id),
    [
      GLYPH_FONT_BANK.BASE,
      GLYPH_FONT_BANK.RHOMBUS_BODY,
      GLYPH_FONT_BANK.HOSTILE_ATTACK,
    ],
  )
  assert.equal(
    banks.totalFrameCount,
    PRINTABLE_ASCII_GLYPH_COUNT * banks.ordered.length,
  )
  assert.equal(getGlyphAtlasFrame(GLYPH_FONT_BANK.BASE, 'R'), 'R'.charCodeAt(0) - 32)
  assert.equal(
    getGlyphAtlasFrame(GLYPH_FONT_BANK.RHOMBUS_BODY, 'R'),
    PRINTABLE_ASCII_GLYPH_COUNT + 'R'.charCodeAt(0) - 32,
  )
  assert.equal(
    getGlyphAtlasFrame(GLYPH_FONT_BANK.HOSTILE_ATTACK, '<'),
    PRINTABLE_ASCII_GLYPH_COUNT * 2 + '<'.charCodeAt(0) - 32,
  )
  assert.ok(
    banks.byId[GLYPH_FONT_BANK.HOSTILE_ATTACK].requiredCharacters.includes('<'),
  )
  assert.ok(
    banks.byId[GLYPH_FONT_BANK.HOSTILE_ATTACK].requiredCharacters.includes('>'),
  )
})

test('LOADING accepts the CSS-serialized family returned by the browser', async () => {
  const banks = preparePrototypeGlyphFontBanks()
  const loadedAssetIds: string[] = []

  await loadRequiredGlyphFonts({
    fontBanks: banks,
    assetUrlById: Object.freeze({
      'font.rhombus-body.black-ops-one': '/rhombus.woff2',
      'font.hostile-attack.share-tech-mono': '/hostile.woff2',
    }),
    loadFont: async (request) => {
      loadedAssetIds.push(request.assetId)
      return Object.freeze([
        { family: `"${request.family}"`, status: 'loaded' },
      ])
    },
  })

  assert.deepEqual(loadedAssetIds, [
    'font.rhombus-body.black-ops-one',
    'font.hostile-attack.share-tech-mono',
  ])
})

test('LOADING rejects missing assets and fallback family results', async () => {
  const banks = preparePrototypeGlyphFontBanks()

  await assert.rejects(
    loadRequiredGlyphFonts({
      fontBanks: banks,
      assetUrlById: Object.freeze({}),
      loadFont: async () => Object.freeze([]),
    }),
    /missing font asset/i,
  )

  await assert.rejects(
    loadRequiredGlyphFonts({
      fontBanks: banks,
      assetUrlById: Object.freeze({
        'font.rhombus-body.black-ops-one': '/rhombus.woff2',
        'font.hostile-attack.share-tech-mono': '/hostile.woff2',
      }),
      loadFont: async () => Object.freeze([{ family: 'fallback', status: 'loaded' }]),
    }),
    /font family/i,
  )

  await assert.rejects(
    loadRequiredGlyphFonts({
      fontBanks: banks,
      assetUrlById: Object.freeze({
        'font.rhombus-body.black-ops-one': '/rhombus.woff2',
        'font.hostile-attack.share-tech-mono': '/hostile.woff2',
      }),
      loadFont: async (request) =>
        Object.freeze([{ family: request.family, status: 'error' }]),
    }),
    /status error/i,
  )
})
