import type { GlyphCell } from './glyphCell.ts'
import { requireFiniteNumber } from './glyphStoreValidation.ts'

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] }

export function updateGlyphLocalPosition(
  glyph: GlyphCell | undefined,
  localX: number,
  localY: number,
): void {
  requireFiniteNumber(localX, 'localX')
  requireFiniteNumber(localY, 'localY')
  if (glyph) {
    const cell = glyph as Mutable<GlyphCell>
    cell.localX = localX
    cell.localY = localY
  }
}

export function updateGlyphBodyMotion(
  glyph: GlyphCell | undefined,
  offsetX: number,
  offsetY: number,
  rotation: number,
): void {
  requireFiniteNumber(offsetX, 'bodyMotionOffsetX')
  requireFiniteNumber(offsetY, 'bodyMotionOffsetY')
  requireFiniteNumber(rotation, 'rotation')
  if (glyph) {
    const cell = glyph as Mutable<GlyphCell>
    cell.bodyMotionOffsetX = offsetX
    cell.bodyMotionOffsetY = offsetY
    cell.rotation = rotation
  }
}

export function updateGlyphCompiledLayout(
  glyph: GlyphCell | undefined,
  topologyX: number,
  topologyY: number,
  localX: number,
  localY: number,
  offsetX: number,
  offsetY: number,
): void {
  const values = { topologyX, topologyY, localX, localY, offsetX, offsetY }
  for (const [name, value] of Object.entries(values)) {
    requireFiniteNumber(value, name)
  }
  if (glyph) {
    Object.assign(glyph as Mutable<GlyphCell>, {
      topologyX,
      topologyY,
      layoutBaseX: localX,
      layoutBaseY: localY,
      localX,
      localY,
      offsetX,
      offsetY,
    })
  }
}
