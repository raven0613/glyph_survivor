import { getPrintableAsciiGlyphFrame } from '../glyph/glyphFrame.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'
import type { GlyphCell } from '../glyph/glyphStore.ts'
import type { CameraView } from '../runtime/cameraTransform.ts'
import type { VolatilePresentationEvent } from '../runtime/volatileState.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { interpolate, isWorldPositionVisible } from './glyphRenderGeometry.ts'
import type { RenderGlyph } from './renderSnapshot.ts'
import { writeRenderGlyph } from './renderGlyphBuffer.ts'
import {
  calculateVolatileNeighborJolt,
  calculateVolatileRelease,
  calculateVolatileSourceScale,
} from './volatilePresentation.ts'
import { resolveDisconnectedGlyphMotion } from './disconnectedRenderSnapshot.ts'
import { composeModifierPresentationMotion } from './modifierPresentationComposition.ts'

export interface VolatileGlyphPresentation {
  readonly offsetX: number
  readonly offsetY: number
  readonly rotation: number
  readonly scaleMultiplier: number
}

function getEventAgeMs(event: Readonly<VolatilePresentationEvent>): number {
  return event.durationMs - event.remainingMs
}

function findNeighborDirection(
  event: Readonly<VolatilePresentationEvent>,
  glyphId: number,
): { readonly x: number; readonly y: number } | null {
  const index = event.neighborGlyphIds.indexOf(glyphId)
  return index < 0
    ? null
    : {
        x: event.neighborDirectionXs[index],
        y: event.neighborDirectionYs[index],
      }
}

export function resolveVolatileGlyphPresentation(
  world: WorldState,
  glyph: Readonly<GlyphCell>,
): VolatileGlyphPresentation {
  const profile =
    world.content.combatVisualTheme.effects.runModifiers.volatile
  const sourceEvent =
    world.volatileState.latestSourceEventByGlyphId.get(glyph.id)
  const joltEvent = world.volatileState.latestJoltEventByGlyphId.get(glyph.id)
  const direction = joltEvent
    ? findNeighborDirection(joltEvent, glyph.id)
    : null
  const jolt =
    joltEvent && direction
      ? calculateVolatileNeighborJolt(
          getEventAgeMs(joltEvent),
          direction.x,
          direction.y,
          glyph.id,
          profile.neighborJolt,
        )
      : { offsetX: 0, offsetY: 0, rotation: 0 }
  return {
    ...jolt,
    scaleMultiplier: sourceEvent
      ? calculateVolatileSourceScale(
          getEventAgeMs(sourceEvent),
          profile.sourceClamp,
        )
      : 1,
  }
}

function directionCharacterIndex(
  directionX: number,
  directionY: number,
): number {
  if (directionY < 0) return 0
  if (directionX > 0) return 1
  if (directionY > 0) return 2
  return 3
}

export function writeVolatileCoreOverlays(
  world: WorldState,
  output: RenderGlyph[],
  camera: CameraView,
  interpolationAlpha: number,
): void {
  const profile =
    world.content.combatVisualTheme.effects.runModifiers.volatile.release
  let outputCount = 0
  for (const event of world.volatileState.activePresentationEvents) {
    const sourceGlyph = world.glyphStore.getById(event.sourceGlyphId)
    const owner = sourceGlyph
      ? world.enemyById.get(sourceGlyph.ownerId)
      : undefined
    if (!sourceGlyph || !owner || owner.phase === 'DEAD') {
      continue
    }
    const sourceX = getGlyphWorldX(
      interpolate(owner.previousX, owner.x, interpolationAlpha),
      sourceGlyph,
    )
    const sourceY = getGlyphWorldY(
      interpolate(owner.previousY, owner.y, interpolationAlpha),
      sourceGlyph,
    )
    const disconnected = resolveDisconnectedGlyphMotion(world, sourceGlyph)
    const volatile = resolveVolatileGlyphPresentation(world, sourceGlyph)
    const modifierMotion = composeModifierPresentationMotion(
      disconnected,
      volatile,
      world.content.combatVisualTheme.effects.runModifiers.composition,
    )
    const presentationX =
      sourceX + modifierMotion.offsetX
    const presentationY =
      sourceY + modifierMotion.offsetY
    if (!isWorldPositionVisible(presentationX, presentationY, camera)) {
      continue
    }
    const release = calculateVolatileRelease(getEventAgeMs(event), profile)
    if (release.alpha <= 0) {
      continue
    }
    for (let index = 0; index < event.neighborGlyphIds.length; index += 1) {
      const directionX = event.neighborDirectionXs[index]
      const directionY = event.neighborDirectionYs[index]
      const character =
        profile.characters[directionCharacterIndex(directionX, directionY)]
      writeRenderGlyph(
        output,
        outputCount,
        -(event.id * 4 + index + 1),
        getPrintableAsciiGlyphFrame(character),
        presentationX + directionX * release.distance,
        presentationY + directionY * release.distance,
        release.scale,
        release.alpha,
        profile.tint,
        0,
      )
      outputCount += 1
    }
  }
  output.length = outputCount
}
