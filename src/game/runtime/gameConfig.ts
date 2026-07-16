import { assertValidPlayerSurvivalConfig } from './playerSurvival.ts'
import { assertValidPlayerDeathReviewConfig } from './playerDeathReview.ts'
import { assertValidRunModifierConfig } from './runModifierConfig.ts'

const gameConfig = {
  worldWidth: 6_000,
  worldHeight: 6_000,
  fixedStepMs: 1_000 / 60,
  maxFrameDeltaMs: 100,
  maxStepsPerFrame: 5,
  playerSpeed: 260,
  enemySpeed: 72,
  spawnIntervalStartMs: 760,
  spawnIntervalMinimumMs: 260,
  spawnAttemptCount: 12,
  pickupRadius: 34,
  renderMargin: 120,
  spatialHashCellSize: 96,
  targetSearchBudgetPerStep: 64,
  initialPlayerHealth: 2,
  initialPlayerShieldLayers: 1,
  shieldRechargeIntervalMs: 4_000,
  playerDamageInvulnerabilityMs: 500,
  playerResumeInvulnerabilityMs: 500,
  playerCollisionRadius: 14,
  playerDeathFallDurationMs: 220,
  playerDeathGroundedDurationMs: 1_000,
  deathReviewEnemyWanderIntervalMs: 1_400,
  deathReviewEnemyWanderSpeedMultiplier: 0.42,
  deathReviewEnemyWanderTurnResponsiveness: 3.2,
  enableRunStartModifierOfferForTesting: false,
}

assertValidPlayerSurvivalConfig(gameConfig)
assertValidPlayerDeathReviewConfig(gameConfig)
assertValidRunModifierConfig(gameConfig)

export const GAME_CONFIG = Object.freeze(gameConfig)
