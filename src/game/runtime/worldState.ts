import type { Bounds } from './cameraTransform.ts'
import {
  getWeaponDefinition,
  type PreparedGameContent,
} from '../content/gameContent.ts'
import type { CreatureDefinition } from '../content/creatures/creatureDefinition.ts'
import { createSeededRng, type SeededRng } from '../core/seededRng.ts'
import { createSpatialHash, type SpatialHash } from '../core/spatialHash.ts'
import { createGlyphStore, type GlyphStore } from '../glyph/glyphStore.ts'
import {
  createGlyphDamageQueue,
  createDamageResolutionScratch,
  type DamageResolutionScratch,
  type GlyphDamageQueue,
} from '../glyph/localDamage.ts'
import { GAME_CONFIG } from './gameConfig.ts'
import {
  createWeaponLoadout,
  equipWeapon,
  type WeaponLoadoutState,
} from './weaponLoadout.ts'
import type {
  BossEncounterState,
  DamageTransferLinkState,
  EnemyState,
  ExperienceDropState,
  FlameEmitterState,
  InputState,
  OrbitAttackState,
  PlayerState,
  ProjectileState,
  SpawnSide,
} from './worldEntities.ts'
import { createUpgradeState, type UpgradeState } from './upgradeState.ts'
import {
  createPlayerDamageStepOutcome,
  createPlayerSurvivalState,
  type PlayerDamageCandidate,
  type PlayerDamageStepOutcome,
} from './playerSurvival.ts'
import type { RunResult } from './runResult.ts'
import {
  createRunStatisticsState,
  synchronizeEquippedWeaponStatistics,
  type RunStatisticsState,
} from './runStatistics.ts'

export interface WorldDiagnostics {
  droppedSimulationTimeMs: number
  simulationStepCount: number
  enemyPoolMisses: number
  projectilePoolMisses: number
  dropPoolMisses: number
  targetSearchCount: number
  targetReacquireCount: number
  glyphPoolMisses: number
  flameEmitterPoolMisses: number
  healthyGlyphCount: number
  damagedGlyphCount: number
  huskGlyphCount: number
  spreadCandidateCount: number
  spreadPreciseTestCount: number
  damageClaimDedupCount: number
  damageTransferLinkDropCount: number
  attackEmissionCount: number
  rangeExpiredProjectileCount: number
  orbitSweepCandidateCount: number
  orbitSweepPreciseTestCount: number
}

export interface WorldState {
  readonly seed: string | number
  readonly content: PreparedGameContent
  readonly rng: SeededRng
  readonly player: PlayerState
  readonly weaponLoadout: WeaponLoadoutState
  readonly runStatistics: RunStatisticsState
  readonly upgradeState: UpgradeState
  readonly input: InputState
  readonly glyphStore: GlyphStore
  readonly glyphDamageQueue: GlyphDamageQueue
  readonly damageResolutionScratch: DamageResolutionScratch
  readonly damageCandidates: EnemyState[]
  readonly damageTransferLinks: DamageTransferLinkState[]
  readonly damageTransferLinkPool: DamageTransferLinkState[]
  readonly enemies: EnemyState[]
  readonly enemyPool: EnemyState[]
  readonly enemyById: Map<number, EnemyState>
  readonly bossEncounters: Map<number, BossEncounterState>
  readonly topologyDirtyOwnerIds: Set<number>
  readonly projectiles: ProjectileState[]
  readonly projectilePool: ProjectileState[]
  readonly drops: ExperienceDropState[]
  readonly dropPool: ExperienceDropState[]
  readonly flameEmitters: FlameEmitterState[]
  readonly flameEmitterPool: FlameEmitterState[]
  readonly orbitAttacks: OrbitAttackState[]
  readonly obstacles: Bounds[]
  readonly enemySpatialHash: SpatialHash<EnemyState>
  readonly collisionCandidates: EnemyState[]
  readonly playerContactCandidates: EnemyState[]
  readonly playerDamageCandidates: PlayerDamageCandidate[]
  readonly playerDamageStepOutcome: PlayerDamageStepOutcome
  readonly spawnCandidates: EnemyState[]
  readonly targetCandidates: EnemyState[]
  readonly diagnostics: WorldDiagnostics
  viewportWidth: number
  viewportHeight: number
  runTimeMs: number
  spawnCooldownMs: number
  nextEntityId: number
  nextFlameEmitterId: number
  nextOrbitAttackId: number
  nextDamageEventId: number
  nextDamageTransferLinkId: number
  nextPlayerDamageEventId: number
  playerDamageCandidateCount: number
  collectedXpThisStep: number
  targetSearchCursor: number
  activeEnemyCount: number
  ordinaryEnemySpawnCount: number
  maximumEnemyQueryRadius: number
  firstWaveStarted: boolean
  pendingBossSpawnSide: SpawnSide | null
  slimeBossSpawned: boolean
  runResult: Readonly<RunResult> | null
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
    xpIntoLevel: 0,
    level: 1,
    survival: createPlayerSurvivalState(GAME_CONFIG),
  }
}

export function createWorldState(
  seed: string | number,
  viewportWidth: number,
  viewportHeight: number,
  content: PreparedGameContent,
  initialWeaponDefinitionId: string,
  unlockedWeaponDefinitionIds: readonly string[] = content.weaponDefinitions.map(
    ({ id }) => id,
  ),
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
    flameEmitterPoolMisses: 0,
    healthyGlyphCount: 0,
    damagedGlyphCount: 0,
    huskGlyphCount: 0,
    spreadCandidateCount: 0,
    spreadPreciseTestCount: 0,
    damageClaimDedupCount: 0,
    damageTransferLinkDropCount: 0,
    attackEmissionCount: 0,
    rangeExpiredProjectileCount: 0,
    orbitSweepCandidateCount: 0,
    orbitSweepPreciseTestCount: 0,
  }
  const weaponLoadout = createWeaponLoadout(content.maximumEquippedWeapons)
  equipWeapon(
    weaponLoadout,
    getWeaponDefinition(content, initialWeaponDefinitionId),
  )
  const runStatistics = createRunStatisticsState()
  synchronizeEquippedWeaponStatistics(runStatistics, weaponLoadout)

  return {
    seed,
    content,
    rng: createSeededRng(seed),
    player: createPlayer(),
    weaponLoadout,
    runStatistics,
    upgradeState: createUpgradeState(seed, unlockedWeaponDefinitionIds),
    input: {
      horizontal: 0,
      vertical: 0,
      pointerScreenX: viewportWidth / 2,
      pointerScreenY: viewportHeight / 2,
      hasPointer: false,
      pointerRevision: 0,
    },
    glyphStore: createGlyphStore({
      visualTheme: content.combatVisualTheme,
      onPoolMiss: () => {
        diagnostics.glyphPoolMisses += 1
      },
    }),
    glyphDamageQueue: createGlyphDamageQueue(),
    damageResolutionScratch: createDamageResolutionScratch(),
    damageCandidates: [],
    damageTransferLinks: [],
    damageTransferLinkPool: [],
    enemies: [],
    enemyPool: [],
    enemyById: new Map(),
    bossEncounters: new Map(),
    topologyDirtyOwnerIds: new Set(),
    projectiles: [],
    projectilePool: [],
    drops: [],
    dropPool: [],
    flameEmitters: [],
    flameEmitterPool: [],
    orbitAttacks: [],
    obstacles: [],
    enemySpatialHash: createSpatialHash(GAME_CONFIG.spatialHashCellSize),
    collisionCandidates: [],
    playerContactCandidates: [],
    playerDamageCandidates: [],
    playerDamageStepOutcome: createPlayerDamageStepOutcome(),
    spawnCandidates: [],
    targetCandidates: [],
    diagnostics,
    viewportWidth,
    viewportHeight,
    runTimeMs: 0,
    spawnCooldownMs: 350,
    nextEntityId: 1,
    nextFlameEmitterId: 1,
    nextOrbitAttackId: 1,
    nextDamageEventId: 1,
    nextDamageTransferLinkId: 1,
    nextPlayerDamageEventId: 1,
    playerDamageCandidateCount: 0,
    collectedXpThisStep: 0,
    targetSearchCursor: 0,
    activeEnemyCount: 0,
    ordinaryEnemySpawnCount: 0,
    maximumEnemyQueryRadius: content.maximumEnemyBroadPhaseRadius,
    firstWaveStarted: false,
    pendingBossSpawnSide: null,
    slimeBossSpawned: false,
    runResult: null,
  }
}

export function getNextEntityId(world: WorldState): number {
  const id = world.nextEntityId
  world.nextEntityId += 1
  return id
}

export function getNextDamageEventId(world: WorldState): number {
  const id = world.nextDamageEventId
  world.nextDamageEventId += 1
  return id
}

export function getNextPlayerDamageEventId(world: WorldState): number {
  const id = world.nextPlayerDamageEventId
  world.nextPlayerDamageEventId += 1
  return id
}

function getBodyMotionPhaseOffset(entityId: number): number {
  return (Math.imul(entityId, 0x9e3779b1) >>> 0) / 0x1_0000_0000
}

export function spawnEnemy(
  world: WorldState,
  x: number,
  y: number,
  materializeDurationMs: number,
  definition: CreatureDefinition = world.content.ordinaryEnemyDefinitions[0],
): EnemyState {
  const enemy = world.enemyPool.pop()

  if (!enemy) {
    world.diagnostics.enemyPoolMisses += 1
  }

  const activeEnemy = enemy ?? ({} as EnemyState)
  const enemyId = getNextEntityId(world)
  const body = definition.body
  for (const slot of body.slots) {
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
      appearanceProfileId: definition.appearanceProfileId,
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
    bodyMotionPhaseOffset: getBodyMotionPhaseOffset(enemyId),
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
    bodyMotionPhaseOffset: getBodyMotionPhaseOffset(id),
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

export function spawnExperienceDrop(
  world: WorldState,
  x: number,
  y: number,
  value: number,
): ExperienceDropState {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('Experience reward must be finite and non-negative.')
  }
  const drop = world.dropPool.pop()

  if (!drop) {
    world.diagnostics.dropPoolMisses += 1
  }

  const activeDrop = drop ?? ({} as ExperienceDropState)
  Object.assign(activeDrop, {
    id: getNextEntityId(world),
    x,
    y,
    value,
    spawnedAtRunTimeMs: world.runTimeMs,
    isAlive: true,
  })
  world.drops.push(activeDrop)
  return activeDrop
}
