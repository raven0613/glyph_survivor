import { getCreatureDefinition } from '../content/gameContent.ts'
import type { PlayerDeathReviewConfig } from '../runtime/playerDeathReview.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import type { EnemyState } from '../runtime/worldEntities.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { runCreatureBodyMotionBehavior } from './creatureBodyMotionStrategies.ts'
import { runCreatureLayoutBehavior } from './creatureLayoutStrategies.ts'
import { hasCreatureFinishedReassembling } from './creatureReassembly.ts'

const UINT_RANGE = 0x1_0000_0000
const FULL_TURN_RADIANS = Math.PI * 2

function mixUint(value: number): number {
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return (value ^ (value >>> 15)) >>> 0
}

function sampleUnit(seedHash: number, enemyId: number, ordinal: number): number {
  const value =
    seedHash ^
    Math.imul(enemyId, 0x9e3779b1) ^
    Math.imul(ordinal + 1, 0x85ebca6b)
  return mixUint(value) / UINT_RANGE
}

function getWanderOrdinal(
  world: Readonly<WorldState>,
  enemy: Readonly<EnemyState>,
  intervalMs: number,
): number {
  const staggerMs = sampleUnit(world.seedHash, enemy.id, -1) * intervalMs
  return Math.floor((world.deathReview.elapsedMs + staggerMs) / intervalMs)
}

function keepEnemyInsideWorld(
  enemy: EnemyState,
  worldWidth: number,
  worldHeight: number,
): void {
  const minimumX = enemy.radius
  const maximumX = Math.max(minimumX, worldWidth - enemy.radius)
  const minimumY = enemy.radius
  const maximumY = Math.max(minimumY, worldHeight - enemy.radius)

  if (enemy.x < minimumX) {
    enemy.x = minimumX
    enemy.velocityX = Math.abs(enemy.velocityX)
  } else if (enemy.x > maximumX) {
    enemy.x = maximumX
    enemy.velocityX = -Math.abs(enemy.velocityX)
  }
  if (enemy.y < minimumY) {
    enemy.y = minimumY
    enemy.velocityY = Math.abs(enemy.velocityY)
  } else if (enemy.y > maximumY) {
    enemy.y = maximumY
    enemy.velocityY = -Math.abs(enemy.velocityY)
  }
}

export function runDeathReviewMovementSystem(
  world: WorldState,
  deltaMs: number,
  config: Readonly<PlayerDeathReviewConfig>,
): void {
  const deltaSeconds = deltaMs / 1_000
  const response =
    1 -
    Math.exp(-config.deathReviewEnemyWanderTurnResponsiveness * deltaSeconds)

  for (const enemy of world.enemies) {
    enemy.previousX = enemy.x
    enemy.previousY = enemy.y

    if (enemy.phase === 'MATERIALIZING') {
      enemy.materializeRemainingMs = Math.max(
        0,
        enemy.materializeRemainingMs - deltaMs,
      )
      if (enemy.materializeRemainingMs > 0) {
        continue
      }
      enemy.phase = 'ACTIVE'
    }

    if (enemy.phase === 'REASSEMBLING') {
      if (!hasCreatureFinishedReassembling(world, enemy.id)) {
        continue
      }
      enemy.phase = 'ACTIVE'
    }

    if (enemy.phase !== 'ACTIVE') {
      continue
    }

    const definition = getCreatureDefinition(world.content, enemy.definitionId)
    const ordinal = getWanderOrdinal(
      world,
      enemy,
      config.deathReviewEnemyWanderIntervalMs,
    )
    const angle =
      sampleUnit(world.seedHash, enemy.id, ordinal) * FULL_TURN_RADIANS
    const targetSpeed =
      definition.maximumSpeed * config.deathReviewEnemyWanderSpeedMultiplier
    const targetVelocityX = Math.cos(angle) * targetSpeed
    const targetVelocityY = Math.sin(angle) * targetSpeed
    enemy.velocityX += (targetVelocityX - enemy.velocityX) * response
    enemy.velocityY += (targetVelocityY - enemy.velocityY) * response
    enemy.x += enemy.velocityX * deltaSeconds
    enemy.y += enemy.velocityY * deltaSeconds
    keepEnemyInsideWorld(enemy, GAME_CONFIG.worldWidth, GAME_CONFIG.worldHeight)
    enemy.behaviorElapsedMs += deltaMs
    runCreatureLayoutBehavior(world, enemy, definition)
    runCreatureBodyMotionBehavior(world, enemy, definition, deltaMs)
  }
}
