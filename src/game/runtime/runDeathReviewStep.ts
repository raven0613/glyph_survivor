import { runCleanupSystem } from '../systems/cleanupSystem.ts'
import { runDeathReviewCollapseSystem } from '../systems/deathReviewCollapseSystem.ts'
import { runDeathReviewMovementSystem } from '../systems/deathReviewMovementSystem.ts'
import { runFlamePresentationSystem } from '../systems/flamePresentationSystem.ts'
import { runGlyphMaterialSystem } from '../systems/glyphMaterialSystem.ts'
import { GAME_CONFIG } from './gameConfig.ts'
import {
  advancePlayerDeathReview,
  beginPlayerDeathReview,
} from './playerDeathReview.ts'
import type { WorldState } from './worldState.ts'

export function beginWorldDeathReview(world: WorldState): boolean {
  const started = beginPlayerDeathReview(
    world.deathReview,
    world.player.survivalPresentation.eventRevision,
  )
  if (!started) {
    return false
  }

  world.player.previousX = world.player.x
  world.player.previousY = world.player.y
  world.player.moveX = 0
  world.player.moveY = 0
  world.playerDamageCandidateCount = 0
  world.playerDamageCandidates.length = 0
  world.collectedXpThisStep = 0
  for (const projectile of world.projectiles) {
    projectile.isAlive = false
  }
  world.orbitAttacks.length = 0
  return true
}

/** Runs the bounded, presentation-preserving scheduler for death review. */
export function runDeathReviewStep(
  world: WorldState,
  deltaMs: number,
): boolean {
  if (!world.deathReview.active) {
    return false
  }

  const becameReady = advancePlayerDeathReview(
    world.deathReview,
    deltaMs,
    GAME_CONFIG,
  )
  runGlyphMaterialSystem(world, deltaMs)
  runFlamePresentationSystem(world, deltaMs)
  runDeathReviewMovementSystem(world, deltaMs, GAME_CONFIG)
  runDeathReviewCollapseSystem(world, deltaMs)
  runCleanupSystem(world)
  return becameReady
}
