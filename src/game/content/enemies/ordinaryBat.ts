import {
  CREATURE_LAYOUT_BEHAVIOR,
  CREATURE_MOVEMENT_BEHAVIOR,
  CREATURE_SPLIT_BEHAVIOR,
  defineCreature,
  type CreatureDefinition,
} from '../creatures/creatureDefinition.ts'
import { defineGlyphBody, type GlyphBodyInput } from '../../glyph/glyphLayout.ts'
import { GLYPH_MATERIAL } from '../../glyph/glyphMaterial.ts'

const BAT_GLYPH_SPACING = 24
const BAT_GLYPH_COLLISION_RADIUS = 12
const BAT_GLYPH_SCALE = 0.72

export const ORDINARY_BAT_BODY_INPUT: GlyphBodyInput = Object.freeze({
  id: 'enemy.bat.body',
  expectedGlyphCount: 3,
  slots: Object.freeze(
    ['B', 'A', 'T'].map((character, slotId) =>
      Object.freeze({
        slotId,
        role: 'BODY' as const,
        character,
        topologyX: slotId,
        topologyY: 0,
        localX: (slotId - 1) * BAT_GLYPH_SPACING,
        localY: 0,
        maxDurability: 1,
        collisionRadius: BAT_GLYPH_COLLISION_RADIUS,
        scale: BAT_GLYPH_SCALE,
        material: GLYPH_MATERIAL.BASIC,
      }),
    ),
  ),
})

export function prepareOrdinaryBatDefinition(): CreatureDefinition {
  return defineCreature({
    id: 'enemy.bat',
    category: 'ORDINARY',
    body: defineGlyphBody(ORDINARY_BAT_BODY_INPUT),
    maximumSpeed: 72,
    movementBehaviorId: CREATURE_MOVEMENT_BEHAVIOR.DIRECT_PURSUIT,
    movementResponsiveness: 0,
    layoutBehaviorId: CREATURE_LAYOUT_BEHAVIOR.STATIC,
    layoutCycleDurationMs: 0,
    authoredMorphStrength: 0,
    compiledMorphStrength: 0,
    splitBehaviorId: CREATURE_SPLIT_BEHAVIOR.NONE,
    minimumIndependentCellRatio: 0,
    contactDamage: 1,
    collapseDurationMs: 300,
  })
}
