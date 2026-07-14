import assert from 'node:assert/strict'
import test from 'node:test'
import { createUiSnapshot } from '../../src/game/bridge/uiSnapshot.ts'

test('deeply copies weapon-specific upgrade previews for React', () => {
  const preview = {
    weaponInstanceId: 1,
    summary: 'Target 700 → 805 / Travel 1116 → 1283',
  }
  const choice = {
    id: 'offer-1:0',
    kind: 'MODULE' as const,
    definitionId: 'module.range',
    weaponTargetPreviews: [preview],
  }
  const snapshot = createUiSnapshot({
    value: 'PAUSED_UPGRADE',
    context: {
      seed: 'range-preview',
      upgradeChoices: [choice],
      pendingUpgradeCount: 1,
      activeUpgradeOfferId: 'offer-1',
      recoverableError: null,
    },
  })

  preview.summary = 'mutated externally'
  choice.weaponTargetPreviews.push({
    weaponInstanceId: 2,
    summary: 'mutated externally',
  })

  assert.deepEqual(snapshot.upgradeChoices[0].weaponTargetPreviews, [
    {
      weaponInstanceId: 1,
      summary: 'Target 700 → 805 / Travel 1116 → 1283',
    },
  ])
  assert.equal(
    Object.isFrozen(snapshot.upgradeChoices[0].weaponTargetPreviews),
    true,
  )
  assert.equal(
    Object.isFrozen(snapshot.upgradeChoices[0].weaponTargetPreviews?.[0]),
    true,
  )
})
