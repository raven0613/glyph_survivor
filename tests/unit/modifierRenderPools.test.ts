import assert from 'node:assert/strict'
import test from 'node:test'
import { Particle, ParticleContainer, Rectangle, Texture } from 'pixi.js'
import type { RenderCrackedSurface } from '../../src/game/bridge/overloadRenderSnapshot.ts'
import type { RenderGlyph } from '../../src/game/bridge/renderSnapshot.ts'
import { PROTOTYPE_COMBAT_VISUAL_THEME } from '../../src/game/content/visuals/prototypeCombatVisualTheme.ts'
import {
  countCrackedFragmentAtlasSources,
  createCrackedSurfacePool,
} from '../../src/game/rendering/crackedSurfacePool.ts'
import type { CrackedGlyphFragmentFrame } from '../../src/game/rendering/crackedGlyphFragmentFrame.ts'
import { createParticleLayerPool } from '../../src/game/rendering/particleLayerPool.ts'
import { resolveModifierRenderDiagnostics } from '../../src/game/rendering/renderModifierDiagnostics.ts'

function createParticleContainer(): ParticleContainer<Particle> {
  return new ParticleContainer<Particle>({
    texture: Texture.EMPTY,
    boundsArea: new Rectangle(0, 0, 100, 100),
    dynamicProperties: {
      position: true,
      rotation: true,
      vertex: true,
      uvs: false,
      color: true,
    },
  })
}

function createRenderGlyph(id: number): RenderGlyph {
  return {
    id,
    glyphFrame: 0,
    x: id,
    y: -id,
    rotation: id * 0.01,
    scale: 0.5,
    alpha: 0.8,
    tint: 0xabcdef,
  }
}

function createFragmentFrames(): readonly (readonly Readonly<CrackedGlyphFragmentFrame>[])[] {
  return [
    [
      { x: 0, y: 0, width: 64, height: 21, centerOffsetX: 0, centerOffsetY: -21.5, texture: Texture.EMPTY },
      { x: 0, y: 21, width: 64, height: 22, centerOffsetX: 0, centerOffsetY: 0, texture: Texture.EMPTY },
      { x: 0, y: 43, width: 64, height: 21, centerOffsetX: 0, centerOffsetY: 21.5, texture: Texture.EMPTY },
    ],
  ]
}

test('reuses core overlay particles and reports bounded pool pressure', () => {
  const container = createParticleContainer()
  const pool = createParticleLayerPool(container, [Texture.EMPTY])

  pool.sync([createRenderGlyph(1), createRenderGlyph(2)])
  assert.deepEqual(pool.getDiagnostics(), {
    activeParticleCount: 2,
    peakActiveParticleCount: 2,
    recycledParticleCount: 0,
    poolMissCount: 2,
  })

  pool.sync([])
  pool.sync([createRenderGlyph(3), createRenderGlyph(4)])

  assert.equal(pool.getDiagnostics().poolMissCount, 2)
  assert.equal(container.particleChildren.length, 2)
  assert.equal(container.particleChildren[0].tint, 0xabcdef)
  pool.clear()
  assert.equal(container.particleChildren.length, 0)
})

test('reuses two-to-three-piece CRACKED views from one atlas source', () => {
  const container = createParticleContainer()
  const fragmentFrames = createFragmentFrames()
  const pool = createCrackedSurfacePool(
    container,
    fragmentFrames,
    PROTOTYPE_COMBAT_VISUAL_THEME.effects.runModifiers.overload.crackedSurface,
  )
  const surfaces: RenderCrackedSurface[] = [
    { ...createRenderGlyph(1), patternIndex: 0 },
    { ...createRenderGlyph(2), patternIndex: 1 },
  ]

  pool.sync(surfaces)

  assert.equal(countCrackedFragmentAtlasSources(fragmentFrames), 1)
  assert.deepEqual(pool.getDiagnostics(), {
    activeSurfaceCount: 2,
    activeFragmentParticleCount: 6,
    peakFragmentParticleCount: 6,
    recycledParticleCount: 0,
    poolMissCount: 6,
  })

  pool.sync([])
  pool.sync([{ ...createRenderGlyph(3), patternIndex: 2 }])

  assert.equal(pool.getDiagnostics().poolMissCount, 6)
  assert.equal(pool.getDiagnostics().activeFragmentParticleCount, 3)
  assert.equal(container.particleChildren.length, 3)
  pool.clear()
  assert.equal(container.particleChildren.length, 0)
})

test('aggregates status and indispensable core overlay pressure separately', () => {
  const diagnostics = resolveModifierRenderDiagnostics({
    crackedSurface: {
      activeSurfaceCount: 100,
      activeFragmentParticleCount: 300,
      peakFragmentParticleCount: 450,
      recycledParticleCount: 20,
      poolMissCount: 320,
    },
    overloadDeformation: {
      activeViewCount: 3,
      peakActiveViewCount: 5,
      recycledViewCount: 2,
      poolMissCount: 7,
    },
    overloadCoreOverlay: {
      activeParticleCount: 16,
      peakActiveParticleCount: 24,
      recycledParticleCount: 8,
      poolMissCount: 24,
    },
    volatileCoreOverlay: {
      activeParticleCount: 64,
      peakActiveParticleCount: 80,
      recycledParticleCount: 16,
      poolMissCount: 80,
    },
    fragmentAtlasSourceCount: 1,
    previousPeakCoreOverlayCount: 70,
    activeVolatileClusterPointCount: 48,
    minimumReadableVolatileClusterPointCount: 32,
    volatileOptionalVisualBudgetSuppressionCount: 7,
    previousPeakVolatileClusterPointCount: 40,
  })

  assert.equal(diagnostics.activeCrackedFragmentParticleCount, 300)
  assert.equal(diagnostics.peakCrackedFragmentParticleCount, 450)
  assert.equal(diagnostics.fragmentAtlasSourceCount, 1)
  assert.equal(diagnostics.statusOverlayPoolMissCount, 320)
  assert.equal(diagnostics.activeModifierCoreOverlayCount, 80)
  assert.equal(diagnostics.peakModifierCoreOverlayCount, 80)
  assert.equal(diagnostics.activeVolatileClusterPointCount, 48)
  assert.equal(diagnostics.peakVolatileClusterPointCount, 48)
  assert.equal(diagnostics.minimumReadableVolatileClusterPointCount, 32)
  assert.equal(diagnostics.effectPoolMissCount, 111)
  assert.equal(diagnostics.activeOptionalParticleCount, 16)
  assert.equal(diagnostics.optionalVisualBudgetSuppressionCount, 7)
})
