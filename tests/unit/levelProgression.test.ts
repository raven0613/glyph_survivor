import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PROTOTYPE_LEVEL_PROGRESSION,
  getXpToNextLevel,
} from '../../src/game/content/upgrades/levelProgression.ts'
import { applyExperienceProgress } from '../../src/game/systems/upgradeSystem.ts'
import { runUpgradeSystem } from '../../src/game/systems/upgradeSystem.ts'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { createWorldState } from '../../src/game/runtime/worldState.ts'

test('uses the validated prototype XP thresholds', () => {
  assert.deepEqual(
    Array.from({ length: 10 }, (_, index) =>
      getXpToNextLevel(PROTOTYPE_LEVEL_PROGRESSION, index + 1),
    ),
    [5, 8, 12, 17, 23, 30, 38, 47, 57, 68],
  )
  assert.equal(getXpToNextLevel(PROTOTYPE_LEVEL_PROGRESSION, 11), 80)
})

test('queues crossed levels but creates only one active offer before pause', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'level-up-world',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  world.collectedXpThisStep = 26

  assert.equal(runUpgradeSystem(world), true)
  assert.equal(world.upgradeState.pendingUpgradeCount, 3)
  assert.equal(world.upgradeState.activeOffer?.sequence, 0)
  assert.equal(runUpgradeSystem(world), false)
  assert.equal(world.upgradeState.offerSequence, 1)
})

test('preserves overflow and queues every crossed level', () => {
  const progress = { level: 1, xpIntoLevel: 0 }

  const levelsGained = applyExperienceProgress(
    progress,
    26,
    PROTOTYPE_LEVEL_PROGRESSION,
  )

  assert.equal(levelsGained, 3)
  assert.deepEqual(progress, { level: 4, xpIntoLevel: 1 })
})
