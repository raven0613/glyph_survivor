import assert from 'node:assert/strict'
import test from 'node:test'
import { assertValidRunModifierConfig } from '../../src/game/runtime/runModifierConfig.ts'

test('accepts an explicit Boolean run-start test flag and rejects ambiguous values', () => {
  assert.doesNotThrow(() =>
    assertValidRunModifierConfig({
      enableRunStartModifierOfferForTesting: false,
    }),
  )
  assert.doesNotThrow(() =>
    assertValidRunModifierConfig({
      enableRunStartModifierOfferForTesting: true,
    }),
  )
  assert.throws(
    () =>
      assertValidRunModifierConfig({
        enableRunStartModifierOfferForTesting: 1,
      }),
    /Boolean/,
  )
})
