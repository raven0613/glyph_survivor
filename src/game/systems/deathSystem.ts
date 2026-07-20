import type { BossEncounterState } from '../runtime/worldEntities.ts'
import { recordFormalKill } from '../runtime/runStatistics.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { hasPendingVolatileSourcesForOwner } from '../runtime/volatileState.ts'
import {
  beginCreatureCollapse,
  updateCreatureCollapsePresentation,
} from './creatureCollapseSystem.ts'

function getEncounterCurrentDurability(
  world: WorldState,
  encounter: BossEncounterState,
): number {
  let currentDurability = 0
  for (const enemy of world.enemies) {
    if (enemy.encounterId !== encounter.id) {
      continue
    }
    currentDurability +=
      world.glyphStore.getOwnerDurability(enemy.id)?.currentDurability ?? 0
  }
  return currentDurability
}

function resolveEncounterDeath(
  world: WorldState,
  encounter: BossEncounterState,
  deltaMs: number,
): void {
  if (encounter.phase === 'DEFEATED') {
    return
  }

  if (encounter.phase === 'COLLAPSING') {
    encounter.collapseRemainingMs = Math.max(
      0,
      encounter.collapseRemainingMs - deltaMs,
    )
    for (const enemy of world.enemies) {
      if (enemy.encounterId === encounter.id) {
        enemy.collapseRemainingMs = encounter.collapseRemainingMs
        updateCreatureCollapsePresentation(world, enemy)
      }
    }
    if (encounter.collapseRemainingMs > 0) {
      return
    }
    const hasPendingVolatileSources = world.enemies.some(
      (enemy) =>
        enemy.encounterId === encounter.id &&
        hasPendingVolatileSourcesForOwner(world.volatileState, enemy.id),
    )
    if (hasPendingVolatileSources) {
      return
    }

    encounter.phase = 'DEFEATED'
    recordFormalKill(world.runStatistics)
    for (const enemy of world.enemies) {
      if (enemy.encounterId !== encounter.id) {
        continue
      }
      enemy.phase = 'DEAD'
      if (!enemy.rewardEligible) {
        enemy.rewardCommitted = true
      }
    }
    return
  }

  for (const enemy of world.enemies) {
    if (
      enemy.encounterId === encounter.id &&
      world.glyphStore.isOwnerDepleted(enemy.id)
    ) {
      enemy.phase = 'INACTIVE'
    }
  }

  if (getEncounterCurrentDurability(world, encounter) > 0) {
    return
  }

  encounter.phase = 'COLLAPSING'
  encounter.collapseRemainingMs = encounter.collapseDurationMs
  for (const enemy of world.enemies) {
    if (enemy.encounterId !== encounter.id) {
      continue
    }
    enemy.phase = 'COLLAPSING'
    enemy.collapseRemainingMs = encounter.collapseRemainingMs
    beginCreatureCollapse(world, enemy)
  }
}

export function runDeathSystem(world: WorldState, deltaMs = 0): void {
  for (const enemy of world.enemies) {
    if (enemy.encounterId !== null) {
      continue
    }
    if (enemy.phase === 'COLLAPSING') {
      enemy.collapseRemainingMs = Math.max(
        0,
        enemy.collapseRemainingMs - deltaMs,
      )
      updateCreatureCollapsePresentation(world, enemy)
      if (enemy.collapseRemainingMs === 0) {
        if (
          hasPendingVolatileSourcesForOwner(world.volatileState, enemy.id)
        ) {
          continue
        }
        enemy.phase = 'DEAD'
        recordFormalKill(world.runStatistics)
      }
      continue
    }
    if (
      enemy.phase !== 'DEAD' &&
      world.glyphStore.isOwnerDepleted(enemy.id)
    ) {
      enemy.phase = 'COLLAPSING'
      enemy.collapseRemainingMs = enemy.collapseDurationMs
      beginCreatureCollapse(world, enemy)
    }
  }

  world.bossEncounters.forEach((encounter) => {
    resolveEncounterDeath(world, encounter, deltaMs)
  })
}
