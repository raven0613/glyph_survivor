import { Particle, type ParticleContainer, type Texture } from 'pixi.js'
import type { RenderFlameEmitter } from '../bridge/renderSnapshot.ts'

interface FlameView {
  readonly particles: Particle[]
  seenFrame: number
}

export interface FlameEmitterPool {
  sync(emitters: readonly RenderFlameEmitter[]): void
  clear(): void
}

function hashUnit(seed: number, index: number): number {
  let value = Math.imul(seed ^ index, 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000
}

export function createFlameEmitterPool(
  container: ParticleContainer<Particle>,
  dotTexture: Texture,
  starTexture: Texture,
): FlameEmitterPool {
  const activeViews = new Map<number, FlameView>()
  const recycledParticles: Particle[] = []
  let frame = 0

  function acquire(index: number): Particle {
    const particle =
      recycledParticles.pop() ??
      new Particle({ texture: dotTexture, anchorX: 0.5, anchorY: 0.5 })
    particle.texture = index % 3 === 0 ? starTexture : dotTexture
    container.addParticle(particle)
    return particle
  }

  function release(view: FlameView): void {
    for (const particle of view.particles) {
      container.removeParticle(particle)
      recycledParticles.push(particle)
    }
  }

  return Object.freeze({
    sync(emitters: readonly RenderFlameEmitter[]) {
      frame += 1
      let staticDataChanged = false
      for (const emitter of emitters) {
        let view = activeViews.get(emitter.id)
        if (!view) {
          view = { particles: [], seenFrame: frame }
          activeViews.set(emitter.id, view)
        }
        while (view.particles.length < emitter.particleCount) {
          view.particles.push(acquire(view.particles.length))
          staticDataChanged = true
        }
        view.seenFrame = frame
        const baseAngle = Math.atan2(emitter.directionY, emitter.directionX)
        for (let index = 0; index < view.particles.length; index += 1) {
          const particle = view.particles[index]
          const distanceRatio = 0.18 + hashUnit(emitter.seed, index) * 0.82
          const spread =
            (hashUnit(emitter.seed + 97, index) - 0.5) *
            emitter.fullAngleRadians
          const distance = emitter.range * distanceRatio * Math.min(1, emitter.progress * 1.45)
          particle.x = emitter.x + Math.cos(baseAngle + spread) * distance
          particle.y = emitter.y + Math.sin(baseAngle + spread) * distance
          const life = Math.max(0, 1 - emitter.progress * (0.7 + distanceRatio * 0.3))
          particle.scaleX = 0.28 + life * 0.28
          particle.scaleY = particle.scaleX
          const isInnerParticle = index % 2 === 0
          particle.alpha =
            life * (isInnerParticle ? emitter.innerAlpha : emitter.outerAlpha)
          particle.tint = isInnerParticle ? emitter.innerTint : emitter.outerTint
        }
      }
      activeViews.forEach((view, id) => {
        if (view.seenFrame !== frame) {
          release(view)
          activeViews.delete(id)
        }
      })
      if (staticDataChanged) {
        container.update()
      }
    },

    clear() {
      activeViews.forEach(release)
      activeViews.clear()
      recycledParticles.length = 0
    },
  })
}
