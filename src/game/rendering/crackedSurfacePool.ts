import { Particle, type ParticleContainer } from 'pixi.js'
import type { RenderCrackedSurface } from '../bridge/overloadRenderSnapshot.ts'
import { applyGlyphBrightnessGain } from '../content/visuals/combatVisualTheme.ts'
import type { CrackedSurfaceAppearance } from '../content/visuals/combatVisualThemeTypes.ts'
import type { CrackedGlyphFragmentFrame } from './crackedGlyphFragmentFrame.ts'

interface ActiveCrackedSurfaceView {
  readonly particles: Particle[]
  glyphFrame: number
  seenFrame: number
}

export interface CrackedSurfacePool {
  sync(surfaces: readonly RenderCrackedSurface[]): void
  clear(): void
  getDiagnostics(): Readonly<CrackedSurfacePoolDiagnostics>
}

export interface CrackedSurfacePoolDiagnostics {
  readonly activeSurfaceCount: number
  readonly activeFragmentParticleCount: number
  readonly peakFragmentParticleCount: number
  readonly recycledParticleCount: number
  readonly poolMissCount: number
}

export function countCrackedFragmentAtlasSources(
  fragmentFrames: readonly (readonly Readonly<CrackedGlyphFragmentFrame>[])[],
): number {
  const sources = new Set(
    fragmentFrames.flatMap((frames) =>
      frames.map(({ texture }) => texture.source),
    ),
  )
  return sources.size
}

function getFragmentDisplacement(
  patternIndex: number,
  fragmentIndex: number,
  maximumOffset: number,
): { readonly x: number; readonly y: number; readonly rotation: number } {
  const sign = (fragmentIndex + patternIndex) % 2 === 0 ? -1 : 1
  const weight = 0.55 + fragmentIndex * 0.18
  if (patternIndex % 3 === 0) {
    return { x: sign * maximumOffset * weight, y: 0, rotation: sign }
  }
  if (patternIndex % 3 === 1) {
    return {
      x: sign * maximumOffset * 0.35,
      y: -sign * maximumOffset * weight,
      rotation: -sign,
    }
  }
  return {
    x: -sign * maximumOffset * 0.65,
    y: sign * maximumOffset * 0.4,
    rotation: sign,
  }
}

export function createCrackedSurfacePool(
  container: ParticleContainer<Particle>,
  fragmentFrames: readonly (readonly Readonly<CrackedGlyphFragmentFrame>[])[],
  appearance: Readonly<CrackedSurfaceAppearance>,
): CrackedSurfacePool {
  const activeViews = new Map<number, ActiveCrackedSurfaceView>()
  const recycledParticles: Particle[] = []
  let frameNumber = 0
  let activeFragmentParticleCount = 0
  let peakFragmentParticleCount = 0
  let poolMissCount = 0

  function acquireParticle(frame: CrackedGlyphFragmentFrame): Particle {
    const particle = recycledParticles.pop()
    if (particle) {
      particle.texture = frame.texture
      return particle
    }
    poolMissCount += 1
    return new Particle({
      texture: frame.texture,
      anchorX: 0.5,
      anchorY: 0.5,
    })
  }

  function releaseView(view: ActiveCrackedSurfaceView): void {
    for (const particle of view.particles) {
      container.removeParticle(particle)
      recycledParticles.push(particle)
    }
    activeFragmentParticleCount -= view.particles.length
  }

  function createView(surface: RenderCrackedSurface): ActiveCrackedSurfaceView {
    const frames = fragmentFrames[surface.glyphFrame]
    if (!frames) {
      throw new RangeError(
        `Missing cracked fragments for glyph frame ${surface.glyphFrame}.`,
      )
    }
    const particles = frames.map((frame) => {
      const particle = acquireParticle(frame)
      container.addParticle(particle)
      return particle
    })
    activeFragmentParticleCount += particles.length
    peakFragmentParticleCount = Math.max(
      peakFragmentParticleCount,
      activeFragmentParticleCount,
    )
    return { particles, glyphFrame: surface.glyphFrame, seenFrame: frameNumber }
  }

  return Object.freeze({
    sync(surfaces: readonly RenderCrackedSurface[]) {
      frameNumber += 1
      let changedTextures = false
      for (const surface of surfaces) {
        let view = activeViews.get(surface.id)
        if (view && view.glyphFrame !== surface.glyphFrame) {
          releaseView(view)
          activeViews.delete(surface.id)
          view = undefined
          changedTextures = true
        }
        if (!view) {
          view = createView(surface)
          activeViews.set(surface.id, view)
          changedTextures = true
        }
        view.seenFrame = frameNumber
        const frames = fragmentFrames[surface.glyphFrame]
        const cosine = Math.cos(surface.rotation)
        const sine = Math.sin(surface.rotation)
        for (let index = 0; index < view.particles.length; index += 1) {
          const frame = frames[index]
          const displacement = getFragmentDisplacement(
            surface.patternIndex,
            index,
            appearance.maximumFragmentOffset,
          )
          const localX =
            frame.centerOffsetX * surface.scale + displacement.x
          const localY =
            frame.centerOffsetY * surface.scale + displacement.y
          const particle = view.particles[index]
          particle.x = surface.x + localX * cosine - localY * sine
          particle.y = surface.y + localX * sine + localY * cosine
          particle.rotation =
            surface.rotation +
            displacement.rotation * appearance.maximumFragmentRotation
          particle.scaleX = surface.scale
          particle.scaleY = surface.scale
          particle.alpha = surface.alpha * appearance.alphaMultiplier
          particle.tint = applyGlyphBrightnessGain(
            surface.tint,
            appearance.fragmentBrightnessGains[
              index % appearance.fragmentBrightnessGains.length
            ],
          )
        }
      }

      activeViews.forEach((view, id) => {
        if (view.seenFrame === frameNumber) {
          return
        }
        releaseView(view)
        activeViews.delete(id)
      })
      if (changedTextures) {
        container.update()
      }
    },

    clear() {
      activeViews.forEach(releaseView)
      activeViews.clear()
      recycledParticles.length = 0
      activeFragmentParticleCount = 0
    },

    getDiagnostics() {
      return Object.freeze({
        activeSurfaceCount: activeViews.size,
        activeFragmentParticleCount,
        peakFragmentParticleCount,
        recycledParticleCount: recycledParticles.length,
        poolMissCount,
      })
    },
  })
}
