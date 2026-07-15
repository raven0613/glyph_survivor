import type { WorldState } from '../runtime/worldState.ts'

function finishEncounterCollapse(
  world: WorldState,
  encounterId: number,
): void {
  const encounter = world.bossEncounters.get(encounterId)
  if (!encounter || encounter.phase !== 'COLLAPSING') {
    return
  }

  encounter.phase = 'DEFEATED'
  for (const enemy of world.enemies) {
    if (enemy.encounterId !== encounterId) {
      continue
    }
    enemy.phase = 'DEAD'
    enemy.rewardCommitted = true
  }
}

/** Completes only already-authorized collapse presentation without rewards. */
export function runDeathReviewCollapseSystem(
  world: WorldState,
  deltaMs: number,
): void {
  world.bossEncounters.forEach((encounter) => {
    if (encounter.phase !== 'COLLAPSING') {
      return
    }
    encounter.collapseRemainingMs = Math.max(
      0,
      encounter.collapseRemainingMs - deltaMs,
    )
    for (const enemy of world.enemies) {
      if (enemy.encounterId === encounter.id) {
        enemy.collapseRemainingMs = encounter.collapseRemainingMs
      }
    }
    if (encounter.collapseRemainingMs === 0) {
      finishEncounterCollapse(world, encounter.id)
    }
  })

  for (const enemy of world.enemies) {
    if (enemy.encounterId !== null || enemy.phase !== 'COLLAPSING') {
      continue
    }
    enemy.collapseRemainingMs = Math.max(
      0,
      enemy.collapseRemainingMs - deltaMs,
    )
    if (enemy.collapseRemainingMs === 0) {
      enemy.phase = 'DEAD'
      enemy.rewardCommitted = true
    }
  }
}
