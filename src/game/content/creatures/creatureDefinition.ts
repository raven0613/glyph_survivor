import type { GlyphBodyDefinition } from '../../glyph/glyphLayout.ts'
import { getGlyphMaterialDefinition } from '../../glyph/glyphMaterial.ts'

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

export type CreatureCategory = 'ORDINARY' | 'BOSS'

export interface CreatureDefinitionInput {
  readonly id: string
  readonly category: CreatureCategory
  readonly body: GlyphBodyDefinition
  readonly maximumSpeed: number
  readonly movementBehaviorId: CreatureMovementBehaviorId
  readonly movementResponsiveness: number
  readonly layoutBehaviorId: CreatureLayoutBehaviorId
  readonly layoutCycleDurationMs: number
  readonly contactDamage: number
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
  if (!Number.isFinite(input.contactDamage) || input.contactDamage < 0) {
    throw new RangeError('contactDamage must be finite and non-negative.')
  }

  const maximumMaterialOffset = input.body.slots.reduce(
    (maximumOffset, slot) =>
      Math.max(
        maximumOffset,
        getGlyphMaterialDefinition(slot.material).maximumOffset,
      ),
    0,
  )

  return Object.freeze({
    ...input,
    broadPhaseRadius: input.body.broadPhaseRadius + maximumMaterialOffset,
  })
}
