import type { RenderSnapshot } from '../bridge/renderSnapshot.ts'
import { createGlyphAtlas } from './createGlyphAtlas.ts'
import { createParticleLayerPool } from './particleLayerPool.ts'
import { createPixiApp } from './createPixiApp.ts'
import { createSceneLayers } from './createSceneLayers.ts'

export interface RenderAdapter {
  getViewportSize(): { readonly width: number; readonly height: number }
  render(snapshot: Readonly<RenderSnapshot>): void
  dispose(): void
}

export async function createRenderAdapter(
  canvas: HTMLCanvasElement,
  signal?: AbortSignal,
): Promise<RenderAdapter> {
  const application = await createPixiApp(canvas, signal)
  const atlas = createGlyphAtlas()
  const scene = createSceneLayers(application.stage, atlas)
  const enemyViews = createParticleLayerPool(
    scene.enemyLayer,
    atlas.printableFrames,
  )
  const projectileViews = createParticleLayerPool(
    scene.projectileLayer,
    [atlas.frames.projectile],
  )
  const effectViews = createParticleLayerPool(
    scene.effectLayer,
    atlas.printableFrames,
  )
  const dropViews = createParticleLayerPool(
    scene.dropLayer,
    [atlas.frames.experience],
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

      scene.worldRoot.position.set(
        snapshot.viewportWidth / 2 - snapshot.cameraX,
        snapshot.viewportHeight / 2 - snapshot.cameraY,
      )
      scene.player.position.set(snapshot.playerX, snapshot.playerY)
      enemyViews.sync(snapshot.enemies)
      effectViews.sync(snapshot.effects)
      projectileViews.sync(snapshot.projectiles)
      dropViews.sync(snapshot.drops)
      application.render()
    },

    dispose() {
      if (isDisposed) {
        return
      }

      isDisposed = true
      enemyViews.clear()
      effectViews.clear()
      projectileViews.clear()
      dropViews.clear()
      application.destroy(
        { removeView: false, releaseGlobalResources: true },
        { children: true, texture: false, textureSource: false },
      )
      atlas.destroy()
    },
  })
}
