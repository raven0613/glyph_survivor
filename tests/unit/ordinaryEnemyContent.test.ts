import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CREATURE_BODY_MOTION_BEHAVIOR,
  defineCreature,
} from '../../src/game/content/creatures/creatureDefinition.ts'
import {
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import {
  commitOrdinaryEnemySpawn,
  createOrdinaryEnemyProgressionState,
  defineOrdinaryEnemyProgression,
  selectOrdinaryEnemyDefinition,
} from '../../src/game/content/enemies/ordinaryEnemyProgression.ts'
import { GLYPH_APPEARANCE_PROFILE } from '../../src/game/content/visuals/combatVisualTheme.ts'
import {
  getGlyphMaterialDefinition,
  GLYPH_MATERIAL,
} from '../../src/game/glyph/glyphMaterial.ts'

test('compiles Z, BO, BAT, ROCK, and SNAKE as ordered ordinary enemy definitions', () => {
  const content = prepareGameContent()

  assert.deepEqual(
    content.ordinaryEnemyDefinitions.map((definition) => definition.id),
    ['enemy.zombie', 'enemy.bone', 'enemy.bat', 'enemy.rock', 'enemy.snake'],
  )
  assert.deepEqual(
    content.ordinaryEnemyDefinitions.map((definition) =>
      definition.body.slots.map((slot) => slot.character).join(''),
    ),
    ['Z', 'BO', 'BAT', 'ROCK', 'SNAKE'],
  )
  assert.deepEqual(
    content.ordinaryEnemyDefinitions.map(
      (definition) => definition.bodyMotion.behaviorId,
    ),
    [
      CREATURE_BODY_MOTION_BEHAVIOR.ZOMBIE_STAGGER,
      CREATURE_BODY_MOTION_BEHAVIOR.BONE_RATTLE,
      CREATURE_BODY_MOTION_BEHAVIOR.BAT_FLAP,
      CREATURE_BODY_MOTION_BEHAVIOR.ROCK_ROLL,
      CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE,
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
      GLYPH_APPEARANCE_PROFILE.ROCK,
      GLYPH_APPEARANCE_PROFILE.SNAKE,
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

test('defines SNAKE as one stable five-cell chain with S raised as its head', () => {
  const snake = prepareGameContent().ordinaryEnemyDefinitions[4]

  assert.equal(
    snake.bodyMotion.behaviorId,
    CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE,
  )
  if (
    snake.bodyMotion.behaviorId !==
    CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE
  ) {
    assert.fail('SNAKE must use its dedicated squeeze profile.')
  }
  assert.deepEqual(
    snake.body.slots.map(
      (slot) => snake.bodyMotion.groupBySlotId[slot.slotId],
    ),
    [0, 0, 0, 1, 2],
  )
  assert.ok(snake.bodyMotion.snaCompressionDistance > 0)
  assert.ok(snake.bodyMotion.eCompressionDistance > 0)
  assert.ok(snake.bodyMotion.kLiftDistance > 0)
  assert.ok(
    snake.bodyMotion.snaCompressionDistance < snake.bodyMotion.segmentLength,
  )
  assert.ok(
    snake.bodyMotion.eCompressionDistance < snake.bodyMotion.segmentLength,
  )
  assert.deepEqual(
    snake.body.slots.map((slot) => ({
      character: slot.character,
      topologyX: slot.topologyX,
      topologyY: slot.topologyY,
    })),
    [
      { character: 'S', topologyX: 0, topologyY: 0 },
      { character: 'N', topologyX: 1, topologyY: 0 },
      { character: 'A', topologyX: 2, topologyY: 0 },
      { character: 'K', topologyX: 3, topologyY: 0 },
      { character: 'E', topologyX: 4, topologyY: 0 },
    ],
  )
  const [head, ...body] = snake.body.slots
  assert.equal(head.character, 'S')
  assert.equal(head.role, 'HEAD')
  assert.ok(body.every((slot) => slot.role === 'BODY'))
  assert.ok(body.every((slot) => head.localY < slot.localY))
  assert.ok(
    snake.body.slots.every(
      (slot) => slot.maxDurability === 1 && slot.material === GLYPH_MATERIAL.BASIC,
    ),
  )
})

test('rejects SNAKE squeeze distances that would cross stable slots', () => {
  const snake = prepareGameContent().ordinaryEnemyDefinitions[4]
  const profile = snake.bodyMotion
  if (
    profile.behaviorId !==
    CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE
  ) {
    assert.fail('SNAKE must use its dedicated squeeze profile.')
  }
  const { broadPhaseRadius, ...snakeInput } = snake
  assert.ok(broadPhaseRadius > 0)

  assert.throws(
    () =>
      defineCreature({
        ...snakeInput,
        bodyMotion: {
          ...profile,
          snaCompressionDistance: profile.segmentLength,
        },
      }),
    /snaCompressionDistance must be less than segmentLength/,
  )
  assert.throws(
    () =>
      defineCreature({
        ...snakeInput,
        bodyMotion: {
          ...profile,
          eCompressionDistance: profile.segmentLength,
        },
      }),
    /eCompressionDistance must be less than segmentLength/,
  )
})

test('defines ROCK as a stable hard 2 by 2 glyph body', () => {
  const rock = prepareGameContent().ordinaryEnemyDefinitions[3]

  assert.equal(
    rock.bodyMotion.behaviorId,
    CREATURE_BODY_MOTION_BEHAVIOR.ROCK_ROLL,
  )
  if (rock.bodyMotion.behaviorId !== CREATURE_BODY_MOTION_BEHAVIOR.ROCK_ROLL) {
    assert.fail('ROCK must use its dedicated roll profile.')
  }
  assert.ok(rock.bodyMotion.fullRollDurationMs > 0)
  assert.ok(rock.bodyMotion.poseHoldDurationMs >= 0)

  assert.deepEqual(
    rock.body.slots.map((slot) => ({
      character: slot.character,
      topologyX: slot.topologyX,
      topologyY: slot.topologyY,
    })),
    [
      { character: 'R', topologyX: 0, topologyY: 0 },
      { character: 'O', topologyX: 1, topologyY: 0 },
      { character: 'C', topologyX: 0, topologyY: 1 },
      { character: 'K', topologyX: 1, topologyY: 1 },
    ],
  )
  assert.equal(
    rock.body.slots.every(
      (slot) =>
        slot.maxDurability > 1 && slot.material === GLYPH_MATERIAL.ROCK,
    ),
    true,
  )
  const basicMaterial = getGlyphMaterialDefinition(GLYPH_MATERIAL.BASIC)
  const rockMaterial = getGlyphMaterialDefinition(GLYPH_MATERIAL.ROCK)
  assert.ok(rockMaterial.knockbackImpulse < basicMaterial.knockbackImpulse)
  assert.ok(rockMaterial.maximumOffset < basicMaterial.maximumOffset)
})

test('places O above B without changing BONE motion slot identity', () => {
  const bone = prepareGameContent().ordinaryEnemyDefinitions[1]
  const bSlot = bone.body.slots.find((slot) => slot.character === 'B')
  const oSlot = bone.body.slots.find((slot) => slot.character === 'O')

  assert.ok(bSlot)
  assert.ok(oSlot)
  assert.equal(bSlot.slotId, 0)
  assert.equal(oSlot.slotId, 1)
  assert.equal(bone.bodyMotion.groupBySlotId[bSlot.slotId], 0)
  assert.equal(bone.bodyMotion.groupBySlotId[oSlot.slotId], 1)
  assert.equal(bSlot.localX, oSlot.localX)
  assert.ok(oSlot.localY < bSlot.localY)
  assert.equal(oSlot.topologyX, bSlot.topologyX)
  assert.equal(oSlot.topologyY + 1, bSlot.topologyY)
})

test('preserves time-gated debut order until each spawn commits', () => {
  const content = prepareGameContent()
  const progression = content.ordinaryEnemyProgression
  const state = createOrdinaryEnemyProgressionState()

  const zombieDebut = selectOrdinaryEnemyDefinition(
    progression,
    state,
    progression.entries.at(-1)?.earliestAppearanceTimeMs ?? 0,
    () => 0.5,
  )
  assert.equal(zombieDebut.definition.id, 'enemy.zombie')
  assert.equal(zombieDebut.isDebut, true)

  const failedZombieRetry = selectOrdinaryEnemyDefinition(
    progression,
    state,
    Number.MAX_SAFE_INTEGER,
    () => 0.5,
  )
  assert.equal(failedZombieRetry.definition.id, 'enemy.zombie')
  assert.equal(failedZombieRetry.isDebut, true)

  commitOrdinaryEnemySpawn(state, zombieDebut)
  const beforeBoneGate = selectOrdinaryEnemyDefinition(
    progression,
    state,
    progression.entries[1].earliestAppearanceTimeMs - 1,
    () => 0.5,
  )
  assert.equal(beforeBoneGate.definition.id, 'enemy.zombie')
  assert.equal(beforeBoneGate.isDebut, false)

  for (let index = 1; index < progression.entries.length; index += 1) {
    const debut = selectOrdinaryEnemyDefinition(
      progression,
      state,
      progression.entries[index].earliestAppearanceTimeMs,
      () => 0.5,
    )
    assert.equal(debut.definition.id, progression.entries[index].definition.id)
    assert.equal(debut.isDebut, true)
    commitOrdinaryEnemySpawn(state, debut)
  }

  assert.equal(state.completedDebutCount, progression.entries.length)
  assert.equal(state.pendingDebutIndex, null)

  const totalWeight = progression.entries.reduce(
    (sum, entry) => sum + entry.postDebutWeight,
    0,
  )
  let precedingWeight = 0
  for (const entry of progression.entries) {
    const randomValue =
      (precedingWeight + entry.postDebutWeight / 2) / totalWeight
    const mixedSelection = selectOrdinaryEnemyDefinition(
      progression,
      state,
      Number.MAX_SAFE_INTEGER,
      () => randomValue,
    )
    assert.equal(mixedSelection.definition.id, entry.definition.id)
    assert.equal(mixedSelection.isDebut, false)
    precedingWeight += entry.postDebutWeight
  }
})

test('rejects invalid ordinary enemy progression before a run starts', () => {
  const content = prepareGameContent()
  const [zombie, bone] = content.ordinaryEnemyDefinitions

  assert.throws(
    () =>
      defineOrdinaryEnemyProgression([
        {
          definition: zombie,
          earliestAppearanceTimeMs: 1,
          postDebutWeight: 1,
        },
      ]),
    /first appearance time zero/,
  )
  assert.throws(
    () =>
      defineOrdinaryEnemyProgression([
        {
          definition: zombie,
          earliestAppearanceTimeMs: 0,
          postDebutWeight: 1,
        },
        {
          definition: bone,
          earliestAppearanceTimeMs: 0,
          postDebutWeight: 1,
        },
      ]),
    /appearance times must be strictly increasing/,
  )
})
