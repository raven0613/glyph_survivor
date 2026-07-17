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
import { GLYPH_APPEARANCE_PROFILE } from '../visuals/combatVisualTheme.ts'

const ROCK_GLYPH_SPACING = 22
const ROCK_GLYPH_COLLISION_RADIUS = 12
const ROCK_GLYPH_SCALE = 0.72
const ROCK_MAXIMUM_BODY_MOTION_OFFSET = ROCK_GLYPH_SPACING * Math.SQRT2

const ROCK_SLOTS = Object.freeze([
  Object.freeze({ character: 'R', topologyX: 0, topologyY: 0 }),
  Object.freeze({ character: 'O', topologyX: 1, topologyY: 0 }),
  Object.freeze({ character: 'C', topologyX: 0, topologyY: 1 }),
  Object.freeze({ character: 'K', topologyX: 1, topologyY: 1 }),
])

export const ORDINARY_ROCK_BODY_INPUT: GlyphBodyInput = Object.freeze({
  id: 'enemy.rock.body',
  expectedGlyphCount: ROCK_SLOTS.length,
  slots: Object.freeze(
    ROCK_SLOTS.map((slot, slotId) =>
      Object.freeze({
        slotId,
        role: 'BODY' as const,
        character: slot.character,
        topologyX: slot.topologyX,
        topologyY: slot.topologyY,
        localX: (slot.topologyX - 0.5) * ROCK_GLYPH_SPACING,
        localY: (slot.topologyY - 0.5) * ROCK_GLYPH_SPACING,
        maxDurability: 2,
        collisionRadius: ROCK_GLYPH_COLLISION_RADIUS,
        scale: ROCK_GLYPH_SCALE,
        material: GLYPH_MATERIAL.ROCK,
      }),
    ),
  ),
})

export function prepareOrdinaryRockDefinition(): CreatureDefinition {
  return defineCreature({
    id: 'enemy.rock',
    category: 'ORDINARY',
    appearanceProfileId: GLYPH_APPEARANCE_PROFILE.ROCK,
    body: defineGlyphBody(ORDINARY_ROCK_BODY_INPUT),
    maximumSpeed: 32,
    movementBehaviorId: CREATURE_MOVEMENT_BEHAVIOR.DIRECT_PURSUIT,
    movementResponsiveness: 0,
    layoutBehaviorId: CREATURE_LAYOUT_BEHAVIOR.STATIC,
    layoutCycleDurationMs: 0,
    authoredMorphStrength: 0,
    compiledMorphStrength: 0,
    bodyMotion: Object.freeze({
      behaviorId: CREATURE_BODY_MOTION_BEHAVIOR.ROCK_ROLL,
      fullRollDurationMs: 900,
      maximumOffset: ROCK_MAXIMUM_BODY_MOTION_OFFSET,
      groupBySlotId: Object.freeze({ 0: 0, 1: 0, 2: 0, 3: 0 }),
      horizontalDirectionDeadZoneRatio: 0.18,
      poseHoldDurationMs: 600,
      settleSpeedMultiplier: 1.4,
    }),
    splitBehaviorId: CREATURE_SPLIT_BEHAVIOR.NONE,
    minimumIndependentCellRatio: 0,
    contactDamage: 1,
    collapseDurationMs: 360,
    experienceReward: 2,
  })
}
