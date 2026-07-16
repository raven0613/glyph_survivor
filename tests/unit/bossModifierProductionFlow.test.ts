import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { RUN_MODIFIER_DEFINITION_ID } from '../../src/game/content/modifiers/prototypeRunModifiers.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { enqueueVolatileSource } from '../../src/game/runtime/volatileState.ts'
import {
  SIMULATION_STEP_RESULT,
  runSimulationStep,
} from '../../src/game/runtime/runSimulationStep.ts'
import {
  createWorldState,
  spawnEnemy,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import { runBossModifierRewardSystem } from '../../src/game/systems/bossModifierRewardSystem.ts'
import { runCleanupSystem } from '../../src/game/systems/cleanupSystem.ts'
import { runDeathSystem } from '../../src/game/systems/deathSystem.ts'
import { runDropSystem } from '../../src/game/systems/dropSystem.ts'
import { createRunStartTestModifierOfferIfEnabled } from '../../src/game/systems/runModifierOffer.ts'
import { selectRunModifierFromOffer } from '../../src/game/systems/runModifierTransaction.ts'
import { runUpgradeSystem } from '../../src/game/systems/upgradeSystem.ts'
import { runVolatileReactionSystem } from '../../src/game/systems/volatileReactionSystem.ts'

function createWorldWithOwnedModifier(
  seed: string,
  definitionId: string,
): WorldState {
  const content = prepareGameContent()
  const world = createWorldState(
    seed,
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const offer = createRunStartTestModifierOfferIfEnabled(
    content.runModifierDefinitions,
    world.runModifierState,
    true,
  )
  assert.ok(offer)
  const choice = offer.choices.find(
    (candidate) => candidate.definitionId === definitionId,
  )
  assert.ok(choice)
  assert.equal(
    selectRunModifierFromOffer(
      content.runModifierDefinitions,
      world.runModifierState,
      { offerId: offer.id, choiceId: choice.id },
    ).ok,
    true,
  )
  return world
}

function spawnDepletedSlime(world: WorldState) {
  const slime = spawnEnemy(
    world,
    world.player.x,
    world.player.y,
    0,
    world.content.slimeBossDefinition,
  )
  slime.phase = 'ACTIVE'
  for (const glyph of world.glyphStore.getOwnerGlyphs(slime.id)) {
    world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
  }
  return slime
}

test('waits for pending encounter sources, then authorizes one two-choice reward beside XP', () => {
  const world = createWorldWithOwnedModifier(
    'boss-formal-reward',
    RUN_MODIFIER_DEFINITION_ID.VOLATILE,
  )
  const slime = spawnDepletedSlime(world)
  const source = world.glyphStore.getOwnerGlyphs(slime.id)[0]
  enqueueVolatileSource(world.volatileState, {
    sourceGlyphId: source.id,
    ownerId: slime.id,
    sourceMaxDurability: source.maxDurability,
    rootAttackEventId: 1,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    causingApplicationId: 1,
    reactionChainId: null,
    appendToNextWave: false,
  })
  runDeathSystem(world)
  const encounter = world.bossEncounters.get(slime.encounterId!)
  assert.ok(encounter)

  runDeathSystem(world, encounter.collapseDurationMs)

  assert.equal(encounter.phase, 'COLLAPSING')
  assert.equal(encounter.collapseRemainingMs, 0)
  assert.equal(runBossModifierRewardSystem(world), null)
  runDropSystem(world)
  assert.equal(world.drops.length, 0)

  runVolatileReactionSystem(world)
  runDeathSystem(world)
  const modifierOffer = runBossModifierRewardSystem(world)
  assert.ok(modifierOffer)
  assert.equal(encounter.phase, 'DEFEATED')
  assert.equal(modifierOffer.origin, 'BOSS_REWARD')
  assert.equal(modifierOffer.choices.length, 2)
  assert.equal(
    modifierOffer.choices.some(
      ({ definitionId }) =>
        definitionId === RUN_MODIFIER_DEFINITION_ID.VOLATILE,
    ),
    false,
  )
  assert.equal(world.runModifierState.pendingBossRewardTokens.length, 0)
  assert.deepEqual(
    [...world.runModifierState.bossRewardTokenEncounterIds],
    [encounter.id],
  )

  world.player.x = slime.x
  world.player.y = slime.y
  world.player.xpIntoLevel = 4
  runDropSystem(world)
  runDropSystem(world)
  assert.equal(world.drops.length, 1)
  assert.equal(world.collectedXpThisStep, 1)
  assert.equal(runUpgradeSystem(world), true)
  assert.ok(world.upgradeState.activeOffer)
  assert.ok(world.runModifierState.activeOffer)

  runCleanupSystem(world)
  assert.equal(world.bossEncounters.has(encounter.id), false)
  assert.equal(world.runModifierState.activeAuthorization?.bossEncounterId, encounter.id)
  assert.equal(runBossModifierRewardSystem(world), null)
  assert.equal(world.runStatistics.killCount, 1)
  const selection = selectRunModifierFromOffer(
    world.content.runModifierDefinitions,
    world.runModifierState,
    {
      offerId: modifierOffer.id,
      choiceId: modifierOffer.choices[0].id,
    },
  )
  assert.equal(selection.ok, true)
})

test('offers three formal Boss choices when the run owns no Modifier', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'boss-three-choice-release-path',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const slime = spawnDepletedSlime(world)
  runDeathSystem(world)
  const encounter = world.bossEncounters.get(slime.encounterId!)
  assert.ok(encounter)
  runDeathSystem(world, encounter.collapseDurationMs)

  const offer = runBossModifierRewardSystem(world)

  assert.ok(offer)
  assert.equal(offer.origin, 'BOSS_REWARD')
  assert.equal(offer.choices.length, 3)
  assert.equal(
    new Set(offer.choices.map(({ definitionId }) => definitionId)).size,
    3,
  )
})

function prepareDefeatedBossBeforeArbitration(seed: string): WorldState {
  const world = createWorldWithOwnedModifier(
    seed,
    RUN_MODIFIER_DEFINITION_ID.OVERLOAD,
  )
  const slime = spawnDepletedSlime(world)
  runDeathSystem(world)
  const encounter = world.bossEncounters.get(slime.encounterId!)
  assert.ok(encounter)
  runDeathSystem(world, encounter.collapseDurationMs)
  assert.equal(encounter.phase, 'DEFEATED')
  world.player.x = slime.x
  world.player.y = slime.y
  world.player.xpIntoLevel = 4
  return world
}

test('arbitrates a formal Modifier reward before a simultaneous XP upgrade', () => {
  const world = prepareDefeatedBossBeforeArbitration(
    'boss-modifier-before-upgrade',
  )

  const result = runSimulationStep(world, 1_000 / 60)

  assert.equal(result, SIMULATION_STEP_RESULT.MODIFIER_REWARD_OFFERED)
  assert.ok(world.runModifierState.activeOffer)
  assert.ok(world.upgradeState.activeOffer)
  assert.equal(world.upgradeState.pendingUpgradeCount, 1)
})

test('does not authorize the formal Boss reward when the player dies in the same step', () => {
  const world = prepareDefeatedBossBeforeArbitration(
    'player-death-before-modifier',
  )
  world.player.survival.currentHealth = 0

  const result = runSimulationStep(world, 1_000 / 60)

  assert.equal(result, SIMULATION_STEP_RESULT.PLAYER_DIED)
  assert.equal(world.runModifierState.activeOffer, null)
  assert.equal(world.runModifierState.pendingBossRewardTokens.length, 0)
  assert.equal(world.upgradeState.activeOffer, null)
})
