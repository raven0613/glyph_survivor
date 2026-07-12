import { Particle, type ParticleContainer, type Texture } from 'pixi.js'
import type { RenderGlyph } from '../bridge/renderSnapshot.ts'

interface ActiveParticleView {
  readonly particle: Particle
  seenFrame: number
}

export interface ParticleLayerPool {
  sync(glyphs: readonly RenderGlyph[]): void
  clear(): void
}

export function createParticleLayerPool(
  container: ParticleContainer<Particle>,
  texture: Texture,
  tint: number,
): ParticleLayerPool {
  const activeViews = new Map<number, ActiveParticleView>()
  const recycledParticles: Particle[] = []
  let frameNumber = 0

  function acquireParticle(): Particle {
    const particle = recycledParticles.pop()

    if (particle) {
      particle.texture = texture
      return particle
    }

    return new Particle({
      texture,
      anchorX: 0.5,
      anchorY: 0.5,
      tint,
    })
  }

  return Object.freeze({
    sync(glyphs: readonly RenderGlyph[]) {
      frameNumber += 1

      for (const glyph of glyphs) {
        let view = activeViews.get(glyph.id)

        if (!view) {
          const particle = acquireParticle()
          particle.tint = tint
          view = { particle, seenFrame: frameNumber }
          activeViews.set(glyph.id, view)
          container.addParticle(particle)
        }

        view.seenFrame = frameNumber
        view.particle.x = glyph.x
        view.particle.y = glyph.y
        view.particle.scaleX = glyph.scale
        view.particle.scaleY = glyph.scale
        view.particle.alpha = glyph.alpha
      }

      activeViews.forEach((view, id) => {
        if (view.seenFrame === frameNumber) {
          return
        }

        container.removeParticle(view.particle)
        activeViews.delete(id)
        recycledParticles.push(view.particle)
      })
    },

    clear() {
      activeViews.forEach((view) => container.removeParticle(view.particle))
      activeViews.clear()
      recycledParticles.length = 0
    },
  })
}
