import type { Bounds } from './cameraTransform.ts'
import type { PreparedGameContent } from '../content/gameContent.ts'
import type { CreatureDefinition } from '../content/creatures/creatureDefinition.ts'
import { createSeededRng, type SeededRng } from '../core/seededRng.ts'
import { createSpatialHash, type SpatialHash } from '../core/spatialHash.ts'
import { createGlyphStore, type GlyphStore } from '../glyph/glyphStore.ts'
import {
  getGlyphDurabilityTint,
  getGlyphMaterialDefinition,
} from '../glyph/glyphMaterial.ts'
import {
  createGlyphDamageQueue,
  type GlyphDamageQueue,
} from '../glyph/localDamage.ts'
import { GAME_CONFIG } from './gameConfig.ts'
import type { ProjectileTrackingProfile } from '../content/weapons/projectileTracking.ts'
import type {
  BossEncounterState,
  EnemyState,
  ExperienceDropState,
  InputState,
  PlayerState,
  ProjectileState,
  SpawnSide,
} from './worldEntities.ts'

export interface WorldDiagnostics {
  droppedSimulationTimeMs: number
  simulationStepCount: number
  enemyPoolMisses: number
  projectilePoolMisses: number
  dropPoolMisses: number
  targetSearchCount: number
  targetReacquireCount: number
  glyphPoolMisses: number
  healthyGlyphCount: number
  damagedGlyphCount: number
  huskGlyphCount: number
}

export interface WorldState {
  readonly seed: string | number
  readonly content: PreparedGameContent
  readonly rng: SeededRng
  readonly player: PlayerState
  readonly input: InputState
  readonly glyphStore: GlyphStore
  readonly glyphDamageQueue: GlyphDamageQueue
  readonly enemies: EnemyState[]
  readonly enemyPool: EnemyState[]
  readonly enemyById: Map<number, EnemyState>
  readonly bossEncounters: Map<number, BossEncounterState>
  readonly topologyDirtyOwnerIds: Set<number>
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
  maximumEnemyQueryRadius: number
  firstWaveStarted: boolean
  pendingBossSpawnSide: SpawnSide | null
  slimeBossSpawned: boolean
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
  content: PreparedGameContent,
): WorldState {
  const diagnostics: WorldDiagnostics = {
    droppedSimulationTimeMs: 0,
    simulationStepCount: 0,
    enemyPoolMisses: 0,
    projectilePoolMisses: 0,
    dropPoolMisses: 0,
    targetSearchCount: 0,
    targetReacquireCount: 0,
    glyphPoolMisses: 0,
    healthyGlyphCount: 0,
    damagedGlyphCount: 0,
    huskGlyphCount: 0,
  }

  return {
    seed,
    content,
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
    glyphStore: createGlyphStore({
      onPoolMiss: () => {
        diagnostics.glyphPoolMisses += 1
      },
    }),
    glyphDamageQueue: createGlyphDamageQueue(),
    enemies: [],
    enemyPool: [],
    enemyById: new Map(),
    bossEncounters: new Map(),
    topologyDirtyOwnerIds: new Set(),
    projectiles: [],
    projectilePool: [],
    drops: [],
    dropPool: [],
    obstacles: [],
    enemySpatialHash: createSpatialHash(GAME_CONFIG.spatialHashCellSize),
    collisionCandidates: [],
    spawnCandidates: [],
    targetCandidates: [],
    diagnostics,
    viewportWidth,
    viewportHeight,
    runTimeMs: 0,
    spawnCooldownMs: 350,
    weaponCooldownMs: 0,
    nextEntityId: 1,
    targetSearchCursor: 0,
    activeEnemyCount: 0,
    maximumEnemyQueryRadius: content.maximumEnemyBroadPhaseRadius,
    firstWaveStarted: false,
    pendingBossSpawnSide: null,
    slimeBossSpawned: false,
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
  definition: CreatureDefinition = world.content.ordinaryEnemyDefinition,
): EnemyState {
  const enemy = world.enemyPool.pop()

  if (!enemy) {
    world.diagnostics.enemyPoolMisses += 1
  }

  const activeEnemy = enemy ?? ({} as EnemyState)
  const enemyId = getNextEntityId(world)
  const body = definition.body
  for (const slot of body.slots) {
    const material = getGlyphMaterialDefinition(slot.material)
    world.glyphStore.createGlyph({
      ownerId: enemyId,
      bodySlotId: slot.slotId,
      character: slot.character,
      glyphFrame: slot.glyphFrame,
      baseCharacter: slot.baseCharacter,
      baseGlyphFrame: slot.baseGlyphFrame,
      role: slot.role,
      topologyX: slot.topologyX,
      topologyY: slot.topologyY,
      localX: slot.localX,
      localY: slot.localY,
      maxDurability: slot.maxDurability,
      collisionRadius: slot.collisionRadius,
      scale: slot.scale,
      material: slot.material,
      baseTint: getGlyphDurabilityTint(
        material,
        slot.maxDurability,
        slot.role,
      ),
    })
  }
  Object.assign(activeEnemy, {
    id: enemyId,
    definitionId: definition.id,
    x,
    y,
    previousX: x,
    previousY: y,
    radius: definition.broadPhaseRadius,
    speed: definition.maximumSpeed,
    velocityX: 0,
    velocityY: 0,
    behaviorElapsedMs: 0,
    layoutMode: 'AUTHORED' as const,
    phase: 'MATERIALIZING' as const,
    materializeRemainingMs: materializeDurationMs,
    materializeDurationMs,
    collapseRemainingMs: definition.collapseDurationMs,
    collapseDurationMs: definition.collapseDurationMs,
    rewardCommitted: false,
    rewardEligible: true,
    encounterId: definition.category === 'BOSS' ? enemyId : null,
    rootBossId: definition.category === 'BOSS' ? enemyId : null,
    splitReferenceCellCount:
      definition.category === 'BOSS' ? definition.body.slots.length : 0,
    trackingLoad: 0,
  })
  world.enemies.push(activeEnemy)
  world.enemyById.set(activeEnemy.id, activeEnemy)
  if (definition.category === 'BOSS') {
    world.bossEncounters.set(enemyId, {
      id: enemyId,
      rootBossId: enemyId,
      phase: 'ACTIVE',
      collapseRemainingMs: definition.collapseDurationMs,
      collapseDurationMs: definition.collapseDurationMs,
    })
  }
  return activeEnemy
}

/** Creates a new Creature owner for existing Glyphs without creating life. */
export function spawnSplitEnemy(
  world: WorldState,
  source: EnemyState,
  x: number,
  y: number,
): EnemyState {
  if (source.encounterId === null || source.rootBossId === null) {
    throw new Error(`Enemy ${source.id} does not belong to a Boss encounter.`)
  }

  const pooledEnemy = world.enemyPool.pop()
  if (!pooledEnemy) {
    world.diagnostics.enemyPoolMisses += 1
  }
  const enemy = pooledEnemy ?? ({} as EnemyState)
  const id = getNextEntityId(world)
  Object.assign(enemy, {
    id,
    definitionId: source.definitionId,
    x,
    y,
    previousX: x,
    previousY: y,
    radius: source.radius,
    speed: source.speed,
    velocityX: 0,
    velocityY: 0,
    behaviorElapsedMs: 0,
    layoutMode: 'COMPILED' as const,
    phase: 'REASSEMBLING' as const,
    materializeRemainingMs: 0,
    materializeDurationMs: 0,
    collapseRemainingMs: source.collapseDurationMs,
    collapseDurationMs: source.collapseDurationMs,
    rewardCommitted: true,
    rewardEligible: false,
    encounterId: source.encounterId,
    rootBossId: source.rootBossId,
    splitReferenceCellCount: source.splitReferenceCellCount,
    trackingLoad: 0,
  })
  world.enemies.push(enemy)
  world.enemyById.set(id, enemy)
  return enemy
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
