import { runCleanupSystem } from '../systems/cleanupSystem.ts'
import { runCollisionSystem } from '../systems/collisionSystem.ts'
import { runDirectorSystem } from '../systems/directorSystem.ts'
import { runDropSystem } from '../systems/dropSystem.ts'
import { runEnemySpatialIndexSystem } from '../systems/enemySpatialIndexSystem.ts'
import { runMovementSystem } from '../systems/movementSystem.ts'
import { runProjectileSystem } from '../systems/projectileSystem.ts'
import {
  prepareProjectileTargetingSystem,
  runProjectileTargetingSystem,
} from '../systems/projectileTargetingSystem.ts'
import { runWeaponSystem } from '../systems/weaponSystem.ts'
import type { WorldState } from './worldState.ts'

export function runSimulationStep(world: WorldState, deltaMs: number): void {
  world.runTimeMs += deltaMs
  world.diagnostics.simulationStepCount += 1
  runMovementSystem(world, deltaMs)
  runEnemySpatialIndexSystem(world)
  runDirectorSystem(world, deltaMs)
  prepareProjectileTargetingSystem(world)
  runWeaponSystem(world, deltaMs)
  runProjectileTargetingSystem(world, deltaMs)
  runProjectileSystem(world, deltaMs)
  runCollisionSystem(world)
  runDropSystem(world)
  runCleanupSystem(world)
}
