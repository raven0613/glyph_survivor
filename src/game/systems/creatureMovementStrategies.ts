import {
  CREATURE_MOVEMENT_BEHAVIOR,
  type CreatureDefinition,
  type CreatureMovementBehaviorId,
} from '../content/creatures/creatureDefinition.ts'
import type { EnemyState } from '../runtime/worldEntities.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { normalizeMovement } from './movementVector.ts'

type CreatureMovementStrategy = (
  world: WorldState,
  enemy: EnemyState,
  definition: CreatureDefinition,
  deltaSeconds: number,
) => void

const directPursuit: CreatureMovementStrategy = (
  world,
  enemy,
  definition,
  deltaSeconds,
) => {
  const direction = normalizeMovement(
    world.player.x - enemy.x,
    world.player.y - enemy.y,
  )
  enemy.velocityX = direction.x * definition.maximumSpeed
  enemy.velocityY = direction.y * definition.maximumSpeed
  enemy.x += enemy.velocityX * deltaSeconds
  enemy.y += enemy.velocityY * deltaSeconds
}

const dampedPursuit: CreatureMovementStrategy = (
  world,
  enemy,
  definition,
  deltaSeconds,
) => {
  const direction = normalizeMovement(
    world.player.x - enemy.x,
    world.player.y - enemy.y,
  )
  const targetVelocityX = direction.x * definition.maximumSpeed
  const targetVelocityY = direction.y * definition.maximumSpeed
  const response = 1 - Math.exp(-definition.movementResponsiveness * deltaSeconds)
  enemy.velocityX += (targetVelocityX - enemy.velocityX) * response
  enemy.velocityY += (targetVelocityY - enemy.velocityY) * response
  enemy.x += enemy.velocityX * deltaSeconds
  enemy.y += enemy.velocityY * deltaSeconds
}

const MOVEMENT_STRATEGIES: Readonly<
  Record<CreatureMovementBehaviorId, CreatureMovementStrategy>
> = Object.freeze({
  [CREATURE_MOVEMENT_BEHAVIOR.DIRECT_PURSUIT]: directPursuit,
  [CREATURE_MOVEMENT_BEHAVIOR.DAMPED_PURSUIT]: dampedPursuit,
})

export function runCreatureMovementBehavior(
  world: WorldState,
  enemy: EnemyState,
  definition: CreatureDefinition,
  deltaMs: number,
): void {
  MOVEMENT_STRATEGIES[definition.movementBehaviorId](
    world,
    enemy,
    definition,
    deltaMs / 1_000,
  )
}
