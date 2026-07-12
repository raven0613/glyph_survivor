import { Rectangle, Texture } from 'pixi.js'

export type GlyphFrameName =
  | 'player'
  | 'enemy'
  | 'projectile'
  | 'experience'
  | 'background'

export interface GlyphAtlas {
  readonly frames: Readonly<Record<GlyphFrameName, Texture>>
  destroy(): void
}

const CELL_SIZE = 64
const GLYPHS: readonly {
  readonly name: GlyphFrameName
  readonly character: string
}[] = [
  { name: 'player', character: '@' },
  { name: 'enemy', character: 'M' },
  { name: 'projectile', character: 'o' },
  { name: 'experience', character: '*' },
  { name: 'background', character: '+' },
]

export function createGlyphAtlas(): GlyphAtlas {
  const canvas = document.createElement('canvas')
  canvas.width = CELL_SIZE * GLYPHS.length
  canvas.height = CELL_SIZE
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Unable to create the glyph atlas canvas context.')
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = "700 34px 'SFMono-Regular', Consolas, monospace"
  context.lineWidth = 5
  context.strokeStyle = '#000000'
  context.fillStyle = '#ffffff'

  GLYPHS.forEach((glyph, index) => {
    const centerX = index * CELL_SIZE + CELL_SIZE / 2
    const centerY = CELL_SIZE / 2 + 1
    context.strokeText(glyph.character, centerX, centerY)
    context.fillText(glyph.character, centerX, centerY)
  })

  const atlasTexture = Texture.from(canvas, true)
  const frames = {} as Record<GlyphFrameName, Texture>

  GLYPHS.forEach((glyph, index) => {
    frames[glyph.name] = new Texture({
      source: atlasTexture.source,
      frame: new Rectangle(index * CELL_SIZE, 0, CELL_SIZE, CELL_SIZE),
      defaultAnchor: { x: 0.5, y: 0.5 },
      label: `glyph-${glyph.name}`,
    })
  })

  return Object.freeze({
    frames: Object.freeze(frames),
    destroy() {
      Object.values(frames).forEach((texture) => texture.destroy(false))
      atlasTexture.destroy(true)
    },
  })
}
