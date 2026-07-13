import { runCleanupSystem } from '../systems/cleanupSystem.ts'
import { runAimSystem } from '../systems/aimSystem.ts'
import { runCollisionSystem } from '../systems/collisionSystem.ts'
import { runDamageSystem } from '../systems/damageSystem.ts'
import { runDeathSystem } from '../systems/deathSystem.ts'
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
import { runBossSpawnSystem } from '../systems/bossSpawnSystem.ts'
import { runGlyphMaterialSystem } from '../systems/glyphMaterialSystem.ts'
import { runGlyphDiagnosticsSystem } from '../systems/glyphDiagnosticsSystem.ts'
import { runSlimeSplitSystem } from '../systems/slimeSplitSystem.ts'
import type { WorldState } from './worldState.ts'

export function runSimulationStep(world: WorldState, deltaMs: number): void {
  world.runTimeMs += deltaMs
  world.diagnostics.simulationStepCount += 1
  runAimSystem(world)
  runMovementSystem(world, deltaMs)
  runGlyphMaterialSystem(world, deltaMs)
  runEnemySpatialIndexSystem(world)
  runDirectorSystem(world, deltaMs)
  runBossSpawnSystem(world)
  prepareProjectileTargetingSystem(world)
  runWeaponSystem(world, deltaMs)
  runProjectileTargetingSystem(world, deltaMs)
  runProjectileSystem(world, deltaMs)
  runCollisionSystem(world)
  runDamageSystem(world)
  runSlimeSplitSystem(world)
  runDeathSystem(world, deltaMs)
  runDropSystem(world)
  runCleanupSystem(world)
  runGlyphDiagnosticsSystem(world)
}
