import { Color, Rectangle, Texture } from 'pixi.js'
import {
  PRINTABLE_ASCII_GLYPH_COUNT,
  getPrintableAsciiCharacter,
  getPrintableAsciiGlyphFrame,
} from '../glyph/glyphFrame.ts'
import type { CombatVisualTheme } from '../content/visuals/combatVisualTheme.ts'
import type {
  PreparedGlyphFontBank,
  PreparedGlyphFontBanks,
} from '../content/visuals/glyphFontBanks.ts'
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

function getFramePosition(glyphFrame: number): {
  readonly x: number
  readonly y: number
} {
  return {
    x: (glyphFrame % ATLAS_COLUMNS) * CELL_SIZE,
    y: Math.floor(glyphFrame / ATLAS_COLUMNS) * CELL_SIZE,
  }
}

export function createGlyphAtlas(
  visualTheme: CombatVisualTheme,
  fontBanks: PreparedGlyphFontBanks,
): GlyphAtlas {
  const canvas = document.createElement('canvas')
  canvas.width = CELL_SIZE * ATLAS_COLUMNS
  canvas.height =
    CELL_SIZE * Math.ceil(fontBanks.totalFrameCount / ATLAS_COLUMNS)
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Unable to create the glyph atlas canvas context.')
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.lineWidth = visualTheme.glyphAtlas.outlineWidth
  context.strokeStyle = new Color(
    visualTheme.glyphAtlas.outlineTint,
  ).toHex()
  context.fillStyle = new Color(
    visualTheme.glyphAtlas.sourceFillTint,
  ).toHex()

  for (const bank of fontBanks.ordered) {
    context.font = `${bank.weight} ${bank.rasterSizePx}px ${
      bank.assetId === null ? bank.family : `"${bank.family}"`
    }`
    for (
      let localFrame = 0;
      localFrame < PRINTABLE_ASCII_GLYPH_COUNT;
      localFrame += 1
    ) {
      const glyphFrame = bank.frameOffset + localFrame
      const position = getFramePosition(glyphFrame)
      const centerX = position.x + CELL_SIZE / 2
      const centerY =
        position.y + CELL_SIZE / 2 + bank.baselineOffsetPx
      const character = getPrintableAsciiCharacter(localFrame)
      if (bank.requiredCharacters.includes(character)) {
        validateGlyphFitsAtlasCell(
          context,
          bank,
          character,
          visualTheme.glyphAtlas.outlineWidth,
        )
      }
      context.strokeText(character, centerX, centerY)
      context.fillText(character, centerX, centerY)
    }
  }

  const atlasTexture = Texture.from(canvas, true)
  const printableFrames = Array.from(
    { length: fontBanks.totalFrameCount },
    (_, glyphFrame) => {
      const position = getFramePosition(glyphFrame)
      return new Texture({
        source: atlasTexture.source,
        frame: new Rectangle(position.x, position.y, CELL_SIZE, CELL_SIZE),
        defaultAnchor: { x: 0.5, y: 0.5 },
        label: `glyph-atlas-${glyphFrame}`,
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

function validateGlyphFitsAtlasCell(
  context: CanvasRenderingContext2D,
  bank: Readonly<PreparedGlyphFontBank>,
  character: string,
  outlineWidth: number,
): void {
  const metrics = context.measureText(character)
  const halfOutline = outlineWidth / 2
  const left = CELL_SIZE / 2 - metrics.actualBoundingBoxLeft - halfOutline
  const right = CELL_SIZE / 2 + metrics.actualBoundingBoxRight + halfOutline
  const baseline = CELL_SIZE / 2 + bank.baselineOffsetPx
  const top = baseline - metrics.actualBoundingBoxAscent - halfOutline
  const bottom = baseline + metrics.actualBoundingBoxDescent + halfOutline
  if (
    ![left, right, top, bottom].every(Number.isFinite) ||
    left < bank.atlasPaddingPx ||
    right > CELL_SIZE - bank.atlasPaddingPx ||
    top < bank.atlasPaddingPx ||
    bottom > CELL_SIZE - bank.atlasPaddingPx
  ) {
    throw new Error(
      `Glyph ${character} from font bank ${bank.id} is clipped by its atlas frame.`,
    )
  }
}
