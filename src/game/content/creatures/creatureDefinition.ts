import type { GlyphBodyDefinition } from '../../glyph/glyphLayout.ts'
import { getGlyphMaterialDefinition } from '../../glyph/glyphMaterial.ts'
import {
  isGlyphAppearanceProfileId,
  type GlyphAppearanceProfileId,
} from '../visuals/combatVisualTheme.ts'

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
  ZOMBIE_STAGGER: 'ZOMBIE_STAGGER',
} as const)

export type CreatureBodyMotionBehaviorId =
  (typeof CREATURE_BODY_MOTION_BEHAVIOR)[keyof typeof CREATURE_BODY_MOTION_BEHAVIOR]

export const CREATURE_SPLIT_BEHAVIOR = Object.freeze({
  NONE: 'NONE',
  SLIME_TOPOLOGY: 'SLIME_TOPOLOGY',
} as const)

export type CreatureSplitBehaviorId =
  (typeof CREATURE_SPLIT_BEHAVIOR)[keyof typeof CREATURE_SPLIT_BEHAVIOR]

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
  readonly bodyMotionBehaviorId: CreatureBodyMotionBehaviorId
  readonly bodyMotionCycleDurationMs: number
  readonly maximumBodyMotionOffset: number
  readonly bodyMotionGroupBySlotId: Readonly<Record<number, number>>
  readonly splitBehaviorId: CreatureSplitBehaviorId
  readonly minimumIndependentCellRatio: number
  readonly contactDamage: number
  readonly collapseDurationMs: number
  readonly experienceReward: number
}

export type CreatureDefinition = Readonly<CreatureDefinitionInput> & {
  readonly broadPhaseRadius: number
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
  if (
    !Number.isFinite(input.bodyMotionCycleDurationMs) ||
    input.bodyMotionCycleDurationMs < 0
  ) {
    throw new RangeError(
      'bodyMotionCycleDurationMs must be finite and non-negative.',
    )
  }
  if (
    !Number.isFinite(input.maximumBodyMotionOffset) ||
    input.maximumBodyMotionOffset < 0
  ) {
    throw new RangeError(
      'maximumBodyMotionOffset must be finite and non-negative.',
    )
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
  const bodyMotionGroupBySlotId: Record<number, number> = {}
  for (const [slotIdText, groupId] of Object.entries(
    input.bodyMotionGroupBySlotId,
  )) {
    const slotId = Number(slotIdText)
    if (!bodySlotIds.has(slotId)) {
      throw new Error(`Body Motion references unknown slotId ${slotIdText}.`)
    }
    if (!Number.isSafeInteger(groupId) || groupId < 0) {
      throw new RangeError(
        `Body Motion group for slotId ${slotIdText} must be a non-negative safe integer.`,
      )
    }
    bodyMotionGroupBySlotId[slotId] = groupId
  }
  if (
    input.bodyMotionBehaviorId !== CREATURE_BODY_MOTION_BEHAVIOR.NONE &&
    Object.keys(bodyMotionGroupBySlotId).length !== input.body.slots.length
  ) {
    throw new Error('Animated creatures must map every body slot to a motion group.')
  }

  return Object.freeze({
    ...input,
    bodyMotionGroupBySlotId: Object.freeze(bodyMotionGroupBySlotId),
    broadPhaseRadius:
      input.body.broadPhaseRadius +
      maximumMaterialOffset +
      input.maximumBodyMotionOffset,
  })
}
