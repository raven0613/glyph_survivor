import { Particle, type ParticleContainer, type Texture } from 'pixi.js'
import type { RenderGlyph } from '../bridge/renderSnapshot.ts'

interface ActiveParticleView {
  readonly particle: Particle
  glyphFrame: number
  seenFrame: number
}

export interface ParticleLayerPool {
  sync(glyphs: readonly RenderGlyph[]): void
  clear(): void
}

export function createParticleLayerPool(
  container: ParticleContainer<Particle>,
  textures: readonly Texture[],
): ParticleLayerPool {
  const activeViews = new Map<number, ActiveParticleView>()
  const recycledParticles: Particle[] = []
  let frameNumber = 0

  function getTexture(glyphFrame: number): Texture {
    const texture = textures[glyphFrame]
    if (!texture) {
      throw new RangeError(`Missing texture for glyph frame ${glyphFrame}.`)
    }
    return texture
  }

  function acquireParticle(glyphFrame: number): Particle {
    const texture = getTexture(glyphFrame)
    const particle = recycledParticles.pop()

    if (particle) {
      particle.texture = texture
      return particle
    }

    return new Particle({
      texture,
      anchorX: 0.5,
      anchorY: 0.5,
      tint: 0xffffff,
    })
  }

  return Object.freeze({
    sync(glyphs: readonly RenderGlyph[]) {
      frameNumber += 1
      let hasChangedGlyphFrame = false

      for (const glyph of glyphs) {
        let view = activeViews.get(glyph.id)

        if (!view) {
          const particle = acquireParticle(glyph.glyphFrame)
          view = {
            particle,
            glyphFrame: glyph.glyphFrame,
            seenFrame: frameNumber,
          }
          activeViews.set(glyph.id, view)
          container.addParticle(particle)
        } else if (view.glyphFrame !== glyph.glyphFrame) {
          view.particle.texture = getTexture(glyph.glyphFrame)
          view.glyphFrame = glyph.glyphFrame
          hasChangedGlyphFrame = true
        }

        view.seenFrame = frameNumber
        view.particle.x = glyph.x
        view.particle.y = glyph.y
        view.particle.rotation = glyph.rotation
        view.particle.scaleX = glyph.scale
        view.particle.scaleY = glyph.scale
        view.particle.alpha = glyph.alpha
        view.particle.tint = glyph.tint
      }

      activeViews.forEach((view, id) => {
        if (view.seenFrame === frameNumber) {
          return
        }

        container.removeParticle(view.particle)
        activeViews.delete(id)
        recycledParticles.push(view.particle)
      })

      if (hasChangedGlyphFrame) {
        container.update()
      }
    },

    clear() {
      activeViews.forEach((view) => container.removeParticle(view.particle))
      activeViews.clear()
      recycledParticles.length = 0
    },
  })
}
