import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'
import type { CameraView } from '../runtime/cameraTransform.ts'
import type { WorldState } from '../runtime/worldState.ts'
import {
  COLLAPSE_SCATTER_DISTANCE,
  GOLDEN_ANGLE,
  interpolate,
  isWorldPositionVisible,
} from './glyphRenderGeometry.ts'
import { writeRenderGlyph } from './renderGlyphBuffer.ts'
import type { RenderGlyph } from './renderSnapshot.ts'

export function writeTopologyTransferRenderSnapshot(
  world: WorldState,
  output: RenderGlyph[],
  camera: CameraView,
  interpolationAlpha: number,
): void {
  const appearance =
    world.content.combatVisualTheme.effects.topologyTransfer
  let pulseCount = 0
  for (const pulse of world.topologyTransferPulses) {
    const glyph = world.glyphStore.getById(pulse.glyphId)
    if (!glyph) {
      continue
    }
    const owner = world.enemyById.get(glyph.ownerId)
    if (!owner || owner.phase === 'DEAD') {
      continue
    }
    const rootX = interpolate(owner.previousX, owner.x, interpolationAlpha)
    const rootY = interpolate(owner.previousY, owner.y, interpolationAlpha)
    const collapseProgress =
      owner.phase === 'COLLAPSING'
        ? 1 - owner.collapseRemainingMs / owner.collapseDurationMs
        : 0
    const collapseAngle = glyph.id * GOLDEN_ANGLE
    const collapseDistance = collapseProgress * COLLAPSE_SCATTER_DISTANCE
    const x =
      getGlyphWorldX(rootX, glyph) +
      Math.cos(collapseAngle) * collapseDistance
    const y =
      getGlyphWorldY(rootY, glyph) +
      Math.sin(collapseAngle) * collapseDistance
    if (!isWorldPositionVisible(x, y, camera)) {
      continue
    }
    const intensity = Math.min(1, pulse.remainingMs / pulse.durationMs)
    writeRenderGlyph(
      output,
      pulseCount,
      pulse.id,
      glyph.glyphFrame,
      x,
      y,
      glyph.scale,
      appearance.alpha * intensity * (1 - collapseProgress),
      appearance.tint,
      glyph.rotation,
    )
    pulseCount += 1
  }
  output.length = pulseCount
}
