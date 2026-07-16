import { Matrix, Sprite, type Container, type Texture } from 'pixi.js'
import type { RenderOverloadDeformation } from '../bridge/overloadRenderSnapshot.ts'

interface ActiveDeformationView {
  readonly sprite: Sprite
  readonly matrix: Matrix
  glyphFrame: number
  seenFrame: number
}

export interface OverloadDeformationPool {
  sync(deformations: readonly RenderOverloadDeformation[]): void
  clear(): void
  dispose(): void
  getDiagnostics(): Readonly<OverloadDeformationPoolDiagnostics>
}

export interface OverloadDeformationPoolDiagnostics {
  readonly activeViewCount: number
  readonly peakActiveViewCount: number
  readonly recycledViewCount: number
  readonly poolMissCount: number
}

export function writeOverloadDeformationMatrix(
  matrix: Matrix,
  deformation: RenderOverloadDeformation,
): void {
  const axisX = deformation.axisX
  const axisY = deformation.axisY
  const parallel = deformation.parallelScale
  const perpendicular = deformation.perpendicularScale
  const difference = parallel - perpendicular
  const scaleXX = perpendicular + difference * axisX * axisX
  const scaleXY = difference * axisX * axisY
  const scaleYY = perpendicular + difference * axisY * axisY
  const cosine = Math.cos(deformation.rotation)
  const sine = Math.sin(deformation.rotation)
  const baseScale = deformation.scale
  matrix.set(
    baseScale * (scaleXX * cosine + scaleXY * sine),
    baseScale * (scaleXY * cosine + scaleYY * sine),
    baseScale * (-scaleXX * sine + scaleXY * cosine),
    baseScale * (-scaleXY * sine + scaleYY * cosine),
    deformation.x,
    deformation.y,
  )
}

export function createOverloadDeformationPool(
  container: Container,
  textures: readonly Texture[],
): OverloadDeformationPool {
  const activeViews = new Map<number, ActiveDeformationView>()
  const recycledViews: ActiveDeformationView[] = []
  let frameNumber = 0
  let peakActiveViewCount = 0
  let poolMissCount = 0

  function getTexture(glyphFrame: number): Texture {
    const texture = textures[glyphFrame]
    if (!texture) {
      throw new RangeError(`Missing texture for glyph frame ${glyphFrame}.`)
    }
    return texture
  }

  function acquireView(glyphFrame: number): ActiveDeformationView {
    const recycled = recycledViews.pop()
    if (recycled) {
      recycled.sprite.texture = getTexture(glyphFrame)
      recycled.glyphFrame = glyphFrame
      recycled.sprite.visible = true
      container.addChild(recycled.sprite)
      return recycled
    }
    poolMissCount += 1
    const sprite = new Sprite({
      texture: getTexture(glyphFrame),
      anchor: 0.5,
      eventMode: 'none',
    })
    container.addChild(sprite)
    return { sprite, matrix: new Matrix(), glyphFrame, seenFrame: frameNumber }
  }

  function releaseView(view: ActiveDeformationView): void {
    container.removeChild(view.sprite)
    view.sprite.visible = false
    view.sprite.alpha = 1
    view.sprite.tint = 0xffffff
    view.sprite.setFromMatrix(Matrix.IDENTITY)
    recycledViews.push(view)
  }

  function releaseAll(): void {
    activeViews.forEach(releaseView)
    activeViews.clear()
  }

  return Object.freeze({
    sync(deformations: readonly RenderOverloadDeformation[]) {
      frameNumber += 1
      for (const deformation of deformations) {
        let view = activeViews.get(deformation.id)
        if (!view) {
          view = acquireView(deformation.glyphFrame)
          activeViews.set(deformation.id, view)
        } else if (view.glyphFrame !== deformation.glyphFrame) {
          view.sprite.texture = getTexture(deformation.glyphFrame)
          view.glyphFrame = deformation.glyphFrame
        }
        view.seenFrame = frameNumber
        writeOverloadDeformationMatrix(view.matrix, deformation)
        view.sprite.setFromMatrix(view.matrix)
        view.sprite.alpha = deformation.alpha
        view.sprite.tint = deformation.tint
      }
      activeViews.forEach((view, id) => {
        if (view.seenFrame === frameNumber) {
          return
        }
        releaseView(view)
        activeViews.delete(id)
      })
      peakActiveViewCount = Math.max(peakActiveViewCount, activeViews.size)
    },

    clear() {
      releaseAll()
    },

    dispose() {
      releaseAll()
      for (const view of recycledViews) {
        view.sprite.destroy({ texture: false, textureSource: false })
      }
      recycledViews.length = 0
    },

    getDiagnostics() {
      return Object.freeze({
        activeViewCount: activeViews.size,
        peakActiveViewCount,
        recycledViewCount: recycledViews.length,
        poolMissCount,
      })
    },
  })
}
