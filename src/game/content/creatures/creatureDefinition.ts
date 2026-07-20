import type { GlyphBodyDefinition } from '../../glyph/glyphLayout.ts'
import { getGlyphMaterialDefinition } from '../../glyph/glyphMaterial.ts'
import {
  isGlyphAppearanceProfileId,
  type GlyphAppearanceProfileId,
} from '../visuals/combatVisualTheme.ts'
import {
  calculateComponentOrbitBroadPhaseRadius,
  prepareComponentOrbitGroups,
  type ComponentOrbitBodyMotionDefinition,
} from './componentOrbitDefinition.ts'
import {
  DAMAGE_TOPOLOGY_TRAVERSAL_SCOPE,
  type DamageTopologyTraversalScope,
} from '../../glyph/localDamage.ts'

export {
  COMPONENT_ORBIT_DIRECTION,
  type ComponentOrbitBodyMotionDefinition,
  type ComponentOrbitDirection,
  type ComponentOrbitGroupDefinition,
} from './componentOrbitDefinition.ts'

export const CREATURE_MOVEMENT_BEHAVIOR = Object.freeze({
  DIRECT_PURSUIT: 'DIRECT_PURSUIT',
  DAMPED_PURSUIT: 'DAMPED_PURSUIT',
} as const)

export type CreatureMovementBehaviorId =
  (typeof CREATURE_MOVEMENT_BEHAVIOR)[keyof typeof CREATURE_MOVEMENT_BEHAVIOR]

export const CREATURE_LAYOUT_BEHAVIOR = Object.freeze({
  STATIC: 'STATIC',
  SLIME_MORPH: 'SLIME_MORPH',
} as const)

export type CreatureLayoutBehaviorId =
  (typeof CREATURE_LAYOUT_BEHAVIOR)[keyof typeof CREATURE_LAYOUT_BEHAVIOR]

export const CREATURE_BODY_MOTION_BEHAVIOR = Object.freeze({
  NONE: 'NONE',
  BAT_FLAP: 'BAT_FLAP',
  BONE_RATTLE: 'BONE_RATTLE',
  COMPONENT_ORBIT: 'COMPONENT_ORBIT',
  ROCK_ROLL: 'ROCK_ROLL',
  SNAKE_SQUEEZE: 'SNAKE_SQUEEZE',
  ZOMBIE_STAGGER: 'ZOMBIE_STAGGER',
} as const)

export type CreatureBodyMotionBehaviorId =
  (typeof CREATURE_BODY_MOTION_BEHAVIOR)[keyof typeof CREATURE_BODY_MOTION_BEHAVIOR]

interface CreatureBodyMotionDefinitionBase {
  readonly maximumOffset: number
  readonly groupBySlotId: Readonly<Record<number, number>>
}

export interface NoCreatureBodyMotionDefinition
  extends CreatureBodyMotionDefinitionBase {
  readonly behaviorId: typeof CREATURE_BODY_MOTION_BEHAVIOR.NONE
  readonly cycleDurationMs: 0
}

export interface TimedCreatureBodyMotionDefinition
  extends CreatureBodyMotionDefinitionBase {
  readonly behaviorId:
    | typeof CREATURE_BODY_MOTION_BEHAVIOR.BAT_FLAP
    | typeof CREATURE_BODY_MOTION_BEHAVIOR.BONE_RATTLE
    | typeof CREATURE_BODY_MOTION_BEHAVIOR.ZOMBIE_STAGGER
  readonly cycleDurationMs: number
}

export interface RockRollBodyMotionDefinition
  extends CreatureBodyMotionDefinitionBase {
  readonly behaviorId: typeof CREATURE_BODY_MOTION_BEHAVIOR.ROCK_ROLL
  readonly fullRollDurationMs: number
  readonly horizontalDirectionDeadZoneRatio: number
  readonly poseHoldDurationMs: number
  readonly settleSpeedMultiplier: number
}

export interface SnakeSqueezeBodyMotionDefinition
  extends CreatureBodyMotionDefinitionBase {
  readonly behaviorId: typeof CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE
  readonly cycleDurationMs: number
  readonly turnDurationMs: number
  readonly segmentLength: number
  readonly horizontalDirectionDeadZoneRatio: number
  readonly squeezeStartRatio: number
  readonly squeezePeakRatio: number
  readonly squeezeHoldEndRatio: number
  readonly squeezeEndRatio: number
  readonly snaCompressionDistance: number
  readonly eCompressionDistance: number
  readonly kLiftDistance: number
}

export type CreatureBodyMotionDefinition =
  | NoCreatureBodyMotionDefinition
  | TimedCreatureBodyMotionDefinition
  | ComponentOrbitBodyMotionDefinition
  | RockRollBodyMotionDefinition
  | SnakeSqueezeBodyMotionDefinition

export interface CreatureTargetAnchorDefinition {
  readonly id: string
  readonly motionGroupId: number
  readonly localX: number
  readonly localY: number
}

export const CREATURE_SPLIT_BEHAVIOR = Object.freeze({
  NONE: 'NONE',
  SLIME_TOPOLOGY: 'SLIME_TOPOLOGY',
} as const)

export type CreatureSplitBehaviorId =
  (typeof CREATURE_SPLIT_BEHAVIOR)[keyof typeof CREATURE_SPLIT_BEHAVIOR]

export const CREATURE_COLLAPSE_BEHAVIOR = Object.freeze({
  SCATTER: 'SCATTER',
  RHOMBUS_MASONRY: 'RHOMBUS_MASONRY',
} as const)

export type CreatureCollapseBehaviorId =
  (typeof CREATURE_COLLAPSE_BEHAVIOR)[keyof typeof CREATURE_COLLAPSE_BEHAVIOR]

export type CreatureCategory = 'ORDINARY' | 'BOSS'

export interface CreatureDefinitionInput {
  readonly id: string
  readonly category: CreatureCategory
  readonly appearanceProfileId: GlyphAppearanceProfileId
  readonly body: GlyphBodyDefinition
  readonly maximumSpeed: number
  readonly movementBehaviorId: CreatureMovementBehaviorId
  readonly movementResponsiveness: number
  readonly layoutBehaviorId: CreatureLayoutBehaviorId
  readonly layoutCycleDurationMs: number
  readonly authoredMorphStrength: number
  readonly compiledMorphStrength: number
  readonly bodyMotion: CreatureBodyMotionDefinition
  readonly targetAnchors?: readonly Readonly<CreatureTargetAnchorDefinition>[]
  readonly damageTopologyTraversalScope?: DamageTopologyTraversalScope
  readonly splitBehaviorId: CreatureSplitBehaviorId
  readonly collapseBehaviorId?: CreatureCollapseBehaviorId
  readonly minimumIndependentCellRatio: number
  readonly contactDamage: number
  readonly collapseDurationMs: number
  readonly experienceReward: number
}

export type CreatureDefinition = Omit<
  Readonly<CreatureDefinitionInput>,
  'targetAnchors' | 'damageTopologyTraversalScope' | 'collapseBehaviorId'
> & {
  readonly targetAnchors: readonly Readonly<CreatureTargetAnchorDefinition>[]
  readonly damageTopologyTraversalScope: DamageTopologyTraversalScope
  readonly collapseBehaviorId: CreatureCollapseBehaviorId
  readonly broadPhaseRadius: number
}

function requireFiniteRange(
  value: number,
  minimum: number,
  maximum: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${name} must be finite and between ${minimum} and ${maximum}.`,
    )
  }
}

function prepareBodyMotionDefinition(
  input: CreatureBodyMotionDefinition,
  bodySlotIds: ReadonlySet<number>,
  topologyComponentBySlotId: Readonly<Record<number, string>>,
): CreatureBodyMotionDefinition {
  if (!Number.isFinite(input.maximumOffset) || input.maximumOffset < 0) {
    throw new RangeError(
      'Body Motion maximumOffset must be finite and non-negative.',
    )
  }

  const groupBySlotId: Record<number, number> = {}
  for (const [slotIdText, groupId] of Object.entries(input.groupBySlotId)) {
    const slotId = Number(slotIdText)
    if (!bodySlotIds.has(slotId)) {
      throw new Error(`Body Motion references unknown slotId ${slotIdText}.`)
    }
    if (!Number.isSafeInteger(groupId) || groupId < 0) {
      throw new RangeError(
        `Body Motion group for slotId ${slotIdText} must be a non-negative safe integer.`,
      )
    }
    groupBySlotId[slotId] = groupId
  }

  if (input.behaviorId === CREATURE_BODY_MOTION_BEHAVIOR.NONE) {
    if (
      input.cycleDurationMs !== 0 ||
      input.maximumOffset !== 0 ||
      Object.keys(groupBySlotId).length !== 0
    ) {
      throw new Error('NONE Body Motion must not carry timing, offset, or groups.')
    }
  } else {
    if (Object.keys(groupBySlotId).length !== bodySlotIds.size) {
      throw new Error('Animated creatures must map every body slot to a motion group.')
    }
  }

  if (input.behaviorId === CREATURE_BODY_MOTION_BEHAVIOR.COMPONENT_ORBIT) {
    return Object.freeze({
      ...input,
      groupBySlotId: Object.freeze(groupBySlotId),
      orbitGroups: prepareComponentOrbitGroups(
        input,
        groupBySlotId,
        topologyComponentBySlotId,
      ),
    })
  }

  if (input.behaviorId === CREATURE_BODY_MOTION_BEHAVIOR.ROCK_ROLL) {
    if (
      !Number.isFinite(input.fullRollDurationMs) ||
      input.fullRollDurationMs <= 0
    ) {
      throw new RangeError('ROCK fullRollDurationMs must be positive.')
    }
    requireFiniteRange(
      input.horizontalDirectionDeadZoneRatio,
      0,
      0.99,
      'ROCK horizontalDirectionDeadZoneRatio',
    )
    if (
      !Number.isFinite(input.poseHoldDurationMs) ||
      input.poseHoldDurationMs < 0
    ) {
      throw new RangeError(
        'ROCK poseHoldDurationMs must be finite and non-negative.',
      )
    }
    if (
      !Number.isFinite(input.settleSpeedMultiplier) ||
      input.settleSpeedMultiplier <= 0
    ) {
      throw new RangeError('ROCK settleSpeedMultiplier must be positive.')
    }
  } else if (
    input.behaviorId === CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE
  ) {
    if (!Number.isFinite(input.cycleDurationMs) || input.cycleDurationMs <= 0) {
      throw new RangeError('SNAKE cycleDurationMs must be positive.')
    }
    if (!Number.isFinite(input.turnDurationMs) || input.turnDurationMs <= 0) {
      throw new RangeError('SNAKE turnDurationMs must be positive.')
    }
    if (!Number.isFinite(input.segmentLength) || input.segmentLength <= 0) {
      throw new RangeError('SNAKE segmentLength must be positive.')
    }
    requireFiniteRange(
      input.horizontalDirectionDeadZoneRatio,
      0,
      0.99,
      'SNAKE horizontalDirectionDeadZoneRatio',
    )
    if (
      !(
        input.squeezeStartRatio >= 0 &&
        input.squeezeStartRatio < input.squeezePeakRatio &&
        input.squeezePeakRatio < input.squeezeHoldEndRatio &&
        input.squeezeHoldEndRatio < input.squeezeEndRatio &&
        input.squeezeEndRatio <= 1
      )
    ) {
      throw new RangeError(
        'SNAKE squeeze ratios must preserve start < peak < hold end < end.',
      )
    }
    for (const [name, distance] of [
      ['snaCompressionDistance', input.snaCompressionDistance],
      ['eCompressionDistance', input.eCompressionDistance],
    ] as const) {
      if (
        !Number.isFinite(distance) ||
        distance <= 0 ||
        distance >= input.segmentLength
      ) {
        throw new RangeError(
          'SNAKE ' +
            name +
            ' must be less than segmentLength and greater than zero.',
        )
      }
    }
    const orderedSlotIds = [...bodySlotIds].sort((left, right) => left - right)
    const expectedGroupIds = [0, 0, 0, 1, 2] as const
    if (orderedSlotIds.length !== expectedGroupIds.length) {
      throw new Error('SNAKE squeeze motion requires exactly five body slots.')
    }
    for (let index = 0; index < orderedSlotIds.length; index += 1) {
      if (groupBySlotId[orderedSlotIds[index]] !== expectedGroupIds[index]) {
        throw new Error(
          'SNAKE motion groups must map stable SNA, K, and E roles.',
        )
      }
    }
    requireFiniteRange(
      input.kLiftDistance,
      Number.EPSILON,
      input.maximumOffset,
      'SNAKE kLiftDistance',
    )
  } else if (
    !Number.isFinite(input.cycleDurationMs) ||
    input.cycleDurationMs < 0
  ) {
    throw new RangeError(
      'Body Motion cycleDurationMs must be finite and non-negative.',
    )
  } else if (
    input.behaviorId !== CREATURE_BODY_MOTION_BEHAVIOR.NONE &&
    input.cycleDurationMs === 0
  ) {
    throw new RangeError('Animated Body Motion cycleDurationMs must be positive.')
  }

  return Object.freeze({
    ...input,
    groupBySlotId: Object.freeze(groupBySlotId),
  })
}

function prepareTargetAnchors(
  anchors: readonly Readonly<CreatureTargetAnchorDefinition>[],
  bodyMotion: CreatureBodyMotionDefinition,
): readonly Readonly<CreatureTargetAnchorDefinition>[] {
  const validGroupIds = new Set(Object.values(bodyMotion.groupBySlotId))
  if (bodyMotion.behaviorId === CREATURE_BODY_MOTION_BEHAVIOR.NONE) {
    validGroupIds.add(0)
  }
  const ids = new Set<string>()
  return Object.freeze(
    anchors.map((anchor) => {
      if (anchor.id.trim().length === 0 || ids.has(anchor.id)) {
        throw new Error('Creature target anchor IDs must be unique and non-empty.')
      }
      ids.add(anchor.id)
      if (!validGroupIds.has(anchor.motionGroupId)) {
        throw new Error(`Target anchor ${anchor.id} references an unknown motion group.`)
      }
      if (!Number.isFinite(anchor.localX) || !Number.isFinite(anchor.localY)) {
        throw new RangeError(`Target anchor ${anchor.id} position must be finite.`)
      }
      return Object.freeze({ ...anchor })
    }),
  )
}

export function defineCreature(
  input: CreatureDefinitionInput,
): CreatureDefinition {
  if (input.id.trim().length === 0) {
    throw new TypeError('Creature definition id must not be empty.')
  }
  if (!isGlyphAppearanceProfileId(input.appearanceProfileId)) {
    throw new TypeError('Creature appearanceProfileId must be registered.')
  }
  if (!Number.isFinite(input.maximumSpeed) || input.maximumSpeed < 0) {
    throw new RangeError('maximumSpeed must be finite and non-negative.')
  }
  if (
    !Number.isFinite(input.movementResponsiveness) ||
    input.movementResponsiveness < 0
  ) {
    throw new RangeError(
      'movementResponsiveness must be finite and non-negative.',
    )
  }
  if (
    !Number.isFinite(input.layoutCycleDurationMs) ||
    input.layoutCycleDurationMs < 0
  ) {
    throw new RangeError('layoutCycleDurationMs must be finite and non-negative.')
  }
  for (const [name, strength] of [
    ['authoredMorphStrength', input.authoredMorphStrength],
    ['compiledMorphStrength', input.compiledMorphStrength],
  ] as const) {
    if (!Number.isFinite(strength) || strength < 0 || strength > 2) {
      throw new RangeError(`${name} must be finite and between zero and two.`)
    }
  }
  if (!Number.isFinite(input.contactDamage) || input.contactDamage < 0) {
    throw new RangeError('contactDamage must be finite and non-negative.')
  }
  if (
    !Number.isFinite(input.collapseDurationMs) ||
    input.collapseDurationMs <= 0
  ) {
    throw new RangeError('collapseDurationMs must be finite and greater than zero.')
  }
  if (!Number.isFinite(input.experienceReward) || input.experienceReward < 0) {
    throw new RangeError('experienceReward must be finite and non-negative.')
  }
  if (
    !Number.isFinite(input.minimumIndependentCellRatio) ||
    input.minimumIndependentCellRatio < 0 ||
    input.minimumIndependentCellRatio > 1
  ) {
    throw new RangeError(
      'minimumIndependentCellRatio must be finite and between zero and one.',
    )
  }

  const maximumMaterialOffset = input.body.slots.reduce(
    (maximumOffset, slot) =>
      Math.max(
        maximumOffset,
        getGlyphMaterialDefinition(slot.material).maximumOffset,
      ),
    0,
  )
  const bodySlotIds = new Set(input.body.slots.map((slot) => slot.slotId))
  const topologyComponentBySlotId = Object.freeze(
    Object.fromEntries(
      input.body.slots.map((slot) => [slot.slotId, slot.topologyComponentId]),
    ) as Record<number, string>,
  )
  const bodyMotion = prepareBodyMotionDefinition(
    input.bodyMotion,
    bodySlotIds,
    topologyComponentBySlotId,
  )
  const targetAnchors = prepareTargetAnchors(input.targetAnchors ?? [], bodyMotion)
  const damageTopologyTraversalScope =
    input.damageTopologyTraversalScope ??
    DAMAGE_TOPOLOGY_TRAVERSAL_SCOPE.CANONICAL_COMPONENT
  if (
    damageTopologyTraversalScope !==
    DAMAGE_TOPOLOGY_TRAVERSAL_SCOPE.CANONICAL_COMPONENT
  ) {
    throw new TypeError('Creature damage topology traversal scope is invalid.')
  }
  const collapseBehaviorId =
    input.collapseBehaviorId ?? CREATURE_COLLAPSE_BEHAVIOR.SCATTER
  if (!Object.values(CREATURE_COLLAPSE_BEHAVIOR).includes(collapseBehaviorId)) {
    throw new TypeError('Creature collapseBehaviorId is invalid.')
  }

  return Object.freeze({
    ...input,
    bodyMotion,
    targetAnchors,
    damageTopologyTraversalScope,
    collapseBehaviorId,
    broadPhaseRadius:
      bodyMotion.behaviorId === CREATURE_BODY_MOTION_BEHAVIOR.COMPONENT_ORBIT
        ? calculateComponentOrbitBroadPhaseRadius(
            input.body.slots,
            bodyMotion,
            maximumMaterialOffset,
          )
        : input.body.broadPhaseRadius +
          maximumMaterialOffset +
          bodyMotion.maximumOffset,
  })
}
