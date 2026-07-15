import assert from 'node:assert/strict'
import test from 'node:test'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { resolveExperienceDropPresentation } from '../../src/game/content/visuals/experienceDropPresentation.ts'
import { runCleanupSystem } from '../../src/game/systems/cleanupSystem.ts'
import {
  createWorldState,
  spawnExperienceDrop,
} from '../../src/game/runtime/worldState.ts'

test('moves XP from fresh yellow through a transition into settled dark gold', () => {
  const theme = prepareGameContent().combatVisualTheme
  const appearance = theme.drops.experience
  const fresh = resolveExperienceDropPresentation(theme, 0, 1)
  const transition = resolveExperienceDropPresentation(
    theme,
    appearance.freshDurationMs + appearance.settleTransitionMs / 2,
    1,
  )

  assert.deepEqual(fresh, { ...appearance.fresh, scale: appearance.scale })
  assert.notEqual(transition.tint, appearance.fresh.tint)
  assert.notEqual(transition.tint, appearance.settled.tint)
  assert.ok(transition.alpha < appearance.fresh.alpha)
  assert.ok(transition.alpha > appearance.settled.alpha)
})

test('uses deterministic drop IDs to stagger brief settled-state flashes', () => {
  const theme = prepareGameContent().combatVisualTheme
  const appearance = theme.drops.experience
  const settledStart =
    appearance.freshDurationMs + appearance.settleTransitionMs
  let staggeredPair:
    | readonly [
        ReturnType<typeof resolveExperienceDropPresentation>,
        ReturnType<typeof resolveExperienceDropPresentation>,
      ]
    | undefined

  for (let elapsedMs = 0; elapsedMs < appearance.flashIntervalMs; elapsedMs += 5) {
    const first = resolveExperienceDropPresentation(
      theme,
      settledStart + elapsedMs,
      1,
    )
    const second = resolveExperienceDropPresentation(
      theme,
      settledStart + elapsedMs,
      2,
    )
    const firstIsSettled = first.tint === appearance.settled.tint
    const secondIsSettled = second.tint === appearance.settled.tint
    if (firstIsSettled !== secondIsSettled) {
      staggeredPair = [first, second]
      break
    }
  }

  assert.ok(staggeredPair, 'expected stable IDs to produce staggered flash phases')
  assert.deepEqual(
    resolveExperienceDropPresentation(theme, settledStart, 7),
    resolveExperienceDropPresentation(theme, settledStart, 7),
  )
})

test('resets XP visual age when a pooled drop is spawned again', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'xp-pool-reset',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const original = spawnExperienceDrop(world, 10, 20, 1)
  world.runTimeMs = 10_000
  original.isAlive = false
  runCleanupSystem(world)

  const recycled = spawnExperienceDrop(world, 30, 40, 2)
  const presentation = resolveExperienceDropPresentation(
    content.combatVisualTheme,
    world.runTimeMs - recycled.spawnedAtRunTimeMs,
    recycled.id,
  )

  assert.equal(recycled, original)
  assert.equal(recycled.spawnedAtRunTimeMs, world.runTimeMs)
  assert.deepEqual(presentation, {
    ...content.combatVisualTheme.drops.experience.fresh,
    scale: content.combatVisualTheme.drops.experience.scale,
  })
})
