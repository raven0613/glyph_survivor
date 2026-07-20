import assert from 'node:assert/strict'
import test from 'node:test'
import { getInitialModifierChoiceId } from '../../src/app/screens/modifierRewardSelection.ts'

const choices = Object.freeze([
  Object.freeze({ id: 'choice-1' }),
  Object.freeze({ id: 'choice-2' }),
])

test('preselects the only Modifier choice so Confirm can be used immediately', () => {
  assert.equal(getInitialModifierChoiceId(choices.slice(0, 1)), 'choice-1')
})

test('requires an explicit card selection when multiple Modifier choices remain', () => {
  assert.equal(getInitialModifierChoiceId(choices), null)
  assert.equal(getInitialModifierChoiceId([]), null)
})
