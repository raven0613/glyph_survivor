import type { RenderGlyph } from './renderSnapshot.ts'

export function writeRenderGlyph(
  buffer: RenderGlyph[],
  index: number,
  id: number,
  glyphFrame: number,
  x: number,
  y: number,
  scale: number,
  alpha: number,
  tint: number,
  rotation = 0,
): void {
  const glyph = buffer[index] ?? ({} as RenderGlyph)
  glyph.id = id
  glyph.glyphFrame = glyphFrame
  glyph.x = x
  glyph.y = y
  glyph.rotation = rotation
  glyph.scale = scale
  glyph.alpha = alpha
  glyph.tint = tint
  buffer[index] = glyph
}
