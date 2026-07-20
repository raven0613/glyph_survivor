import {
  CREATURE_COLLAPSE_BEHAVIOR,
  type CreatureCollapseBehaviorId,
} from '../content/creatures/creatureDefinition.ts'
import { getCreatureDefinition } from '../content/gameContent.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import {
  RHOMBUS_COLLAPSE_PHASE,
  type RhombusCollapseGlyphPlan,
  type RhombusCollapsePhase,
} from '../runtime/rhombusCollapseState.ts'
import type { EnemyState } from '../runtime/worldEntities.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'

const PHASE_ORDER: Readonly<Record<RhombusCollapsePhase, number>> = Object.freeze({
  [RHOMBUS_COLLAPSE_PHASE.BRIGHTNESS_LIFT]: 0,
  [RHOMBUS_COLLAPSE_PHASE.FALLING]: 1,
  [RHOMBUS_COLLAPSE_PHASE.SETTLING]: 2,
  [RHOMBUS_COLLAPSE_PHASE.COMPLETE]: 3,
})

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function beginRhombusMasonryCollapse(
  world: WorldState,
  enemy: EnemyState,
): void {
  if (world.rhombusCollapseStates.has(enemy.id)) {
    return
  }
  const definition = world.content.rhombusBossDefinition
  const profile = definition.collapseProfile
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  const slotPlanById = new Map(
    definition.collapseSlotPlans.map((plan) => [plan.bodySlotId, plan]),
  )
  const ordered = glyphs
    .map((glyph) => ({
      glyph,
      startX: getGlyphWorldX(enemy.x, glyph),
      startY: getGlyphWorldY(enemy.y, glyph),
    }))
    .sort(
      (left, right) =>
        right.glyph.topologyY - left.glyph.topologyY ||
        right.startY - left.startY ||
        left.glyph.bodySlotId - right.glyph.bodySlotId,
    )
  if (ordered.length !== definition.collapseSlotPlans.length) {
    throw new Error('RHOMBUS collapse must retain every authored Glyph Cell.')
  }

  const supportBand = profile.pileSupportBandHeightWorldUnits
  const maximumStartY = ordered.reduce(
    (maximum, { startY }) => Math.max(maximum, startY),
    -Infinity,
  )
  const maximumTopologyY = ordered.reduce(
    (maximum, { glyph }) => Math.max(maximum, glyph.topologyY),
    -Infinity,
  )
  const minimumTopologyY = ordered.reduce(
    (minimum, { glyph }) => Math.min(minimum, glyph.topologyY),
    Infinity,
  )
  const topologyVerticalRange = Math.max(
    1,
    maximumTopologyY - minimumTopologyY,
  )
  const groundY = Math.min(
    GAME_CONFIG.worldHeight - supportBand * 0.5,
    maximumStartY + supportBand * 2.5,
  )
  const laneHeights = new Map<number, number>()
  const glyphPlans: Readonly<RhombusCollapseGlyphPlan>[] = []
  const glyphPlanById = new Map<number, Readonly<RhombusCollapseGlyphPlan>>()

  for (const { glyph, startX, startY } of ordered) {
    const slotPlan = slotPlanById.get(glyph.bodySlotId)
    if (!slotPlan) {
      throw new Error(`Missing RHOMBUS collapse slot ${glyph.bodySlotId}.`)
    }
    const lane =
      Math.round((startX - enemy.x) / supportBand) + slotPlan.laneOffset
    const occupiedHeight = laneHeights.get(lane) ?? 0
    const stackStep = supportBand * (0.42 + slotPlan.stackStepRatio * 0.25)
    const targetX = clamp(
      enemy.x +
        lane * supportBand +
        slotPlan.horizontalJitterRatio * supportBand * 0.3,
      supportBand,
      GAME_CONFIG.worldWidth - supportBand,
    )
    const targetY = clamp(
      groundY - occupiedHeight,
      supportBand,
      GAME_CONFIG.worldHeight - supportBand * 0.5,
    )
    const heightDelayRatio =
      (maximumTopologyY - glyph.topologyY) / topologyVerticalRange
    const fallDelayMs =
      profile.maximumFallDelayMs *
      (heightDelayRatio * 0.72 + slotPlan.fallDelayJitterRatio * 0.28)
    const plan = Object.freeze({
      glyphId: glyph.id,
      bodySlotId: glyph.bodySlotId,
      startX,
      startY,
      startRotation: glyph.rotation,
      landingX: targetX,
      landingY:
        targetY - supportBand * (0.12 + slotPlan.stackStepRatio * 0.2),
      targetX,
      targetY,
      targetRotation:
        glyph.rotation +
        slotPlan.rotationRatio * profile.maximumRotationRadians,
      fallDelayMs,
    })
    glyphPlans.push(plan)
    glyphPlanById.set(glyph.id, plan)
    laneHeights.set(lane, occupiedHeight + stackStep)
  }

  world.rhombusCollapseStates.set(enemy.id, {
    ownerId: enemy.id,
    encounterId: enemy.encounterId ?? enemy.id,
    glyphPlans: Object.freeze(glyphPlans),
    glyphPlanById,
    phase: RHOMBUS_COLLAPSE_PHASE.BRIGHTNESS_LIFT,
  })
  world.diagnostics.rhombusCollapsePlansCreated += 1
  world.diagnostics.rhombusCollapseGlyphPlansCreated += glyphPlans.length
  world.diagnostics.activeRhombusCollapseCount += 1
  world.diagnostics.rhombusCollapseBrightnessLiftStarted += 1
}

const COLLAPSE_START_STRATEGIES: Readonly<
  Record<CreatureCollapseBehaviorId, (world: WorldState, enemy: EnemyState) => void>
> = Object.freeze({
  [CREATURE_COLLAPSE_BEHAVIOR.SCATTER]: () => {},
  [CREATURE_COLLAPSE_BEHAVIOR.RHOMBUS_MASONRY]: beginRhombusMasonryCollapse,
})

export function beginCreatureCollapse(
  world: WorldState,
  enemy: EnemyState,
): void {
  const definition = getCreatureDefinition(world.content, enemy.definitionId)
  COLLAPSE_START_STRATEGIES[definition.collapseBehaviorId](world, enemy)
}

export function updateCreatureCollapsePresentation(
  world: WorldState,
  enemy: EnemyState,
): void {
  const state = world.rhombusCollapseStates.get(enemy.id)
  if (!state) {
    return
  }
  const profile = world.content.rhombusBossDefinition.collapseProfile
  const brightnessDurationMs =
    world.content.combatVisualTheme.effects.rhombus.collapse
      .brightnessLiftDurationMs
  const elapsedMs = enemy.collapseDurationMs - enemy.collapseRemainingMs
  const nextPhase =
    elapsedMs < brightnessDurationMs
      ? RHOMBUS_COLLAPSE_PHASE.BRIGHTNESS_LIFT
      : elapsedMs <
          brightnessDurationMs +
            profile.maximumFallDelayMs +
            profile.fallDurationMs
        ? RHOMBUS_COLLAPSE_PHASE.FALLING
        : elapsedMs <
            brightnessDurationMs +
              profile.maximumFallDelayMs +
              profile.fallDurationMs +
              profile.settleDurationMs
          ? RHOMBUS_COLLAPSE_PHASE.SETTLING
          : RHOMBUS_COLLAPSE_PHASE.COMPLETE
  if (PHASE_ORDER[nextPhase] <= PHASE_ORDER[state.phase]) {
    return
  }
  const previousOrder = PHASE_ORDER[state.phase]
  const nextOrder = PHASE_ORDER[nextPhase]
  state.phase = nextPhase
  if (previousOrder < 1 && nextOrder >= 1) {
    world.diagnostics.rhombusCollapseFallStarted += 1
  }
  if (previousOrder < 2 && nextOrder >= 2) {
    world.diagnostics.rhombusCollapseSettleStarted += 1
  }
  if (previousOrder < 3 && nextOrder >= 3) {
    world.diagnostics.rhombusCollapseCompleted += 1
    world.diagnostics.activeRhombusCollapseCount = Math.max(
      0,
      world.diagnostics.activeRhombusCollapseCount - 1,
    )
  }
}

export function removeCreatureCollapsePresentation(
  world: WorldState,
  ownerId: number,
): void {
  const state = world.rhombusCollapseStates.get(ownerId)
  if (!state) {
    return
  }
  if (state.phase !== RHOMBUS_COLLAPSE_PHASE.COMPLETE) {
    world.diagnostics.activeRhombusCollapseCount = Math.max(
      0,
      world.diagnostics.activeRhombusCollapseCount - 1,
    )
  }
  world.rhombusCollapseStates.delete(ownerId)
}
