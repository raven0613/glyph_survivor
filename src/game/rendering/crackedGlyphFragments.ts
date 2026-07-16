import { getPrintableAsciiCharacter } from '../glyph/glyphFrame.ts'

export const GLYPH_ATLAS_CELL_SIZE = 64

export interface CrackedGlyphFragmentLayout {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly centerOffsetX: number
  readonly centerOffsetY: number
}

const THIN_GLYPH_PATTERN = /^[!|iIl1.,:'`;]$/

function createHorizontalFragments(
  heights: readonly number[],
): readonly Readonly<CrackedGlyphFragmentLayout>[] {
  let y = 0
  return Object.freeze(
    heights.map((height) => {
      const fragment = Object.freeze({
        x: 0,
        y,
        width: GLYPH_ATLAS_CELL_SIZE,
        height,
        centerOffsetX: 0,
        centerOffsetY:
          y + height / 2 - GLYPH_ATLAS_CELL_SIZE / 2,
      })
      y += height
      return fragment
    }),
  )
}

/** Compiles reusable fragment rectangles without inspecting pixels at hit time. */
export function createCrackedGlyphFragmentLayout(
  glyphFrame: number,
): readonly Readonly<CrackedGlyphFragmentLayout>[] {
  const character = getPrintableAsciiCharacter(glyphFrame)
  return THIN_GLYPH_PATTERN.test(character)
    ? createHorizontalFragments([32, 32])
    : createHorizontalFragments([21, 22, 21])
}
