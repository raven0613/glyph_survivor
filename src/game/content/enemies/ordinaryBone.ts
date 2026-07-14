import {
  CREATURE_BODY_MOTION_BEHAVIOR,
  CREATURE_LAYOUT_BEHAVIOR,
  CREATURE_MOVEMENT_BEHAVIOR,
  CREATURE_SPLIT_BEHAVIOR,
  defineCreature,
  type CreatureDefinition,
} from '../creatures/creatureDefinition.ts'
import { defineGlyphBody, type GlyphBodyInput } from '../../glyph/glyphLayout.ts'
import { GLYPH_MATERIAL } from '../../glyph/glyphMaterial.ts'

const BONE_GLYPH_SPACING = 22
const BONE_GLYPH_COLLISION_RADIUS = 12
const BONE_GLYPH_SCALE = 0.72

export const ORDINARY_BONE_BODY_INPUT: GlyphBodyInput = Object.freeze({
  id: 'enemy.bone.body',
  expectedGlyphCount: 2,
  slots: Object.freeze(
    ['B', 'O'].map((character, slotId) =>
      Object.freeze({
        slotId,
        role: 'BODY' as const,
        character,
        topologyX: slotId,
        topologyY: 0,
        localX: (slotId - 0.5) * BONE_GLYPH_SPACING,
        localY: 0,
        maxDurability: 1,
        collisionRadius: BONE_GLYPH_COLLISION_RADIUS,
        scale: BONE_GLYPH_SCALE,
        material: GLYPH_MATERIAL.BASIC,
      }),
    ),
  ),
})

export function prepareOrdinaryBoneDefinition(): CreatureDefinition {
  return defineCreature({
    id: 'enemy.bone',
    category: 'ORDINARY',
    body: defineGlyphBody(ORDINARY_BONE_BODY_INPUT),
    maximumSpeed: 56,
    movementBehaviorId: CREATURE_MOVEMENT_BEHAVIOR.DIRECT_PURSUIT,
    movementResponsiveness: 0,
    layoutBehaviorId: CREATURE_LAYOUT_BEHAVIOR.STATIC,
    layoutCycleDurationMs: 0,
    authoredMorphStrength: 0,
    compiledMorphStrength: 0,
    bodyMotionBehaviorId: CREATURE_BODY_MOTION_BEHAVIOR.BONE_RATTLE,
    bodyMotionCycleDurationMs: 440,
    maximumBodyMotionOffset: 3,
    bodyMotionGroupBySlotId: Object.freeze({ 0: 0, 1: 1 }),
    splitBehaviorId: CREATURE_SPLIT_BEHAVIOR.NONE,
    minimumIndependentCellRatio: 0,
    contactDamage: 1,
    collapseDurationMs: 300,
    experienceReward: 1,
  })
}
