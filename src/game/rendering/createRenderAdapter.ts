import type { RenderSnapshot } from '../bridge/renderSnapshot.ts'
import { createGlyphAtlas } from './createGlyphAtlas.ts'
import { createParticleLayerPool } from './particleLayerPool.ts'
import { createPixiApp } from './createPixiApp.ts'
import { createSceneLayers } from './createSceneLayers.ts'
import { createFlameEmitterPool } from './flameEmitterPool.ts'
import { getPrintableAsciiGlyphFrame } from '../glyph/glyphFrame.ts'
import type { CombatVisualTheme } from '../content/visuals/combatVisualTheme.ts'
import { createPlayerSurvivalView } from './createPlayerSurvivalView.ts'
import {
  countCrackedFragmentAtlasSources,
  createCrackedSurfacePool,
} from './crackedSurfacePool.ts'
import { createOverloadDeformationPool } from './overloadDeformationPool.ts'
import {
  resolveModifierRenderDiagnostics,
  type ModifierRenderDiagnostics,
} from './renderModifierDiagnostics.ts'

export interface RenderAdapter {
  getViewportSize(): { readonly width: number; readonly height: number }
  getModifierDiagnostics(): Readonly<ModifierRenderDiagnostics>
  render(snapshot: Readonly<RenderSnapshot>): void
  clear(): void
  dispose(): void
}

export async function createRenderAdapter(
  canvas: HTMLCanvasElement,
  visualTheme: CombatVisualTheme,
  signal?: AbortSignal,
): Promise<RenderAdapter> {
  const application = await createPixiApp(canvas, visualTheme, signal)
  const atlas = createGlyphAtlas(visualTheme)
  const scene = createSceneLayers(application.stage, atlas, visualTheme)
  const playerSurvivalView = createPlayerSurvivalView(
    scene.playerRoot,
    scene.player,
    atlas,
    visualTheme,
  )
  const enemyViews = createParticleLayerPool(
    scene.enemyLayer,
    atlas.printableFrames,
  )
  const crackedSurfaceViews = createCrackedSurfacePool(
    scene.crackedSurfaceLayer,
    atlas.crackedFragmentFrames,
    visualTheme.effects.runModifiers.overload.crackedSurface,
  )
  const overloadDeformationViews = createOverloadDeformationPool(
    scene.overloadDeformationLayer,
    atlas.printableFrames,
  )
  const overloadShockwaveViews = createParticleLayerPool(
    scene.overloadShockwaveLayer,
    atlas.printableFrames,
  )
  const volatileCoreOverlayViews = createParticleLayerPool(
    scene.volatileCoreOverlayLayer,
    atlas.printableFrames,
  )
  const projectileViews = createParticleLayerPool(
    scene.projectileLayer,
    atlas.printableFrames,
  )
  const orbitViews = createParticleLayerPool(
    scene.orbitLayer,
    atlas.printableFrames,
  )
  const effectViews = createParticleLayerPool(
    scene.effectLayer,
    atlas.printableFrames,
  )
  const topologyTransferPulseViews = createParticleLayerPool(
    scene.topologyTransferPulseLayer,
    atlas.printableFrames,
  )
  const dropViews = createParticleLayerPool(
    scene.dropLayer,
    [atlas.frames.experience],
  )
  const flameViews = createFlameEmitterPool(
    scene.flameLayer,
    atlas.printableFrames[getPrintableAsciiGlyphFrame('.')],
    atlas.printableFrames[getPrintableAsciiGlyphFrame('*')],
  )
  const fragmentAtlasSourceCount = countCrackedFragmentAtlasSources(
    atlas.crackedFragmentFrames,
  )
  let modifierDiagnostics = resolveModifierRenderDiagnostics({
    crackedSurface: crackedSurfaceViews.getDiagnostics(),
    overloadDeformation: overloadDeformationViews.getDiagnostics(),
    overloadCoreOverlay: overloadShockwaveViews.getDiagnostics(),
    volatileCoreOverlay: volatileCoreOverlayViews.getDiagnostics(),
    fragmentAtlasSourceCount,
    previousPeakCoreOverlayCount: 0,
  })
  let isDisposed = false

  function updateModifierDiagnostics(): void {
    modifierDiagnostics = resolveModifierRenderDiagnostics({
      crackedSurface: crackedSurfaceViews.getDiagnostics(),
      overloadDeformation: overloadDeformationViews.getDiagnostics(),
      overloadCoreOverlay: overloadShockwaveViews.getDiagnostics(),
      volatileCoreOverlay: volatileCoreOverlayViews.getDiagnostics(),
      fragmentAtlasSourceCount,
      previousPeakCoreOverlayCount:
        modifierDiagnostics.peakModifierCoreOverlayCount,
    })
  }

  return Object.freeze({
    getViewportSize() {
      return {
        width: application.screen.width,
        height: application.screen.height,
      }
    },

    getModifierDiagnostics() {
      return modifierDiagnostics
    },

    render(snapshot: Readonly<RenderSnapshot>) {
      if (isDisposed) {
        return
      }

      scene.playerRoot.visible = true
      scene.worldRoot.position.set(
        snapshot.viewportWidth / 2 - snapshot.cameraX,
        snapshot.viewportHeight / 2 - snapshot.cameraY,
      )
      scene.playerRoot.position.set(snapshot.playerX, snapshot.playerY)
      playerSurvivalView.sync(snapshot.playerSurvivalPresentation)
      enemyViews.sync(snapshot.enemies)
      crackedSurfaceViews.sync(snapshot.crackedSurfaces)
      overloadDeformationViews.sync(snapshot.overloadDeformations)
      overloadShockwaveViews.sync(snapshot.overloadShockwaves)
      volatileCoreOverlayViews.sync(snapshot.volatileCoreOverlays)
      effectViews.sync(snapshot.effects)
      topologyTransferPulseViews.sync(snapshot.topologyTransferPulses)
      projectileViews.sync(snapshot.projectiles)
      orbitViews.sync(snapshot.orbits)
      dropViews.sync(snapshot.drops)
      flameViews.sync(snapshot.flameEmitters)
      updateModifierDiagnostics()
      application.render()
    },

    clear() {
      if (isDisposed) {
        return
      }

      // Empty syncs release active views back to reusable pools without
      // destroying Pixi resources retained by the GameHost.
      enemyViews.sync([])
      crackedSurfaceViews.sync([])
      overloadDeformationViews.sync([])
      overloadShockwaveViews.sync([])
      volatileCoreOverlayViews.sync([])
      effectViews.sync([])
      topologyTransferPulseViews.sync([])
      projectileViews.sync([])
      orbitViews.sync([])
      dropViews.sync([])
      flameViews.sync([])
      updateModifierDiagnostics()
      playerSurvivalView.clear()
      scene.playerRoot.visible = false
      application.render()
    },

    dispose() {
      if (isDisposed) {
        return
      }

      isDisposed = true
      enemyViews.clear()
      crackedSurfaceViews.clear()
      overloadDeformationViews.dispose()
      overloadShockwaveViews.clear()
      volatileCoreOverlayViews.clear()
      effectViews.clear()
      topologyTransferPulseViews.clear()
      projectileViews.clear()
      orbitViews.clear()
      dropViews.clear()
      flameViews.clear()
      application.destroy(
        { removeView: false, releaseGlobalResources: true },
        { children: true, texture: false, textureSource: false },
      )
      atlas.destroy()
    },
  })
}
