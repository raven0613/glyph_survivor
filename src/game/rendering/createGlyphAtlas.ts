import { Color, Rectangle, Texture } from 'pixi.js'
import {
  PRINTABLE_ASCII_GLYPH_COUNT,
  getPrintableAsciiCharacter,
  getPrintableAsciiGlyphFrame,
} from '../glyph/glyphFrame.ts'
import type { CombatVisualTheme } from '../content/visuals/combatVisualTheme.ts'
import {
  GLYPH_ATLAS_CELL_SIZE,
  createCrackedGlyphFragmentLayout,
} from './crackedGlyphFragments.ts'
import type { CrackedGlyphFragmentFrame } from './crackedGlyphFragmentFrame.ts'

export type { CrackedGlyphFragmentFrame } from './crackedGlyphFragmentFrame.ts'

export type FixedGlyphFrameName =
  | 'player'
  | 'projectile'
  | 'experience'
  | 'background'

export interface GlyphAtlas {
  readonly frames: Readonly<Record<FixedGlyphFrameName, Texture>>
  readonly printableFrames: readonly Texture[]
  readonly crackedFragmentFrames: readonly (readonly Readonly<CrackedGlyphFragmentFrame>[] )[]
  destroy(): void
}

const CELL_SIZE = GLYPH_ATLAS_CELL_SIZE
const ATLAS_COLUMNS = 16
const ATLAS_ROWS = Math.ceil(PRINTABLE_ASCII_GLYPH_COUNT / ATLAS_COLUMNS)

function getFramePosition(glyphFrame: number): {
  readonly x: number
  readonly y: number
} {
  return {
    x: (glyphFrame % ATLAS_COLUMNS) * CELL_SIZE,
    y: Math.floor(glyphFrame / ATLAS_COLUMNS) * CELL_SIZE,
  }
}

export function createGlyphAtlas(visualTheme: CombatVisualTheme): GlyphAtlas {
  const canvas = document.createElement('canvas')
  canvas.width = CELL_SIZE * ATLAS_COLUMNS
  canvas.height = CELL_SIZE * ATLAS_ROWS
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Unable to create the glyph atlas canvas context.')
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = "700 34px 'SFMono-Regular', Consolas, monospace"
  context.lineWidth = visualTheme.glyphAtlas.outlineWidth
  context.strokeStyle = new Color(
    visualTheme.glyphAtlas.outlineTint,
  ).toHex()
  context.fillStyle = new Color(
    visualTheme.glyphAtlas.sourceFillTint,
  ).toHex()

  for (let glyphFrame = 0; glyphFrame < PRINTABLE_ASCII_GLYPH_COUNT; glyphFrame += 1) {
    const position = getFramePosition(glyphFrame)
    const centerX = position.x + CELL_SIZE / 2
    const centerY = position.y + CELL_SIZE / 2 + 1
    const character = getPrintableAsciiCharacter(glyphFrame)
    context.strokeText(character, centerX, centerY)
    context.fillText(character, centerX, centerY)
  }

  const atlasTexture = Texture.from(canvas, true)
  const printableFrames = Array.from(
    { length: PRINTABLE_ASCII_GLYPH_COUNT },
    (_, glyphFrame) => {
      const position = getFramePosition(glyphFrame)
      return new Texture({
        source: atlasTexture.source,
        frame: new Rectangle(position.x, position.y, CELL_SIZE, CELL_SIZE),
        defaultAnchor: { x: 0.5, y: 0.5 },
        label: `glyph-ascii-${glyphFrame}`,
      })
    },
  )
  const frames = Object.freeze({
    player: printableFrames[getPrintableAsciiGlyphFrame('@')],
    projectile: printableFrames[getPrintableAsciiGlyphFrame('o')],
    experience: printableFrames[getPrintableAsciiGlyphFrame('*')],
    background: printableFrames[getPrintableAsciiGlyphFrame('+')],
  })
  const crackedFragmentFrames = Object.freeze(
    Array.from(
      { length: PRINTABLE_ASCII_GLYPH_COUNT },
      (_, glyphFrame) => {
        const position = getFramePosition(glyphFrame)
        return Object.freeze(
          createCrackedGlyphFragmentLayout(glyphFrame).map((fragment, index) =>
            Object.freeze({
              ...fragment,
              texture: new Texture({
                source: atlasTexture.source,
                frame: new Rectangle(
                  position.x + fragment.x,
                  position.y + fragment.y,
                  fragment.width,
                  fragment.height,
                ),
                defaultAnchor: { x: 0.5, y: 0.5 },
                label: `glyph-cracked-${glyphFrame}-${index}`,
              }),
            }),
          ),
        )
      },
    ),
  )

  return Object.freeze({
    frames,
    printableFrames: Object.freeze(printableFrames),
    crackedFragmentFrames,
    destroy() {
      crackedFragmentFrames.forEach((fragments) =>
        fragments.forEach(({ texture }) => texture.destroy(false)),
      )
      printableFrames.forEach((texture) => texture.destroy(false))
      atlasTexture.destroy(true)
    },
  })
}
