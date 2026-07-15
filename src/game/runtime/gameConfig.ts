import { assertValidPlayerSurvivalConfig } from './playerSurvival.ts'

const gameConfig = {
  worldWidth: 4_000,
  worldHeight: 4_000,
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
  playerCollisionRadius: 14,
}

assertValidPlayerSurvivalConfig(gameConfig)

export const GAME_CONFIG = Object.freeze(gameConfig)
