import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CREATURE_BODY_MOTION_BEHAVIOR,
} from '../../src/game/content/creatures/creatureDefinition.ts'
import {
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import {
  defineOrdinaryEnemyProgression,
  selectOrdinaryEnemyDefinition,
} from '../../src/game/content/enemies/ordinaryEnemyProgression.ts'
import { GLYPH_APPEARANCE_PROFILE } from '../../src/game/content/visuals/combatVisualTheme.ts'

test('compiles Z, BO, and BAT as ordered ordinary enemy definitions', () => {
  const content = prepareGameContent()

  assert.deepEqual(
    content.ordinaryEnemyDefinitions.map((definition) => definition.id),
    ['enemy.zombie', 'enemy.bone', 'enemy.bat'],
  )
  assert.deepEqual(
    content.ordinaryEnemyDefinitions.map((definition) =>
      definition.body.slots.map((slot) => slot.character).join(''),
    ),
    ['Z', 'BO', 'BAT'],
  )
  assert.deepEqual(
    content.ordinaryEnemyDefinitions.map(
      (definition) => definition.bodyMotionBehaviorId,
    ),
    [
      CREATURE_BODY_MOTION_BEHAVIOR.ZOMBIE_STAGGER,
      CREATURE_BODY_MOTION_BEHAVIOR.BONE_RATTLE,
      CREATURE_BODY_MOTION_BEHAVIOR.BAT_FLAP,
    ],
  )
  assert.deepEqual(
    content.ordinaryEnemyDefinitions.map(
      (definition) => definition.appearanceProfileId,
    ),
    [
      GLYPH_APPEARANCE_PROFILE.ZOMBIE,
      GLYPH_APPEARANCE_PROFILE.BONE,
      GLYPH_APPEARANCE_PROFILE.BAT,
    ],
  )
  assert.equal(
    content.ordinaryEnemyDefinitions.every(
      (definition) =>
        definition.broadPhaseRadius > definition.body.broadPhaseRadius,
    ),
    true,
  )
})

test('places O above B without changing BONE motion slot identity', () => {
  const bone = prepareGameContent().ordinaryEnemyDefinitions[1]
  const bSlot = bone.body.slots.find((slot) => slot.character === 'B')
  const oSlot = bone.body.slots.find((slot) => slot.character === 'O')

  assert.ok(bSlot)
  assert.ok(oSlot)
  assert.equal(bSlot.slotId, 0)
  assert.equal(oSlot.slotId, 1)
  assert.equal(bone.bodyMotionGroupBySlotId[bSlot.slotId], 0)
  assert.equal(bone.bodyMotionGroupBySlotId[oSlot.slotId], 1)
  assert.equal(bSlot.localX, oSlot.localX)
  assert.ok(oSlot.localY < bSlot.localY)
  assert.equal(oSlot.topologyX, bSlot.topologyX)
  assert.equal(oSlot.topologyY + 1, bSlot.topologyY)
})

test('preserves the first-appearance progression from Z to BO to BAT', () => {
  const content = prepareGameContent()
  const selectAt = (successfulSpawnCount: number) =>
    selectOrdinaryEnemyDefinition(
      content.ordinaryEnemyProgression,
      successfulSpawnCount,
      () => 0.5,
    ).id

  assert.equal(selectAt(0), 'enemy.zombie')
  assert.equal(selectAt(7), 'enemy.zombie')
  assert.equal(selectAt(8), 'enemy.bone')
  assert.equal(selectAt(15), 'enemy.bone')
  assert.equal(selectAt(16), 'enemy.bat')
  assert.equal(selectAt(1_000), 'enemy.bat')
})

test('rejects invalid ordinary enemy progression before a run starts', () => {
  const content = prepareGameContent()
  const [zombie, bone] = content.ordinaryEnemyDefinitions

  assert.throws(
    () =>
      defineOrdinaryEnemyProgression([
        { startSpawnCount: 1, entries: [{ definition: zombie, weight: 1 }] },
      ]),
    /start at spawn count zero/,
  )
  assert.throws(
    () =>
      defineOrdinaryEnemyProgression([
        { startSpawnCount: 0, entries: [{ definition: zombie, weight: 1 }] },
        { startSpawnCount: 0, entries: [{ definition: bone, weight: 1 }] },
      ]),
    /strictly increasing/,
  )
})
