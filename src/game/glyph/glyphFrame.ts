export const PRINTABLE_ASCII_FIRST_CODE = 32
export const PRINTABLE_ASCII_LAST_CODE = 126
export const PRINTABLE_ASCII_GLYPH_COUNT =
  PRINTABLE_ASCII_LAST_CODE - PRINTABLE_ASCII_FIRST_CODE + 1

export function getPrintableAsciiGlyphFrame(character: string): number {
  if (character.length !== 1) {
    throw new TypeError('Glyph character must contain exactly one character.')
  }

  const characterCode = character.charCodeAt(0)
  if (
    characterCode < PRINTABLE_ASCII_FIRST_CODE ||
    characterCode > PRINTABLE_ASCII_LAST_CODE
  ) {
    throw new RangeError('Glyph character must be Printable ASCII.')
  }

  return characterCode - PRINTABLE_ASCII_FIRST_CODE
}

export function getPrintableAsciiCharacter(glyphFrame: number): string {
  if (
    !Number.isSafeInteger(glyphFrame) ||
    glyphFrame < 0 ||
    glyphFrame >= PRINTABLE_ASCII_GLYPH_COUNT
  ) {
    throw new RangeError('Glyph frame is outside the Printable ASCII atlas.')
  }

  return String.fromCharCode(PRINTABLE_ASCII_FIRST_CODE + glyphFrame)
}
