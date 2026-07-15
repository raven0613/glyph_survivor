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
      canEnterRunResult: false,
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

test('publishes player survival and a deeply immutable run result', () => {
  const snapshot = createUiSnapshot(
    {
      value: 'GAME_OVER',
      context: {
        seed: 'survival-hud',
        upgradeChoices: [],
        pendingUpgradeCount: 0,
        activeUpgradeOfferId: null,
        recoverableError: null,
        canEnterRunResult: false,
      },
    },
    {
      xp: 2,
      xpToNext: 5,
      level: 1,
      runTimeMs: 1_000,
      enemyCount: 3,
      currentHealth: 7,
      maximumHealth: 10,
      currentShieldLayers: 1,
      maximumShieldLayers: 2,
      runResult: {
        gameplayTimeMs: 1_000,
        killCount: 3,
        finalPlayerLevel: 1,
        weapons: [
          {
            instanceId: 1,
            definitionId: 'weapon.assisted-o',
            title: 'Assisted o',
            identityGlyph: 'o',
            moduleSlots: [null],
            totalDamage: 8,
            equippedGameplayTimeMs: 1_000,
            averageEquippedDps: 8,
            isHighestDamage: true,
          },
        ],
      },
    },
  )

  assert.equal(snapshot.currentHealth, 7)
  assert.equal(snapshot.maximumHealth, 10)
  assert.equal(snapshot.currentShieldLayers, 1)
  assert.equal(snapshot.maximumShieldLayers, 2)
  assert.equal(snapshot.runResult?.weapons[0].totalDamage, 8)
  assert.equal(Object.isFrozen(snapshot.runResult), true)
  assert.equal(Object.isFrozen(snapshot.runResult?.weapons[0]), true)
})

test('publishes review readiness without exposing the frozen result early', () => {
  const runResult = {
    gameplayTimeMs: 1_000,
    killCount: 2,
    finalPlayerLevel: 1,
    weapons: [],
  }
  const snapshot = createUiSnapshot(
    {
      value: 'DEATH_REVIEW',
      context: {
        seed: 'death-review',
        upgradeChoices: [],
        pendingUpgradeCount: 0,
        activeUpgradeOfferId: null,
        recoverableError: null,
        canEnterRunResult: true,
      },
    },
    {
      xp: 0,
      xpToNext: 5,
      level: 1,
      runTimeMs: 1_000,
      enemyCount: 2,
      currentHealth: 0,
      maximumHealth: 10,
      currentShieldLayers: 0,
      maximumShieldLayers: 1,
      runResult,
    },
  )

  assert.equal(snapshot.canEnterRunResult, true)
  assert.equal(snapshot.runResult, null)
})
