import {
  GLYPH_FONT_BANK,
  GLYPH_FONT_BANK_ORDER,
  getGlyphFontBankFrameOffset,
  type GlyphFontBankId,
} from '../../glyph/glyphFontBank.ts'
import {
  PRINTABLE_ASCII_GLYPH_COUNT,
  getPrintableAsciiGlyphFrame,
} from '../../glyph/glyphFrame.ts'

export interface GlyphFontBankAuthoring {
  readonly id: GlyphFontBankId
  readonly assetId: string | null
  readonly family: string
  readonly weight: string
  readonly rasterSizePx: number
  readonly baselineOffsetPx: number
  readonly atlasPaddingPx: number
  readonly requiredCharacters: string
}

export interface PreparedGlyphFontBank extends GlyphFontBankAuthoring {
  readonly frameOffset: number
  readonly frameCount: number
}

export interface PreparedGlyphFontBanks {
  readonly ordered: readonly Readonly<PreparedGlyphFontBank>[]
  readonly byId: Readonly<Record<GlyphFontBankId, Readonly<PreparedGlyphFontBank>>>
  readonly totalFrameCount: number
}

const PROTOTYPE_GLYPH_FONT_BANKS = Object.freeze([
  Object.freeze({
    id: GLYPH_FONT_BANK.BASE,
    assetId: null,
    family: 'SFMono-Regular, Consolas, monospace',
    weight: '700',
    rasterSizePx: 34,
    baselineOffsetPx: 1,
    atlasPaddingPx: 1,
    requiredCharacters: ' @o*+.#~',
  }),
  Object.freeze({
    id: GLYPH_FONT_BANK.RHOMBUS_BODY,
    assetId: 'font.rhombus-body.black-ops-one',
    family: 'Glyph Survivor RHOMBUS Black Ops One',
    weight: '400',
    rasterSizePx: 32,
    baselineOffsetPx: 1,
    atlasPaddingPx: 2,
    requiredCharacters: 'RHOMBUS',
  }),
  Object.freeze({
    id: GLYPH_FONT_BANK.HOSTILE_ATTACK,
    assetId: 'font.hostile-attack.share-tech-mono',
    family: 'Glyph Survivor Hostile Share Tech Mono',
    weight: '400',
    rasterSizePx: 36,
    baselineOffsetPx: 1,
    atlasPaddingPx: 2,
    requiredCharacters: '<>',
  }),
] as const satisfies readonly GlyphFontBankAuthoring[])

function requireNonEmpty(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new TypeError(`${name} must not be empty.`)
  }
}

function requirePositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and greater than zero.`)
  }
}

export function prepareGlyphFontBanks(
  authoring: readonly GlyphFontBankAuthoring[],
): PreparedGlyphFontBanks {
  if (authoring.length !== GLYPH_FONT_BANK_ORDER.length) {
    throw new Error('Glyph font authoring must define every stable bank exactly once.')
  }

  const byId = {} as Record<GlyphFontBankId, Readonly<PreparedGlyphFontBank>>
  const assetIds = new Set<string>()
  const bundledFamilies = new Set<string>()
  const ordered = GLYPH_FONT_BANK_ORDER.map((expectedId, index) => {
    const input = authoring[index]
    if (input?.id !== expectedId) {
      throw new Error(`Glyph font bank ${expectedId} must preserve stable order.`)
    }
    requireNonEmpty(input.family, `${expectedId} family`)
    requireNonEmpty(input.weight, `${expectedId} weight`)
    requirePositiveFinite(input.rasterSizePx, `${expectedId} rasterSizePx`)
    if (!Number.isFinite(input.baselineOffsetPx)) {
      throw new RangeError(`${expectedId} baselineOffsetPx must be finite.`)
    }
    if (!Number.isFinite(input.atlasPaddingPx) || input.atlasPaddingPx < 0) {
      throw new RangeError(
        `${expectedId} atlasPaddingPx must be finite and non-negative.`,
      )
    }
    const requiredCharacters = [...new Set(input.requiredCharacters)]
    if (requiredCharacters.length === 0) {
      throw new Error(`${expectedId} must require at least one Glyph frame.`)
    }
    requiredCharacters.forEach(getPrintableAsciiGlyphFrame)

    if (expectedId === GLYPH_FONT_BANK.BASE) {
      if (input.assetId !== null) {
        throw new Error('The base system font bank must not declare an asset.')
      }
    } else {
      if (input.assetId === null) {
        throw new Error(`${expectedId} must declare a bundled font asset.`)
      }
      requireNonEmpty(input.assetId, `${expectedId} assetId`)
      if (assetIds.has(input.assetId) || bundledFamilies.has(input.family)) {
        throw new Error('Bundled Glyph font assets and families must be distinct.')
      }
      assetIds.add(input.assetId)
      bundledFamilies.add(input.family)
    }

    const bank = Object.freeze({
      ...input,
      requiredCharacters: requiredCharacters.join(''),
      frameOffset: getGlyphFontBankFrameOffset(expectedId),
      frameCount: PRINTABLE_ASCII_GLYPH_COUNT,
    })
    byId[expectedId] = bank
    return bank
  })

  return Object.freeze({
    ordered: Object.freeze(ordered),
    byId: Object.freeze(byId),
    totalFrameCount: PRINTABLE_ASCII_GLYPH_COUNT * ordered.length,
  })
}

export function preparePrototypeGlyphFontBanks(): PreparedGlyphFontBanks {
  return prepareGlyphFontBanks(PROTOTYPE_GLYPH_FONT_BANKS)
}
