import {
  CREATURE_BODY_MOTION_BEHAVIOR,
  CREATURE_LAYOUT_BEHAVIOR,
  CREATURE_MOVEMENT_BEHAVIOR,
  CREATURE_SPLIT_BEHAVIOR,
  defineCreature,
  type CreatureDefinition,
} from '../creatures/creatureDefinition.ts'
import {
  defineGlyphBody,
  type GlyphBodyInput,
  type GlyphBodySlotInput,
  type GlyphPoseAnchorInput,
} from '../../glyph/glyphLayout.ts'
import { GLYPH_MATERIAL } from '../../glyph/glyphMaterial.ts'
import { GLYPH_APPEARANCE_PROFILE } from '../visuals/combatVisualTheme.ts'

const SLIME_MASK = Object.freeze([
  '    XXXXXX    ',
  '  XXXXXXXXXX  ',
  'XXXXoXXXXoXXXX',
  ' XXXXXXXXXXXX ',
  '   XXXXXXXX   ',
])
const SLIME_DURABILITY = Object.freeze([
  '    111111    ',
  '  1122222211  ',
  '11122222222111',
  ' 111222222111 ',
  '   11111111   ',
])
const SLIME_SEQUENCE = 'SLIME'
const SLIME_GRID_SPACING = 18
const SLIME_COLLISION_RADIUS = 8
const SLIME_GLYPH_SCALE = 0.58

function createNeutralSlots(): GlyphBodySlotInput[] {
  const slots: GlyphBodySlotInput[] = []

  for (let row = 0; row < SLIME_MASK.length; row += 1) {
    for (let column = 0; column < SLIME_MASK[row].length; column += 1) {
      const marker = SLIME_MASK[row][column]
      if (marker === ' ') {
        continue
      }

      const slotId = slots.length
      const isEye = marker === 'o'
      slots.push({
        slotId,
        role: isEye ? 'EYE' : 'BODY',
        character: isEye
          ? 'O'
          : SLIME_SEQUENCE[slotId % SLIME_SEQUENCE.length],
        baseCharacter: SLIME_SEQUENCE[slotId % SLIME_SEQUENCE.length],
        topologyX: column,
        topologyY: row,
        localX: (column - (SLIME_MASK[row].length - 1) / 2) * SLIME_GRID_SPACING,
        localY: (row - (SLIME_MASK.length - 1) / 2) * SLIME_GRID_SPACING,
        maxDurability: Number(SLIME_DURABILITY[row][column]),
        collisionRadius: SLIME_COLLISION_RADIUS,
        scale: SLIME_GLYPH_SCALE,
        material: GLYPH_MATERIAL.SLIME,
      })
    }
  }

  return slots
}

function createReflowPose(
  slots: readonly GlyphBodySlotInput[],
  rowCounts: readonly number[],
  eyeRow: number,
  eyeColumns: readonly [number, number],
): GlyphPoseAnchorInput[] {
  const positions = rowCounts.flatMap((columnCount, row) =>
    Array.from({ length: columnCount }, (_, column) => ({
      localX: (column - (columnCount - 1) / 2) * SLIME_GRID_SPACING,
      localY: (row - (rowCounts.length - 1) / 2) * SLIME_GRID_SPACING,
    })),
  )
  const rowOffset = rowCounts
    .slice(0, eyeRow)
    .reduce((total, count) => total + count, 0)
  const eyePositionIndexes = new Set(
    eyeColumns.map((column) => rowOffset + column),
  )
  const eyeSlots = slots.filter((slot) => slot.role === 'EYE')
  const bodySlots = slots.filter((slot) => slot.role !== 'EYE')
  let eyeIndex = 0
  let bodyIndex = 0

  return positions.map((position, positionIndex) => ({
    slotId: eyePositionIndexes.has(positionIndex)
      ? eyeSlots[eyeIndex++].slotId
      : bodySlots[bodyIndex++].slotId,
    ...position,
  }))
}

export function prepareSlimeBossDefinition(): CreatureDefinition {
  const slots = createNeutralSlots()
  const bodyInput: GlyphBodyInput = {
    id: 'boss.slime.prototype.body',
    expectedGlyphCount: 50,
    slots,
    poses: [
      {
        id: 'wide',
        anchors: createReflowPose(slots, [10, 14, 14, 12], 1, [4, 9]),
      },
      {
        id: 'tall',
        anchors: createReflowPose(slots, [4, 6, 8, 10, 10, 8, 4], 2, [2, 5]),
      },
    ],
  }

  return defineCreature({
    id: 'boss.slime.prototype',
    category: 'BOSS',
    appearanceProfileId: GLYPH_APPEARANCE_PROFILE.SLIME_BOSS,
    body: defineGlyphBody(bodyInput),
    maximumSpeed: 60,
    movementBehaviorId: CREATURE_MOVEMENT_BEHAVIOR.DAMPED_PURSUIT,
    movementResponsiveness: 4,
    layoutBehaviorId: CREATURE_LAYOUT_BEHAVIOR.SLIME_MORPH,
    layoutCycleDurationMs: 2_400,
    authoredMorphStrength: 0.75,
    compiledMorphStrength: 1.4,
    bodyMotion: Object.freeze({
      behaviorId: CREATURE_BODY_MOTION_BEHAVIOR.NONE,
      cycleDurationMs: 0,
      maximumOffset: 0,
      groupBySlotId: Object.freeze({}),
    }),
    splitBehaviorId: CREATURE_SPLIT_BEHAVIOR.SLIME_TOPOLOGY,
    minimumIndependentCellRatio: 0.3,
    contactDamage: 1,
    collapseDurationMs: 500,
    experienceReward: 1,
  })
}
