import { getPrintableAsciiGlyphFrame } from '../glyph/glyphFrame.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'
import type { GlyphCell } from '../glyph/glyphStore.ts'
import { GLYPH_STATUS_FLAG, hasGlyphStatus } from '../glyph/glyphStatus.ts'
import type { WorldState } from '../runtime/worldState.ts'
import type { CameraView } from '../runtime/cameraTransform.ts'
import { isWorldPositionVisible, interpolate } from './glyphRenderGeometry.ts'
import {
  calculateOverloadCompression,
  calculateOverloadShockwave,
} from './overloadPresentation.ts'
import type { RenderGlyph } from './renderSnapshot.ts'
import { writeRenderGlyph } from './renderGlyphBuffer.ts'

export interface RenderCrackedSurface extends RenderGlyph {
  patternIndex: number
}

export interface RenderOverloadDeformation extends RenderGlyph {
  axisX: number
  axisY: number
  parallelScale: number
  perpendicularScale: number
}

export function hasActiveOverloadGlyphDeformation(
  world: WorldState,
  glyphId: number,
): boolean {
  const event = world.overloadPresentation.latestEventByGlyphId.get(glyphId)
  if (!event) {
    return false
  }
  const profile =
    world.content.combatVisualTheme.effects.runModifiers.overload.compression
  return event.durationMs - event.remainingMs <
    profile.attackDurationMs +
      profile.holdDurationMs +
      profile.settleDurationMs
}

export function writeOverloadGlyphPresentation(
  world: WorldState,
  glyph: GlyphCell,
  x: number,
  y: number,
  rotation: number,
  scale: number,
  alpha: number,
  tint: number,
  crackedSurfaces: RenderCrackedSurface[],
  crackedSurfaceIndex: number,
  overloadDeformations: RenderOverloadDeformation[],
  overloadDeformationIndex: number,
): { readonly hideBaseGlyph: boolean; readonly crackedSurfaceIndex: number; readonly overloadDeformationIndex: number } {
  const event = world.overloadPresentation.latestEventByGlyphId.get(glyph.id)
  if (event) {
    const profile =
      world.content.combatVisualTheme.effects.runModifiers.overload.compression
    const ageMs = event.durationMs - event.remainingMs
    const totalDurationMs =
      profile.attackDurationMs +
      profile.holdDurationMs +
      profile.settleDurationMs
    if (ageMs < totalDurationMs) {
      const compression = calculateOverloadCompression(ageMs, profile)
      const output =
        overloadDeformations[overloadDeformationIndex] ??
        ({} as RenderOverloadDeformation)
      Object.assign(output, {
        id: glyph.id,
        glyphFrame: glyph.glyphFrame,
        x,
        y,
        rotation,
        scale,
        alpha,
        tint,
        axisX: event.directionX,
        axisY: event.directionY,
        parallelScale: compression.parallelScale,
        perpendicularScale: compression.perpendicularScale,
      })
      overloadDeformations[overloadDeformationIndex] = output
      return {
        hideBaseGlyph: true,
        crackedSurfaceIndex,
        overloadDeformationIndex: overloadDeformationIndex + 1,
      }
    }
  }

  if (hasGlyphStatus(glyph, GLYPH_STATUS_FLAG.CRACKED)) {
    const output =
      crackedSurfaces[crackedSurfaceIndex] ?? ({} as RenderCrackedSurface)
    Object.assign(output, {
      id: glyph.id,
      glyphFrame: glyph.glyphFrame,
      x,
      y,
      rotation,
      scale,
      alpha,
      tint,
      patternIndex: glyph.id % 3,
    })
    crackedSurfaces[crackedSurfaceIndex] = output
    return {
      hideBaseGlyph: true,
      crackedSurfaceIndex: crackedSurfaceIndex + 1,
      overloadDeformationIndex,
    }
  }

  return {
    hideBaseGlyph: false,
    crackedSurfaceIndex,
    overloadDeformationIndex,
  }
}

export function writeOverloadShockwaves(
  world: WorldState,
  output: RenderGlyph[],
  camera: CameraView,
  interpolationAlpha: number,
): void {
  const profile =
    world.content.combatVisualTheme.effects.runModifiers.overload.shockwave
  const totalDurationMs =
    profile.attackDurationMs +
    profile.holdDurationMs +
    profile.settleDurationMs
  let outputCount = 0
  for (const event of world.overloadPresentation.activeEvents) {
    const ageMs = event.durationMs - event.remainingMs
    if (ageMs >= totalDurationMs) {
      continue
    }
    const glyph = world.glyphStore.getById(event.glyphId)
    const owner = glyph ? world.enemyById.get(glyph.ownerId) : undefined
    if (!glyph || !owner || owner.phase === 'DEAD') {
      continue
    }
    const rootX = interpolate(owner.previousX, owner.x, interpolationAlpha)
    const rootY = interpolate(owner.previousY, owner.y, interpolationAlpha)
    const sourceX = getGlyphWorldX(rootX, glyph)
    const sourceY = getGlyphWorldY(rootY, glyph)
    if (!isWorldPositionVisible(sourceX, sourceY, camera)) {
      continue
    }
    const presentation = calculateOverloadShockwave(ageMs, profile)
    if (presentation.alpha <= 0) {
      continue
    }
    const phaseOffset = (event.id % profile.particleCount) * 0.17
    for (let index = 0; index < profile.particleCount; index += 1) {
      const angle =
        phaseOffset + (index / profile.particleCount) * Math.PI * 2
      const character = profile.characters[index % profile.characters.length]
      writeRenderGlyph(
        output,
        outputCount,
        event.id * profile.particleCount + index,
        getPrintableAsciiGlyphFrame(character),
        sourceX + Math.cos(angle) * presentation.radius,
        sourceY + Math.sin(angle) * presentation.radius,
        presentation.scale,
        presentation.alpha,
        profile.tint,
        angle,
      )
      outputCount += 1
    }
  }
  output.length = outputCount
}
