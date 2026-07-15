import { Graphics, GraphicsContext, type Container } from 'pixi.js'
import type { RenderDamageTransferLink } from '../bridge/renderSnapshot.ts'

interface ActiveDamageTransferLinkView {
  readonly graphics: Graphics
  seenFrame: number
}

export interface DamageTransferLinkPool {
  sync(links: readonly RenderDamageTransferLink[]): void
  clear(): void
}

export function createDamageTransferLinkPool(
  container: Container,
  tint: number,
): DamageTransferLinkPool {
  const lineContext = new GraphicsContext()
    .moveTo(0, 0)
    .lineTo(1, 0)
    .stroke({ color: tint, width: 1, alpha: 1, pixelLine: true })
  const activeViews = new Map<number, ActiveDamageTransferLinkView>()
  const recycledGraphics: Graphics[] = []
  let frameNumber = 0

  function acquireGraphics(): Graphics {
    return (
      recycledGraphics.pop() ??
      new Graphics({ context: lineContext, eventMode: 'none' })
    )
  }

  return Object.freeze({
    sync(links: readonly RenderDamageTransferLink[]) {
      frameNumber += 1
      for (const link of links) {
        let view = activeViews.get(link.id)
        if (!view) {
          const graphics = acquireGraphics()
          view = { graphics, seenFrame: frameNumber }
          activeViews.set(link.id, view)
          container.addChild(graphics)
        }
        const deltaX = link.targetX - link.sourceX
        const deltaY = link.targetY - link.sourceY
        view.seenFrame = frameNumber
        view.graphics.position.set(link.sourceX, link.sourceY)
        view.graphics.rotation = Math.atan2(deltaY, deltaX)
        view.graphics.scale.set(Math.hypot(deltaX, deltaY), 1)
        view.graphics.alpha = link.alpha
      }

      activeViews.forEach((view, id) => {
        if (view.seenFrame === frameNumber) {
          return
        }
        container.removeChild(view.graphics)
        activeViews.delete(id)
        recycledGraphics.push(view.graphics)
      })
    },

    clear() {
      activeViews.forEach(({ graphics }) => {
        container.removeChild(graphics)
        graphics.destroy({ context: false })
      })
      activeViews.clear()
      for (const graphics of recycledGraphics) {
        graphics.destroy({ context: false })
      }
      recycledGraphics.length = 0
      lineContext.destroy()
    },
  })
}
