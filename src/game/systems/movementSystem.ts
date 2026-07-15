import { calculatePlayerMovementBounds } from '../runtime/cameraTransform.ts'
import { getCreatureDefinition } from '../content/gameContent.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { normalizeMovement } from './movementVector.ts'
import { runCreatureLayoutBehavior } from './creatureLayoutStrategies.ts'
import { runCreatureBodyMotionBehavior } from './creatureBodyMotionStrategies.ts'
import { runCreatureMovementBehavior } from './creatureMovementStrategies.ts'
import { hasCreatureFinishedReassembling } from './creatureReassembly.ts'

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum))
}

export function runMovementSystem(world: WorldState, deltaMs: number): void {
  const deltaSeconds = deltaMs / 1_000
  const movement = normalizeMovement(
    world.input.horizontal,
    world.input.vertical,
  )
  const player = world.player
  const playerBounds = calculatePlayerMovementBounds(
    world.viewportWidth,
    world.viewportHeight,
    GAME_CONFIG.worldWidth,
    GAME_CONFIG.worldHeight,
  )

  player.previousX = player.x
  player.previousY = player.y
  player.moveX = movement.x
  player.moveY = movement.y
  player.x = clamp(
    player.x + movement.x * GAME_CONFIG.playerSpeed * deltaSeconds,
    playerBounds.minX,
    playerBounds.maxX,
  )
  player.y = clamp(
    player.y + movement.y * GAME_CONFIG.playerSpeed * deltaSeconds,
    playerBounds.minY,
    playerBounds.maxY,
  )

  for (const enemy of world.enemies) {
    enemy.previousX = enemy.x
    enemy.previousY = enemy.y

    if (enemy.phase === 'MATERIALIZING') {
      enemy.materializeRemainingMs = Math.max(
        0,
        enemy.materializeRemainingMs - deltaMs,
      )

      if (enemy.materializeRemainingMs === 0) {
        enemy.phase = 'ACTIVE'
      }
      continue
    }

    if (enemy.phase === 'REASSEMBLING') {
      if (hasCreatureFinishedReassembling(world, enemy.id)) {
        enemy.phase = 'ACTIVE'
      } else {
        continue
      }
    }

    if (enemy.phase !== 'ACTIVE') {
      continue
    }

    const definition = getCreatureDefinition(world.content, enemy.definitionId)
    enemy.behaviorElapsedMs += deltaMs
    runCreatureMovementBehavior(world, enemy, definition, deltaMs)
    runCreatureLayoutBehavior(world, enemy, definition)
    runCreatureBodyMotionBehavior(world, enemy, definition)
  }
}
