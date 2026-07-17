import { defineGlyphBody, type GlyphBodyInput } from '../../glyph/glyphLayout.ts'
import { GLYPH_MATERIAL } from '../../glyph/glyphMaterial.ts'
import {
  CREATURE_BODY_MOTION_BEHAVIOR,
  CREATURE_LAYOUT_BEHAVIOR,
  CREATURE_MOVEMENT_BEHAVIOR,
  CREATURE_SPLIT_BEHAVIOR,
  defineCreature,
  type CreatureDefinition,
} from '../creatures/creatureDefinition.ts'
import { GLYPH_APPEARANCE_PROFILE } from '../visuals/combatVisualTheme.ts'

const SNAKE_CHARACTERS = Object.freeze(['S', 'N', 'A', 'K', 'E'])
const SNAKE_GLYPH_SPACING = 20
const SNAKE_HEAD_LIFT = 5
const SNAKE_GLYPH_COLLISION_RADIUS = 11
const SNAKE_GLYPH_SCALE = 0.72
const SNAKE_BODY_LENGTH =
  (SNAKE_CHARACTERS.length - 1) * SNAKE_GLYPH_SPACING
const SNAKE_MAXIMUM_BODY_MOTION_OFFSET = SNAKE_BODY_LENGTH

export const ORDINARY_SNAKE_BODY_INPUT: GlyphBodyInput = Object.freeze({
  id: 'enemy.snake.body',
  expectedGlyphCount: SNAKE_CHARACTERS.length,
  slots: Object.freeze(
    SNAKE_CHARACTERS.map((character, slotId) =>
      Object.freeze({
        slotId,
        role: slotId === 0 ? ('HEAD' as const) : ('BODY' as const),
        character,
        topologyX: slotId,
        topologyY: 0,
        localX:
          (slotId - (SNAKE_CHARACTERS.length - 1) / 2) *
          SNAKE_GLYPH_SPACING,
        localY: slotId === 0 ? -SNAKE_HEAD_LIFT : 0,
        maxDurability: 1,
        collisionRadius: SNAKE_GLYPH_COLLISION_RADIUS,
        scale: SNAKE_GLYPH_SCALE,
        material: GLYPH_MATERIAL.BASIC,
      }),
    ),
  ),
})

export function prepareOrdinarySnakeDefinition(): CreatureDefinition {
  return defineCreature({
    id: 'enemy.snake',
    category: 'ORDINARY',
    appearanceProfileId: GLYPH_APPEARANCE_PROFILE.SNAKE,
    body: defineGlyphBody(ORDINARY_SNAKE_BODY_INPUT),
    maximumSpeed: 60,
    movementBehaviorId: CREATURE_MOVEMENT_BEHAVIOR.DIRECT_PURSUIT,
    movementResponsiveness: 0,
    layoutBehaviorId: CREATURE_LAYOUT_BEHAVIOR.STATIC,
    layoutCycleDurationMs: 0,
    authoredMorphStrength: 0,
    compiledMorphStrength: 0,
    bodyMotion: Object.freeze({
      behaviorId: CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE,
      cycleDurationMs: 720,
      turnDurationMs: 320,
      segmentLength: SNAKE_GLYPH_SPACING,
      maximumOffset: SNAKE_MAXIMUM_BODY_MOTION_OFFSET,
      groupBySlotId: Object.freeze({ 0: 0, 1: 0, 2: 0, 3: 1, 4: 2 }),
      horizontalDirectionDeadZoneRatio: 0.18,
      squeezeStartRatio: 0.28,
      squeezePeakRatio: 0.46,
      squeezeHoldEndRatio: 0.52,
      squeezeEndRatio: 0.78,
      snaCompressionDistance: 7,
      eCompressionDistance: 7,
      kLiftDistance: 11,
    }),
    splitBehaviorId: CREATURE_SPLIT_BEHAVIOR.NONE,
    minimumIndependentCellRatio: 0,
    contactDamage: 1,
    collapseDurationMs: 320,
    experienceReward: 2,
  })
}
