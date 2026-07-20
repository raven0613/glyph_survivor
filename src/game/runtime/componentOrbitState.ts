import {
  COMPONENT_ORBIT_DIRECTION,
  CREATURE_BODY_MOTION_BEHAVIOR,
  type ComponentOrbitBodyMotionDefinition,
  type ComponentOrbitGroupDefinition,
  type CreatureDefinition,
} from '../content/creatures/creatureDefinition.ts'
import type { GlyphStore } from '../glyph/glyphStore.ts'
import type { WorldDiagnostics } from './worldDiagnostics.ts'
import {
  GLYPH_DEPTH_BAND,
  type ComponentOrbitState,
  type EnemyState,
  type GlyphDepthBand,
} from './worldEntities.ts'

const FULL_TURN_RADIANS = Math.PI * 2
const TIME_EPSILON_MS = 0.000_001

function normalizeRadians(value: number): number {
  const normalized = value % FULL_TURN_RADIANS
  return normalized < 0 ? normalized + FULL_TURN_RADIANS : normalized
}

function resolveDepthBand(
  current: GlyphDepthBand,
  depthSignal: number,
  profile: Readonly<ComponentOrbitGroupDefinition>,
): GlyphDepthBand {
  if (current === GLYPH_DEPTH_BAND.FRONT) {
    return depthSignal >=
      profile.frontDepthThreshold - profile.depthBandHysteresis
      ? current
      : GLYPH_DEPTH_BAND.BODY
  }
  if (current === GLYPH_DEPTH_BAND.BEHIND) {
    return depthSignal <=
      profile.behindDepthThreshold + profile.depthBandHysteresis
      ? current
      : GLYPH_DEPTH_BAND.BODY
  }
  if (depthSignal > profile.frontDepthThreshold) {
    return GLYPH_DEPTH_BAND.FRONT
  }
  if (depthSignal < profile.behindDepthThreshold) {
    return GLYPH_DEPTH_BAND.BEHIND
  }
  return GLYPH_DEPTH_BAND.BODY
}

function writeOrbitTransform(
  state: ComponentOrbitState,
  profile: Readonly<ComponentOrbitGroupDefinition>,
): boolean {
  const previousDepthBand = state.depthBand
  const cosine = Math.cos(state.phaseRadians)
  const sine = Math.sin(state.phaseRadians)
  const localX = cosine * profile.primaryRadiusWorldUnits
  const localY = sine * profile.secondaryRadiusWorldUnits
  state.offsetX =
    profile.centerOffsetX + localX * state.axisCosine - localY * state.axisSine
  state.offsetY =
    profile.centerOffsetY + localX * state.axisSine + localY * state.axisCosine
  state.depthBand = resolveDepthBand(state.depthBand, sine, profile)
  return state.depthBand !== previousDepthBand
}

function getOrbitProfile(
  bodyMotion: ComponentOrbitBodyMotionDefinition,
  profileId: string,
): Readonly<ComponentOrbitGroupDefinition> {
  const profile = bodyMotion.orbitGroups.find(({ id }) => id === profileId)
  if (!profile) {
    throw new Error(`Missing component orbit profile ${profileId}.`)
  }
  return profile
}

function applyOrbitTransform(
  state: ComponentOrbitState,
  glyphStore: GlyphStore,
): number {
  for (let index = 0; index < state.glyphIds.length; index += 1) {
    glyphStore.setGlyphBodyMotion(
      state.glyphIds[index],
      state.offsetX,
      state.offsetY,
      0,
    )
  }
  return state.glyphIds.length
}

export function initializeComponentOrbitState(
  enemy: EnemyState,
  definition: CreatureDefinition,
  glyphStore: GlyphStore,
): void {
  enemy.componentOrbitStates.length = 0
  const bodyMotion = definition.bodyMotion
  if (bodyMotion.behaviorId !== CREATURE_BODY_MOTION_BEHAVIOR.COMPONENT_ORBIT) {
    return
  }
  for (const profile of bodyMotion.orbitGroups) {
    const state: ComponentOrbitState = {
      profileId: profile.id,
      motionGroupId: profile.motionGroupId,
      glyphIds: [],
      axisCosine: Math.cos(profile.axisRotationRadians),
      axisSine: Math.sin(profile.axisRotationRadians),
      phaseRadians: normalizeRadians(profile.initialPhaseRadians),
      revolutionElapsedMs: 0,
      pauseRemainingMs: 0,
      initialDelayRemainingMs: profile.initialDelayMs + profile.cadenceOffsetMs,
      offsetX: 0,
      offsetY: 0,
      depthBand: GLYPH_DEPTH_BAND.BODY,
    }
    writeOrbitTransform(state, profile)
    enemy.componentOrbitStates.push(state)
  }
  for (const glyph of glyphStore.getOwnerGlyphs(enemy.id)) {
    const motionGroupId = bodyMotion.groupBySlotId[glyph.bodySlotId]
    if (motionGroupId === 0) {
      glyphStore.setGlyphBodyMotion(glyph.id, 0, 0, 0)
      continue
    }
    const state = enemy.componentOrbitStates.find(
      (candidate) => candidate.motionGroupId === motionGroupId,
    )
    if (!state) {
      throw new Error(`Missing component orbit state for motion group ${motionGroupId}.`)
    }
    state.glyphIds.push(glyph.id)
  }
  for (const state of enemy.componentOrbitStates) {
    applyOrbitTransform(state, glyphStore)
  }
}

function advanceOrbitState(
  state: ComponentOrbitState,
  profile: Readonly<ComponentOrbitGroupDefinition>,
  deltaMs: number,
): boolean {
  let remainingMs = Math.max(0, deltaMs)
  let transformChanged = false
  while (remainingMs > TIME_EPSILON_MS) {
    if (state.initialDelayRemainingMs > 0) {
      const consumedMs = Math.min(remainingMs, state.initialDelayRemainingMs)
      state.initialDelayRemainingMs -= consumedMs
      remainingMs -= consumedMs
      continue
    }
    if (state.pauseRemainingMs > 0) {
      const consumedMs = Math.min(remainingMs, state.pauseRemainingMs)
      state.pauseRemainingMs -= consumedMs
      remainingMs -= consumedMs
      continue
    }

    const activeRemainingMs =
      profile.revolutionDurationMs - state.revolutionElapsedMs
    const consumedMs = Math.min(remainingMs, activeRemainingMs)
    transformChanged ||= consumedMs > 0
    state.revolutionElapsedMs += consumedMs
    remainingMs -= consumedMs
    const directionSign =
      profile.direction === COMPONENT_ORBIT_DIRECTION.CLOCKWISE ? 1 : -1
    state.phaseRadians = normalizeRadians(
      profile.initialPhaseRadians +
        directionSign *
          FULL_TURN_RADIANS *
          (state.revolutionElapsedMs / profile.revolutionDurationMs),
    )

    if (
      state.revolutionElapsedMs + TIME_EPSILON_MS >=
      profile.revolutionDurationMs
    ) {
      state.revolutionElapsedMs = 0
      state.phaseRadians = normalizeRadians(profile.initialPhaseRadians)
      state.pauseRemainingMs = profile.postRevolutionPauseMs
    }
  }
  return transformChanged
}

export function advanceComponentOrbitState(
  enemy: EnemyState,
  definition: CreatureDefinition,
  glyphStore: GlyphStore,
  deltaMs: number,
  diagnostics: WorldDiagnostics,
): void {
  const bodyMotion = definition.bodyMotion
  if (bodyMotion.behaviorId !== CREATURE_BODY_MOTION_BEHAVIOR.COMPONENT_ORBIT) {
    throw new Error('Component orbit motion requires a COMPONENT_ORBIT profile.')
  }
  for (const state of enemy.componentOrbitStates) {
    const profile = getOrbitProfile(bodyMotion, state.profileId)
    const transformChanged = advanceOrbitState(state, profile, deltaMs)
    if (transformChanged) {
      if (writeOrbitTransform(state, profile)) {
        diagnostics.componentOrbitDepthBandMigrationCount += 1
      }
      diagnostics.componentOrbitTransformEvaluationCount += 1
      diagnostics.componentOrbitGlyphUpdateCount += applyOrbitTransform(
        state,
        glyphStore,
      )
    }
    if (
      state.initialDelayRemainingMs > 0 ||
      state.pauseRemainingMs > 0
    ) {
      diagnostics.componentOrbitPausedGroupCount += 1
    } else {
      diagnostics.componentOrbitActiveGroupCount += 1
    }
  }
}

export function getComponentMotionOffset(
  enemy: EnemyState,
  motionGroupId: number,
): { readonly x: number; readonly y: number } | null {
  if (motionGroupId === 0) {
    return { x: 0, y: 0 }
  }
  const state = enemy.componentOrbitStates.find(
    (candidate) => candidate.motionGroupId === motionGroupId,
  )
  return state ? { x: state.offsetX, y: state.offsetY } : null
}

export function getComponentMotionDepthBand(
  enemy: EnemyState,
  definition: CreatureDefinition,
  bodySlotId: number,
): GlyphDepthBand {
  if (
    definition.bodyMotion.behaviorId !==
    CREATURE_BODY_MOTION_BEHAVIOR.COMPONENT_ORBIT
  ) {
    return GLYPH_DEPTH_BAND.BODY
  }
  const motionGroupId = definition.bodyMotion.groupBySlotId[bodySlotId]
  if (motionGroupId === 0) {
    return GLYPH_DEPTH_BAND.BODY
  }
  return (
    enemy.componentOrbitStates.find(
      (candidate) => candidate.motionGroupId === motionGroupId,
    )?.depthBand ?? GLYPH_DEPTH_BAND.BODY
  )
}
