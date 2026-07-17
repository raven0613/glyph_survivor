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
import {
  getVolatileClusterCount,
  getVolatileClusterPointCount,
  writeVolatileCenterHighlightPresentation,
  writeVolatileClusterPresentation,
  writeVolatileClusterPointPresentation,
  type VolatileCenterHighlightPresentation,
  type VolatileClusterPresentation,
  type VolatileClusterPointPresentation,
} from './volatileClusterPresentation.ts'
import { resolveDisconnectedGlyphMotion } from './disconnectedRenderSnapshot.ts'
import { composeModifierPresentationMotion } from './modifierPresentationComposition.ts'

export interface VolatileGlyphPresentation {
  readonly offsetX: number
  readonly offsetY: number
  readonly rotation: number
  readonly scaleMultiplier: number
}

export interface VolatileOverlayDiagnostics {
  activeClusterPointCount: number
  minimumReadableClusterPointCount: number
  optionalVisualBudgetSuppressionCount: number
}

export function createVolatileOverlayDiagnostics(): VolatileOverlayDiagnostics {
  return {
    activeClusterPointCount: 0,
    minimumReadableClusterPointCount: 0,
    optionalVisualBudgetSuppressionCount: 0,
  }
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
  diagnostics: VolatileOverlayDiagnostics,
  camera: CameraView,
  interpolationAlpha: number,
): void {
  const volatile =
    world.content.combatVisualTheme.effects.runModifiers.volatile
  const releaseProfile = volatile.release
  const clusterProfile = volatile.clusterBurst
  const pointPresentation: VolatileClusterPointPresentation = {
    offsetX: 0,
    offsetY: 0,
    scale: 0,
    alpha: 0,
    characterIndex: 0,
  }
  const clusterPresentation: VolatileClusterPresentation = {
    offsetX: 0,
    offsetY: 0,
  }
  const centerPresentation: VolatileCenterHighlightPresentation = {
    scale: 0,
    alpha: 0,
  }
  let outputCount = 0
  diagnostics.activeClusterPointCount = 0
  diagnostics.minimumReadableClusterPointCount = 0
  diagnostics.optionalVisualBudgetSuppressionCount = 0
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
    const eventAgeMs = getEventAgeMs(event)
    const release = calculateVolatileRelease(eventAgeMs, releaseProfile)
    const maximumPointSlots =
      clusterProfile.maximumClusterCount *
      clusterProfile.maximumPointsPerCluster
    const eventSlotCount = maximumPointSlots + 5
    const eventIdBase = event.id * eventSlotCount
    if (release.alpha > 0) {
      for (let index = 0; index < event.neighborGlyphIds.length; index += 1) {
        const directionX = event.neighborDirectionXs[index]
        const directionY = event.neighborDirectionYs[index]
        const character =
          releaseProfile.characters[
            directionCharacterIndex(directionX, directionY)
          ]
        writeRenderGlyph(
          output,
          outputCount,
          -(eventIdBase + index + 1),
          getPrintableAsciiGlyphFrame(character),
          presentationX + directionX * release.distance,
          presentationY + directionY * release.distance,
          release.scale,
          release.alpha,
          releaseProfile.tint,
          0,
        )
        outputCount += 1
      }
    }

    writeVolatileCenterHighlightPresentation(
      centerPresentation,
      eventAgeMs,
      clusterProfile.centerHighlight,
    )
    if (centerPresentation.alpha > 0) {
      writeRenderGlyph(
        output,
        outputCount,
        -(eventIdBase + 5),
        getPrintableAsciiGlyphFrame(
          clusterProfile.centerHighlight.character,
        ),
        presentationX,
        presentationY,
        centerPresentation.scale,
        centerPresentation.alpha,
        clusterProfile.centerHighlight.tint,
        0,
      )
      outputCount += 1
    }

    const clusterCount = getVolatileClusterCount(event.id, clusterProfile)
    for (
      let clusterIndex = 0;
      clusterIndex < clusterCount;
      clusterIndex += 1
    ) {
      const pointCount = getVolatileClusterPointCount(
        event.id,
        clusterIndex,
        clusterProfile,
      )
      writeVolatileClusterPresentation(
        clusterPresentation,
        event.id,
        clusterCount,
        clusterIndex,
        eventAgeMs,
        clusterProfile,
      )
      for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
        writeVolatileClusterPointPresentation(
          pointPresentation,
          event.id,
          clusterIndex,
          pointIndex,
          clusterPresentation.offsetX,
          clusterPresentation.offsetY,
          eventAgeMs,
          clusterProfile,
        )
        if (pointPresentation.alpha <= 0) {
          continue
        }
        const isMinimumReadablePoint =
          pointIndex < clusterProfile.minimumPointsPerCluster
        if (
          !isMinimumReadablePoint &&
          diagnostics.activeClusterPointCount >=
            clusterProfile.maximumActivePointCount
        ) {
          diagnostics.optionalVisualBudgetSuppressionCount += 1
          continue
        }
        const pointSlot =
          5 +
          clusterIndex * clusterProfile.maximumPointsPerCluster +
          pointIndex
        writeRenderGlyph(
          output,
          outputCount,
          -(eventIdBase + pointSlot + 1),
          getPrintableAsciiGlyphFrame(
            clusterProfile.characters[pointPresentation.characterIndex],
          ),
          presentationX + pointPresentation.offsetX,
          presentationY + pointPresentation.offsetY,
          pointPresentation.scale,
          pointPresentation.alpha,
          clusterProfile.tint,
          0,
        )
        outputCount += 1
        diagnostics.activeClusterPointCount += 1
        if (isMinimumReadablePoint) {
          diagnostics.minimumReadableClusterPointCount += 1
        }
      }
    }
  }
  output.length = outputCount
}
