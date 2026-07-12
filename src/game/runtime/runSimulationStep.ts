import { runCleanupSystem } from '../systems/cleanupSystem.ts'
import { runCollisionSystem } from '../systems/collisionSystem.ts'
import { runDirectorSystem } from '../systems/directorSystem.ts'
import { runDropSystem } from '../systems/dropSystem.ts'
import { runMovementSystem } from '../systems/movementSystem.ts'
import { runProjectileSystem } from '../systems/projectileSystem.ts'
import { runWeaponSystem } from '../systems/weaponSystem.ts'
import type { WorldState } from './worldState.ts'

export function runSimulationStep(world: WorldState, deltaMs: number): void {
  world.runTimeMs += deltaMs
  world.diagnostics.simulationStepCount += 1
  runMovementSystem(world, deltaMs)
  runDirectorSystem(world, deltaMs)
  runWeaponSystem(world, deltaMs)
  runProjectileSystem(world, deltaMs)
  runCollisionSystem(world)
  runDropSystem(world)
  runCleanupSystem(world)
}
