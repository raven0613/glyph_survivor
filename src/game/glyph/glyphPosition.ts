import type { GlyphCell } from './glyphStore.ts'

export function getGlyphWorldX(ownerX: number, glyph: GlyphCell): number {
  return ownerX + glyph.localX + glyph.bodyMotionOffsetX + glyph.offsetX
}

export function getGlyphWorldY(ownerY: number, glyph: GlyphCell): number {
  return ownerY + glyph.localY + glyph.bodyMotionOffsetY + glyph.offsetY
}
