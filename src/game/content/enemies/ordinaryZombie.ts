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

const ZOMBIE_GLYPH_COLLISION_RADIUS = 12
const ZOMBIE_GLYPH_SCALE = 0.76

export const ORDINARY_ZOMBIE_BODY_INPUT: GlyphBodyInput = Object.freeze({
  id: 'enemy.zombie.body',
  expectedGlyphCount: 1,
  slots: Object.freeze([
    Object.freeze({
      slotId: 0,
      role: 'BODY' as const,
      character: 'Z',
      topologyX: 0,
      topologyY: 0,
      localX: 0,
      localY: 0,
      maxDurability: 1,
      collisionRadius: ZOMBIE_GLYPH_COLLISION_RADIUS,
      scale: ZOMBIE_GLYPH_SCALE,
      material: GLYPH_MATERIAL.BASIC,
    }),
  ]),
})

export function prepareOrdinaryZombieDefinition(): CreatureDefinition {
  return defineCreature({
    id: 'enemy.zombie',
    category: 'ORDINARY',
    body: defineGlyphBody(ORDINARY_ZOMBIE_BODY_INPUT),
    maximumSpeed: 40,
    movementBehaviorId: CREATURE_MOVEMENT_BEHAVIOR.DIRECT_PURSUIT,
    movementResponsiveness: 0,
    layoutBehaviorId: CREATURE_LAYOUT_BEHAVIOR.STATIC,
    layoutCycleDurationMs: 0,
    authoredMorphStrength: 0,
    compiledMorphStrength: 0,
    bodyMotionBehaviorId: CREATURE_BODY_MOTION_BEHAVIOR.ZOMBIE_STAGGER,
    bodyMotionCycleDurationMs: 620,
    maximumBodyMotionOffset: 2,
    bodyMotionGroupBySlotId: Object.freeze({ 0: 0 }),
    splitBehaviorId: CREATURE_SPLIT_BEHAVIOR.NONE,
    minimumIndependentCellRatio: 0,
    contactDamage: 1,
    collapseDurationMs: 300,
    experienceReward: 1,
  })
}
