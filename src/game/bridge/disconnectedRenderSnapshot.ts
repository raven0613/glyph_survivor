import type { GlyphCell } from '../glyph/glyphCell.ts'
import { calculateDisconnectedSeverity } from '../glyph/disconnectedTopology.ts'
import { GLYPH_STATUS_FLAG, hasGlyphStatus } from '../glyph/glyphStatus.ts'
import type { WorldState } from '../runtime/worldState.ts'
import {
  calculateDisconnectedAmbientMotion,
  calculateDisconnectedHitMotion,
} from './disconnectedPresentation.ts'

export interface ResolvedDisconnectedGlyphMotion {
  readonly offsetX: number
  readonly offsetY: number
  readonly rotation: number
}

export function resolveDisconnectedGlyphMotion(
  world: WorldState,
  glyph: Readonly<GlyphCell>,
): ResolvedDisconnectedGlyphMotion {
  const component = world.disconnectedState.topologyByOwnerId
    .get(glyph.ownerId)
    ?.componentByGlyphId.get(glyph.id)
  const hitEvent =
    world.disconnectedState.latestHitEventByGlyphId.get(glyph.id)
  const parameters = world.runModifierState.resolvedProfile.disconnected
  const hasLatch = hasGlyphStatus(
    glyph,
    GLYPH_STATUS_FLAG.DISCONNECTED_LATCHED,
  )
  const latchSeverity =
    hasLatch && parameters
      ? calculateDisconnectedSeverity(
          glyph.disconnectedLatchedMultiplier,
          parameters.maximumDamageMultiplier,
        )
      : 0
  if (!component && !hitEvent && latchSeverity === 0) {
    return { offsetX: 0, offsetY: 0, rotation: 0 }
  }
  const appearance =
    world.content.combatVisualTheme.effects.runModifiers.disconnected
  const severity = Math.max(
    component?.severity ?? 0,
    hitEvent?.severity ?? 0,
    latchSeverity,
  )
  const ambient = component
    ? calculateDisconnectedAmbientMotion(
        {
          presentationTimeMs: world.runTimeMs,
          seedHash: world.seedHash,
          componentId:
            latchSeverity > component.severity
              ? -glyph.disconnectedLatchEpisodeId
              : component.id,
          glyphId: glyph.id,
          severity,
          topologyX: glyph.topologyX,
          topologyY: glyph.topologyY,
          centroidTopologyX: component.centroidTopologyX,
          centroidTopologyY: component.centroidTopologyY,
          suppressBurst: Boolean(
            hitEvent ||
              world.overloadPresentation.latestEventByGlyphId.has(glyph.id) ||
              world.volatileState.latestSourceEventByGlyphId.has(glyph.id) ||
              world.volatileState.latestJoltEventByGlyphId.has(glyph.id),
          ),
        },
        appearance.ambient,
      )
    : { offsetX: 0, offsetY: 0, rotation: 0 }
  if (!hitEvent) {
    return ambient
  }
  const hit = calculateDisconnectedHitMotion(
    hitEvent.durationMs - hitEvent.remainingMs,
    glyph.id,
    hitEvent.directionX,
    hitEvent.directionY,
    hitEvent.severity,
    appearance.hitShake,
  )
  return {
    offsetX: ambient.offsetX + hit.offsetX,
    offsetY: ambient.offsetY + hit.offsetY,
    rotation: ambient.rotation + hit.rotation,
  }
}
