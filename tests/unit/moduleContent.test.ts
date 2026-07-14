import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MODULE_EFFECT_KIND,
  defineWeaponModule,
  type ModuleEffectKind,
} from '../../src/game/content/upgrades/moduleDefinition.ts'

test('copies and freezes one contiguous Module Rank table', () => {
  const ranks = [
    { rank: 1, totalMultiplier: 1.1 },
    { rank: 2, totalMultiplier: 1.25 },
  ]
  const definition = defineWeaponModule({
    id: 'module.test-valid',
    title: 'Valid',
    description: 'Valid module.',
    effectKind: MODULE_EFFECT_KIND.ATTACK_SPEED,
    ranks,
  })
  ranks[0].totalMultiplier = 99

  assert.equal(definition.ranks[0].totalMultiplier, 1.1)
  assert.equal(Object.isFrozen(definition), true)
  assert.equal(Object.isFrozen(definition.ranks), true)
  assert.equal(Object.isFrozen(definition.ranks[0]), true)
})

test('rejects an unknown Module effect before content preparation completes', () => {
  assert.throws(
    () =>
      defineWeaponModule({
        id: 'module.test-unknown',
        title: 'Unknown',
        description: 'Unknown effect.',
        effectKind: 'UNKNOWN' as ModuleEffectKind,
        ranks: [{ rank: 1, totalMultiplier: 1.1 }],
      }),
    /effectKind/,
  )
})
