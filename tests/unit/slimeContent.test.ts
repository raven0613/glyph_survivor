import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import {
  CREATURE_LAYOUT_BEHAVIOR,
  CREATURE_MOVEMENT_BEHAVIOR,
} from '../../src/game/content/creatures/creatureDefinition.ts'
import { GLYPH_MATERIAL } from '../../src/game/glyph/glyphMaterial.ts'

test('compiles the Slime boss as 50 fixed cells with 70 total durability', () => {
  const slime = prepareGameContent().slimeBossDefinition
  const eyeSlots = slime.body.slots.filter((slot) => slot.role === 'EYE')

  assert.equal(slime.body.slots.length, 50)
  assert.equal(
    slime.body.slots.reduce((total, slot) => total + slot.maxDurability, 0),
    70,
  )
  assert.equal(
    slime.body.slots.filter((slot) => slot.maxDurability === 2).length,
    20,
  )
  assert.equal(eyeSlots.length, 2)
  assert.equal(eyeSlots.every((slot) => slot.character === 'O'), true)
  assert.equal(
    slime.body.slots.every((slot) => slot.material === GLYPH_MATERIAL.SLIME),
    true,
  )
})

test('keeps the same 50 Slime slot IDs in every morph pose', () => {
  const body = prepareGameContent().slimeBossDefinition.body
  const expectedSlotIds = body.slots.map((slot) => slot.slotId).sort((a, b) => a - b)

  assert.deepEqual(Object.keys(body.poses).sort(), ['neutral', 'tall', 'wide'])
  for (const pose of Object.values(body.poses)) {
    assert.deepEqual(
      Object.keys(pose.anchorsBySlotId).map(Number).sort((a, b) => a - b),
      expectedSlotIds,
    )
  }
})

test('composes Slime movement and layout behavior without species switches', () => {
  const slime = prepareGameContent().slimeBossDefinition

  assert.equal(slime.maximumSpeed, 60)
  assert.equal(slime.contactDamage, 1)
  assert.equal(
    slime.movementBehaviorId,
    CREATURE_MOVEMENT_BEHAVIOR.DAMPED_PURSUIT,
  )
  assert.equal(
    slime.layoutBehaviorId,
    CREATURE_LAYOUT_BEHAVIOR.SLIME_MORPH,
  )
})
