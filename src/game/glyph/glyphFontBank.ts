import {
  PRINTABLE_ASCII_GLYPH_COUNT,
  getPrintableAsciiGlyphFrame,
} from './glyphFrame.ts'

export const GLYPH_FONT_BANK = Object.freeze({
  BASE: 'BASE',
  RHOMBUS_BODY: 'RHOMBUS_BODY',
  HOSTILE_ATTACK: 'HOSTILE_ATTACK',
} as const)

export type GlyphFontBankId =
  (typeof GLYPH_FONT_BANK)[keyof typeof GLYPH_FONT_BANK]

export const GLYPH_FONT_BANK_ORDER = Object.freeze([
  GLYPH_FONT_BANK.BASE,
  GLYPH_FONT_BANK.RHOMBUS_BODY,
  GLYPH_FONT_BANK.HOSTILE_ATTACK,
] as const)

export function getGlyphFontBankFrameOffset(bankId: GlyphFontBankId): number {
  const bankIndex = GLYPH_FONT_BANK_ORDER.indexOf(bankId)
  if (bankIndex < 0) {
    throw new Error(`Unknown Glyph font bank ${bankId}.`)
  }
  return bankIndex * PRINTABLE_ASCII_GLYPH_COUNT
}

export function getGlyphAtlasFrame(
  bankId: GlyphFontBankId,
  character: string,
): number {
  return (
    getGlyphFontBankFrameOffset(bankId) +
    getPrintableAsciiGlyphFrame(character)
  )
}
