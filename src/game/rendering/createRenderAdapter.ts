import type { RenderSnapshot } from '../bridge/renderSnapshot.ts'
import { createGlyphAtlas } from './createGlyphAtlas.ts'
import { createParticleLayerPool } from './particleLayerPool.ts'
import { createPixiApp } from './createPixiApp.ts'
import { createSceneLayers } from './createSceneLayers.ts'
import { createFlameEmitterPool } from './flameEmitterPool.ts'
import { getPrintableAsciiGlyphFrame } from '../glyph/glyphFrame.ts'
import { createDamageTransferLinkPool } from './damageTransferLinkPool.ts'
import type { CombatVisualTheme } from '../content/visuals/combatVisualTheme.ts'
import { createPlayerSurvivalView } from './createPlayerSurvivalView.ts'

export interface RenderAdapter {
  getViewportSize(): { readonly width: number; readonly height: number }
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
  const damageTransferLinkViews = createDamageTransferLinkPool(
    scene.damageTransferLinkLayer,
    visualTheme.effects.transferLink.tint,
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
  let isDisposed = false

  return Object.freeze({
    getViewportSize() {
      return {
        width: application.screen.width,
        height: application.screen.height,
      }
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
      effectViews.sync(snapshot.effects)
      damageTransferLinkViews.sync(snapshot.damageTransferLinks)
      projectileViews.sync(snapshot.projectiles)
      orbitViews.sync(snapshot.orbits)
      dropViews.sync(snapshot.drops)
      flameViews.sync(snapshot.flameEmitters)
      application.render()
    },

    clear() {
      if (isDisposed) {
        return
      }

      // Empty syncs release active views back to reusable pools without
      // destroying Pixi resources retained by the GameHost.
      enemyViews.sync([])
      effectViews.sync([])
      damageTransferLinkViews.sync([])
      projectileViews.sync([])
      orbitViews.sync([])
      dropViews.sync([])
      flameViews.sync([])
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
      effectViews.clear()
      damageTransferLinkViews.clear()
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
