import type { Bounds } from './cameraTransform.ts'
import { createSeededRng, type SeededRng } from '../core/seededRng.ts'
import { createSpatialHash, type SpatialHash } from '../core/spatialHash.ts'
import { GAME_CONFIG } from './gameConfig.ts'
import type { ProjectileTrackingProfile } from '../content/weapons/projectileTracking.ts'
import type {
  EnemyState,
  ExperienceDropState,
  InputState,
  PlayerState,
  ProjectileState,
} from './worldEntities.ts'

export interface WorldDiagnostics {
  droppedSimulationTimeMs: number
  simulationStepCount: number
  enemyPoolMisses: number
  projectilePoolMisses: number
  dropPoolMisses: number
  targetSearchCount: number
  targetReacquireCount: number
}

export interface WorldState {
  readonly seed: string | number
  readonly rng: SeededRng
  readonly player: PlayerState
  readonly input: InputState
  readonly enemies: EnemyState[]
  readonly enemyPool: EnemyState[]
  readonly enemyById: Map<number, EnemyState>
  readonly projectiles: ProjectileState[]
  readonly projectilePool: ProjectileState[]
  readonly drops: ExperienceDropState[]
  readonly dropPool: ExperienceDropState[]
  readonly obstacles: Bounds[]
  readonly enemySpatialHash: SpatialHash<EnemyState>
  readonly collisionCandidates: EnemyState[]
  readonly spawnCandidates: EnemyState[]
  readonly targetCandidates: EnemyState[]
  readonly diagnostics: WorldDiagnostics
  viewportWidth: number
  viewportHeight: number
  runTimeMs: number
  spawnCooldownMs: number
  weaponCooldownMs: number
  nextEntityId: number
  targetSearchCursor: number
  activeEnemyCount: number
}

function createPlayer(): PlayerState {
  const center = GAME_CONFIG.worldWidth / 2

  return {
    x: center,
    y: center,
    previousX: center,
    previousY: center,
    moveX: 0,
    moveY: 0,
    aimX: 1,
    aimY: 0,
    lastProcessedPointerRevision: 0,
    xp: 0,
    level: 1,
  }
}

export function createWorldState(
  seed: string | number,
  viewportWidth: number,
  viewportHeight: number,
): WorldState {
  return {
    seed,
    rng: createSeededRng(seed),
    player: createPlayer(),
    input: {
      horizontal: 0,
      vertical: 0,
      pointerScreenX: viewportWidth / 2,
      pointerScreenY: viewportHeight / 2,
      hasPointer: false,
      pointerRevision: 0,
    },
    enemies: [],
    enemyPool: [],
    enemyById: new Map(),
    projectiles: [],
    projectilePool: [],
    drops: [],
    dropPool: [],
    obstacles: [],
    enemySpatialHash: createSpatialHash(GAME_CONFIG.spatialHashCellSize),
    collisionCandidates: [],
    spawnCandidates: [],
    targetCandidates: [],
    diagnostics: {
      droppedSimulationTimeMs: 0,
      simulationStepCount: 0,
      enemyPoolMisses: 0,
      projectilePoolMisses: 0,
      dropPoolMisses: 0,
      targetSearchCount: 0,
      targetReacquireCount: 0,
    },
    viewportWidth,
    viewportHeight,
    runTimeMs: 0,
    spawnCooldownMs: 350,
    weaponCooldownMs: 0,
    nextEntityId: 1,
    targetSearchCursor: 0,
    activeEnemyCount: 0,
  }
}

function getNextEntityId(world: WorldState): number {
  const id = world.nextEntityId
  world.nextEntityId += 1
  return id
}

export function spawnEnemy(
  world: WorldState,
  x: number,
  y: number,
  materializeDurationMs: number,
): EnemyState {
  const enemy = world.enemyPool.pop()

  if (!enemy) {
    world.diagnostics.enemyPoolMisses += 1
  }

  const activeEnemy = enemy ?? ({} as EnemyState)
  Object.assign(activeEnemy, {
    id: getNextEntityId(world),
    x,
    y,
    previousX: x,
    previousY: y,
    radius: GAME_CONFIG.enemyRadius,
    speed: GAME_CONFIG.enemySpeed,
    hp: 1,
    phase: 'MATERIALIZING' as const,
    materializeRemainingMs: materializeDurationMs,
    materializeDurationMs,
    rewardCommitted: false,
    trackingLoad: 0,
  })
  world.enemies.push(activeEnemy)
  world.enemyById.set(activeEnemy.id, activeEnemy)
  return activeEnemy
}

export function spawnProjectile(
  world: WorldState,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  trackingProfile: ProjectileTrackingProfile,
  targetEnemyId: number | null,
): ProjectileState {
  const projectile = world.projectilePool.pop()

  if (!projectile) {
    world.diagnostics.projectilePoolMisses += 1
  }

  const activeProjectile = projectile ?? ({} as ProjectileState)
  Object.assign(activeProjectile, {
    id: getNextEntityId(world),
    x,
    y,
    previousX: x,
    previousY: y,
    velocityX: directionX * GAME_CONFIG.projectileSpeed,
    velocityY: directionY * GAME_CONFIG.projectileSpeed,
    radius: GAME_CONFIG.projectileRadius,
    damage: 1,
    lifetimeMs: GAME_CONFIG.projectileLifetimeMs,
    isAlive: true,
    trackingMode: trackingProfile.mode,
    trackingState:
      targetEnemyId !== null
        ? ('LOCKED' as const)
        : trackingProfile.mode === 'ASSISTED'
          ? ('BALLISTIC' as const)
          : ('SEEKING' as const),
    targetEnemyId,
    launchDirectionX: directionX,
    launchDirectionY: directionY,
    trackingRange: trackingProfile.range,
    homingResponsiveness: trackingProfile.responsiveness,
    maximumCorrectionCos: trackingProfile.maximumCorrectionCos,
    retargetIntervalMs: trackingProfile.retargetIntervalMs,
    nextTargetSearchTimeMs: world.runTimeMs,
  })
  world.projectiles.push(activeProjectile)
  return activeProjectile
}

export function spawnExperienceDrop(
  world: WorldState,
  x: number,
  y: number,
): ExperienceDropState {
  const drop = world.dropPool.pop()

  if (!drop) {
    world.diagnostics.dropPoolMisses += 1
  }

  const activeDrop = drop ?? ({} as ExperienceDropState)
  Object.assign(activeDrop, {
    id: getNextEntityId(world),
    x,
    y,
    value: 1,
    isAlive: true,
  })
  world.drops.push(activeDrop)
  return activeDrop
}
