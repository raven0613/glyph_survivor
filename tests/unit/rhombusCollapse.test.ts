import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import {
  activateRhombusBossContent,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { RUN_MODIFIER_DEFINITION_ID } from '../../src/game/content/modifiers/prototypeRunModifiers.ts'
import {
  beginWorldDeathReview,
  runDeathReviewStep,
} from '../../src/game/runtime/runDeathReviewStep.ts'
import {
  RHOMBUS_COLLAPSE_PHASE,
} from '../../src/game/runtime/rhombusCollapseState.ts'
import {
  createWorldState,
  spawnEnemy,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import {
  enqueueVolatileSource,
  hasPendingVolatileSourcesForOwner,
} from '../../src/game/runtime/volatileState.ts'
import { runBossModifierRewardSystem } from '../../src/game/systems/bossModifierRewardSystem.ts'
import { runCleanupSystem } from '../../src/game/systems/cleanupSystem.ts'
import { runDeathSystem } from '../../src/game/systems/deathSystem.ts'
import { runDropSystem } from '../../src/game/systems/dropSystem.ts'
import { createRunStartTestModifierOfferIfEnabled } from '../../src/game/systems/runModifierOffer.ts'
import { selectRunModifierFromOffer } from '../../src/game/systems/runModifierTransaction.ts'
import { runVolatileReactionSystem } from '../../src/game/systems/volatileReactionSystem.ts'

function createActiveRhombusWorld(seed: string): {
  world: WorldState
  rhombusId: number
} {
  const content = activateRhombusBossContent(prepareGameContent())
  const world = createWorldState(
    seed,
    4_000,
    4_000,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const rhombus = spawnEnemy(
    world,
    world.player.x + 200,
    world.player.y,
    0,
    content.rhombusBossDefinition.creature,
  )
  rhombus.phase = 'ACTIVE'
  return { world, rhombusId: rhombus.id }
}

function depleteRhombus(world: WorldState, rhombusId: number): void {
  for (const glyph of world.glyphStore.getOwnerGlyphs(rhombusId)) {
    world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
  }
}

test('RHOMBUS begins one masonry collapse only after all 463 Cells become Husks', () => {
  const { world, rhombusId } = createActiveRhombusWorld(
    'rhombus-collapse-authority',
  )
  const glyphs = world.glyphStore.getOwnerGlyphs(rhombusId)
  assert.equal(glyphs.length, 463)
  for (let index = 0; index < glyphs.length - 1; index += 1) {
    world.glyphStore.applyDamage(
      glyphs[index].id,
      glyphs[index].currentDurability,
    )
  }

  runDeathSystem(world)
  assert.equal(world.bossEncounters.get(rhombusId)?.phase, 'ACTIVE')
  assert.equal(world.rhombusCollapseStates.has(rhombusId), false)

  world.glyphStore.applyDamage(
    glyphs[glyphs.length - 1].id,
    glyphs[glyphs.length - 1].currentDurability,
  )
  runDeathSystem(world)

  const collapse = world.rhombusCollapseStates.get(rhombusId)
  assert.ok(collapse)
  assert.equal(collapse.phase, RHOMBUS_COLLAPSE_PHASE.BRIGHTNESS_LIFT)
  assert.equal(collapse.glyphPlans.length, 463)
  assert.equal(new Set(collapse.glyphPlans.map(({ glyphId }) => glyphId)).size, 463)
  assert.ok(glyphs.every(({ currentDurability }) => currentDurability === 0))
})

test('RHOMBUS compiles a deterministic staggered masonry pile instead of a flat row', () => {
  const first = createActiveRhombusWorld('rhombus-collapse-determinism')
  const second = createActiveRhombusWorld('rhombus-collapse-determinism')
  depleteRhombus(first.world, first.rhombusId)
  depleteRhombus(second.world, second.rhombusId)
  runDeathSystem(first.world)
  runDeathSystem(second.world)

  const firstPlan = first.world.rhombusCollapseStates.get(first.rhombusId)
  const secondPlan = second.world.rhombusCollapseStates.get(second.rhombusId)
  assert.ok(firstPlan)
  assert.ok(secondPlan)
  assert.deepEqual(firstPlan.glyphPlans, secondPlan.glyphPlans)
  assert.ok(new Set(firstPlan.glyphPlans.map(({ targetY }) => targetY)).size > 10)
  assert.ok(new Set(firstPlan.glyphPlans.map(({ targetX }) => targetX)).size > 10)
  assert.ok(firstPlan.glyphPlans.some(({ targetRotation }) => targetRotation < 0))
  assert.ok(firstPlan.glyphPlans.some(({ targetRotation }) => targetRotation > 0))
  assert.ok(
    firstPlan.glyphPlans.some(
      ({ fallDelayMs }, index, plans) =>
        index > 0 && fallDelayMs !== plans[0].fallDelayMs,
    ),
  )
})

test('RHOMBUS renders brightness lift, falling letters, then a visible settled pile without reviving Cells', () => {
  const { world, rhombusId } = createActiveRhombusWorld(
    'rhombus-collapse-presentation',
  )
  depleteRhombus(world, rhombusId)
  runDeathSystem(world)
  const collapse = world.rhombusCollapseStates.get(rhombusId)
  assert.ok(collapse)
  const theme = world.content.combatVisualTheme.effects.rhombus.collapse
  const profile = world.content.rhombusBossDefinition.collapseProfile
  const snapshot = createRenderSnapshot()

  writeRenderSnapshot(world, snapshot, 1)
  assert.equal(snapshot.enemies.length, 463)
  assert.ok(
    snapshot.enemies.every(
      ({ tint, alpha }) =>
        tint === theme.brightnessLift.tint && alpha === theme.brightnessLift.alpha,
    ),
  )

  runDeathSystem(
    world,
    theme.brightnessLiftDurationMs +
      profile.maximumFallDelayMs +
      profile.fallDurationMs / 2,
  )
  assert.equal(collapse.phase, RHOMBUS_COLLAPSE_PHASE.FALLING)
  writeRenderSnapshot(world, snapshot, 1)
  assert.ok(
    snapshot.enemies.some((renderGlyph) => {
      const plan = collapse.glyphPlans.find(
        ({ glyphId }) => glyphId === renderGlyph.id,
      )
      return plan !== undefined && renderGlyph.y !== plan.startY
    }),
  )
  assert.ok(
    world.glyphStore
      .getOwnerGlyphs(rhombusId)
      .every(({ currentDurability }) => currentDurability === 0),
  )

  runDeathSystem(
    world,
    profile.fallDurationMs / 2 + profile.settleDurationMs,
  )
  writeRenderSnapshot(world, snapshot, 1)
  assert.equal(collapse.phase, RHOMBUS_COLLAPSE_PHASE.COMPLETE)
  assert.ok(
    snapshot.enemies.every(
      ({ tint, alpha }) =>
        tint === theme.settledPile.tint && alpha === theme.settledPile.alpha,
    ),
  )
})

test('RHOMBUS Encounter commits one XP reward and one Modifier token after collapse', () => {
  const { world, rhombusId } = createActiveRhombusWorld(
    'rhombus-collapse-settlement',
  )
  const rhombus = world.enemyById.get(rhombusId)
  assert.ok(rhombus)
  const testOffer = createRunStartTestModifierOfferIfEnabled(
    world.content.runModifierDefinitions,
    world.runModifierState,
    true,
  )
  assert.ok(testOffer)
  const volatileChoice = testOffer.choices.find(
    ({ definitionId }) =>
      definitionId === RUN_MODIFIER_DEFINITION_ID.VOLATILE,
  )
  assert.ok(volatileChoice)
  assert.equal(
    selectRunModifierFromOffer(
      world.content.runModifierDefinitions,
      world.runModifierState,
      { offerId: testOffer.id, choiceId: volatileChoice.id },
    ).ok,
    true,
  )
  depleteRhombus(world, rhombusId)
  const source = world.glyphStore.getOwnerGlyphs(rhombusId)[0]
  enqueueVolatileSource(world.volatileState, {
    sourceGlyphId: source.id,
    ownerId: rhombusId,
    sourceMaxDurability: source.maxDurability,
    rootAttackEventId: 1,
    sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
    causingApplicationId: 1,
    reactionChainId: null,
    appendToNextWave: false,
  })
  runDeathSystem(world)
  const encounter = world.bossEncounters.get(rhombusId)
  assert.ok(encounter)

  runDeathSystem(world, encounter.collapseDurationMs)
  assert.equal(encounter.phase, 'COLLAPSING')
  assert.equal(runBossModifierRewardSystem(world), null)
  runDropSystem(world)
  assert.equal(world.drops.length, 0)

  for (
    let step = 0;
    step < 10 &&
    hasPendingVolatileSourcesForOwner(world.volatileState, rhombusId);
    step += 1
  ) {
    runVolatileReactionSystem(world, 1_000)
  }
  assert.equal(
    hasPendingVolatileSourcesForOwner(world.volatileState, rhombusId),
    false,
  )
  runDeathSystem(world)
  assert.equal(encounter.phase, 'DEFEATED')
  assert.equal(world.runStatistics.killCount, 1)

  const offer = runBossModifierRewardSystem(world)
  assert.ok(offer)
  runDropSystem(world)
  runDropSystem(world)
  assert.equal(world.drops.length, 1)
  assert.equal(
    world.drops[0].value,
    world.content.rhombusBossDefinition.creature.experienceReward,
  )

  runDeathSystem(world, encounter.collapseDurationMs)
  runBossModifierRewardSystem(world)
  runDropSystem(world)
  assert.equal(world.runStatistics.killCount, 1)
  assert.equal(world.drops.length, 1)
  assert.equal(
    world.runModifierState.bossRewardTokenEncounterIds.size,
    1,
  )

  runCleanupSystem(world)
  assert.equal(world.rhombusCollapseStates.has(rhombusId), false)
})

test('death review finishes an authorized RHOMBUS collapse without post-death rewards', () => {
  const { world, rhombusId } = createActiveRhombusWorld(
    'rhombus-collapse-death-review',
  )
  depleteRhombus(world, rhombusId)
  runDeathSystem(world)
  world.player.survivalPresentation.eventRevision = 1
  assert.equal(beginWorldDeathReview(world), true)

  runDeathReviewStep(
    world,
    world.content.rhombusBossDefinition.creature.collapseDurationMs,
  )

  assert.equal(world.runStatistics.killCount, 0)
  assert.equal(world.drops.length, 0)
  assert.equal(world.runModifierState.pendingBossRewardTokens.length, 0)
  assert.equal(world.rhombusCollapseStates.has(rhombusId), false)
  assert.equal(world.enemies.length, 0)
})
