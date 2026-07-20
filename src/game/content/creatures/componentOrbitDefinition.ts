export const COMPONENT_ORBIT_DIRECTION = Object.freeze({
  CLOCKWISE: 'CLOCKWISE',
  COUNTERCLOCKWISE: 'COUNTERCLOCKWISE',
} as const)

export type ComponentOrbitDirection =
  (typeof COMPONENT_ORBIT_DIRECTION)[keyof typeof COMPONENT_ORBIT_DIRECTION]

export interface ComponentOrbitGroupDefinition {
  readonly id: string
  readonly motionGroupId: number
  readonly topologyComponentId: string
  readonly revolutionDurationMs: number
  readonly postRevolutionPauseMs: number
  readonly direction: ComponentOrbitDirection
  readonly initialPhaseRadians: number
  readonly initialDelayMs: number
  readonly cadenceOffsetMs: number
  readonly centerOffsetX: number
  readonly centerOffsetY: number
  readonly axisRotationRadians: number
  readonly primaryRadiusWorldUnits: number
  readonly secondaryRadiusWorldUnits: number
  readonly behindDepthThreshold: number
  readonly frontDepthThreshold: number
  readonly depthBandHysteresis: number
}

export interface ComponentOrbitBodyMotionDefinition {
  readonly behaviorId: 'COMPONENT_ORBIT'
  readonly maximumOffset: number
  readonly groupBySlotId: Readonly<Record<number, number>>
  readonly orbitGroups: readonly Readonly<ComponentOrbitGroupDefinition>[]
}

function requirePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`COMPONENT_ORBIT ${name} must be positive.`)
  }
}

function requireNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`COMPONENT_ORBIT ${name} must be non-negative.`)
  }
}

function validateOrbitGroup(profile: Readonly<ComponentOrbitGroupDefinition>): void {
  requirePositive(profile.revolutionDurationMs, 'revolutionDurationMs')
  requirePositive(profile.primaryRadiusWorldUnits, 'primaryRadiusWorldUnits')
  requirePositive(profile.secondaryRadiusWorldUnits, 'secondaryRadiusWorldUnits')
  requireNonNegative(profile.postRevolutionPauseMs, 'postRevolutionPauseMs')
  requireNonNegative(profile.initialDelayMs, 'initialDelayMs')
  requireNonNegative(profile.cadenceOffsetMs, 'cadenceOffsetMs')
  if (
    profile.direction !== COMPONENT_ORBIT_DIRECTION.CLOCKWISE &&
    profile.direction !== COMPONENT_ORBIT_DIRECTION.COUNTERCLOCKWISE
  ) {
    throw new Error('COMPONENT_ORBIT direction is invalid.')
  }
  if (
    !Number.isFinite(profile.behindDepthThreshold) ||
    !Number.isFinite(profile.frontDepthThreshold) ||
    profile.behindDepthThreshold >= profile.frontDepthThreshold ||
    !Number.isFinite(profile.depthBandHysteresis) ||
    profile.depthBandHysteresis < 0 ||
    profile.depthBandHysteresis * 2 >=
      profile.frontDepthThreshold - profile.behindDepthThreshold
  ) {
    throw new RangeError('COMPONENT_ORBIT depth thresholds are invalid.')
  }
  for (const value of [
    profile.initialPhaseRadians,
    profile.centerOffsetX,
    profile.centerOffsetY,
    profile.axisRotationRadians,
  ]) {
    if (!Number.isFinite(value)) {
      throw new RangeError('COMPONENT_ORBIT geometry must be finite.')
    }
  }
}

export function prepareComponentOrbitGroups(
  input: ComponentOrbitBodyMotionDefinition,
  groupBySlotId: Readonly<Record<number, number>>,
  topologyComponentBySlotId: Readonly<Record<number, string>>,
): readonly Readonly<ComponentOrbitGroupDefinition>[] {
  if (input.orbitGroups.length === 0) {
    throw new Error('COMPONENT_ORBIT requires at least one orbit group.')
  }
  const orbitGroupIds = new Set<number>()
  const orbitProfileIds = new Set<string>()
  for (const profile of input.orbitGroups) {
    if (profile.id.trim().length === 0 || orbitProfileIds.has(profile.id)) {
      throw new Error('COMPONENT_ORBIT profile IDs must be unique and non-empty.')
    }
    orbitProfileIds.add(profile.id)
    if (
      !Number.isSafeInteger(profile.motionGroupId) ||
      profile.motionGroupId <= 0 ||
      orbitGroupIds.has(profile.motionGroupId)
    ) {
      throw new Error(
        'COMPONENT_ORBIT motionGroupId must be a unique positive safe integer.',
      )
    }
    orbitGroupIds.add(profile.motionGroupId)
    validateOrbitGroup(profile)
  }

  const mappedGroupIds = new Set(Object.values(groupBySlotId))
  if (!mappedGroupIds.has(0)) {
    throw new Error('COMPONENT_ORBIT requires a stationary group zero.')
  }
  for (const groupId of mappedGroupIds) {
    if (groupId !== 0 && !orbitGroupIds.has(groupId)) {
      throw new Error(`COMPONENT_ORBIT has no profile for motion group ${groupId}.`)
    }
  }
  for (const profile of input.orbitGroups) {
    if (!mappedGroupIds.has(profile.motionGroupId)) {
      throw new Error(
        `COMPONENT_ORBIT profile ${profile.id} has no mapped body slots.`,
      )
    }
    for (const [slotIdText, groupId] of Object.entries(groupBySlotId)) {
      const slotId = Number(slotIdText)
      if (
        groupId === profile.motionGroupId &&
        topologyComponentBySlotId[slotId] !== profile.topologyComponentId
      ) {
        throw new Error(
          `COMPONENT_ORBIT profile ${profile.id} crosses topology components.`,
        )
      }
    }
  }
  return Object.freeze(
    input.orbitGroups.map((group) => Object.freeze({ ...group })),
  )
}

interface OrbitBodySlotGeometry {
  readonly slotId: number
  readonly localX: number
  readonly localY: number
  readonly collisionRadius: number
}

export function calculateComponentOrbitBroadPhaseRadius(
  slots: readonly Readonly<OrbitBodySlotGeometry>[],
  bodyMotion: ComponentOrbitBodyMotionDefinition,
  maximumMaterialOffset: number,
): number {
  const radiusByGroup = new Map<number, number>()
  for (const slot of slots) {
    const groupId = bodyMotion.groupBySlotId[slot.slotId]
    radiusByGroup.set(
      groupId,
      Math.max(
        radiusByGroup.get(groupId) ?? 0,
        Math.hypot(slot.localX, slot.localY) + slot.collisionRadius,
      ),
    )
  }
  let radius = radiusByGroup.get(0) ?? 0
  for (const profile of bodyMotion.orbitGroups) {
    radius = Math.max(
      radius,
      Math.hypot(profile.centerOffsetX, profile.centerOffsetY) +
        Math.max(
          profile.primaryRadiusWorldUnits,
          profile.secondaryRadiusWorldUnits,
        ) +
        (radiusByGroup.get(profile.motionGroupId) ?? 0),
    )
  }
  return radius + maximumMaterialOffset
}
