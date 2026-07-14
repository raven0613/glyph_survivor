import type {
  ProjectileTrackingMode,
  ProjectileTrackingState,
} from '../content/weapons/projectileTracking.ts'
import type {
  DamageShapeId,
  DestructionProfileId,
} from '../content/weapons/weaponDefinition.ts'
import type { DamageTargetMode } from '../glyph/localDamage.ts'

export type EnemyPhase =
  | 'MATERIALIZING'
  | 'ACTIVE'
  | 'REASSEMBLING'
  | 'INACTIVE'
  | 'COLLAPSING'
  | 'DEAD'
export type SpawnSide = 'top' | 'right' | 'bottom' | 'left'
export type EnemyLayoutMode = 'AUTHORED' | 'COMPILED'
export type BossEncounterPhase = 'ACTIVE' | 'COLLAPSING' | 'DEFEATED'

export interface BossEncounterState {
  readonly id: number
  readonly rootBossId: number
  phase: BossEncounterPhase
  collapseRemainingMs: number
  collapseDurationMs: number
}

export interface PlayerState {
  x: number
  y: number
  previousX: number
  previousY: number
  moveX: number
  moveY: number
  aimX: number
  aimY: number
  lastProcessedPointerRevision: number
  xpIntoLevel: number
  level: number
}

export interface FlameEmitterState {
  id: number
  sourceWeaponInstanceId: number
  x: number
  y: number
  directionX: number
  directionY: number
  range: number
  fullAngleRadians: number
  durationMs: number
  remainingMs: number
  particleCount: number
  innerTint: number
  outerTint: number
  seed: number
}

export interface OrbitAttackState {
  id: number
  sourceWeaponInstanceId: number
  sourceEquipmentSlot: number
  ballIndex: number
  phaseRadians: number
  x: number
  y: number
  previousX: number
  previousY: number
  damageRadius: number
  damage: number
  rehitCooldownMs: number
  rootKnockbackDistance: number
  impactStrengthMultiplier: number
  glyphFrame: number
  visualScale: number
  visualAlpha: number
  visualTint: number
  readonly nextAllowedHitTimeByOwner: Map<number, number>
}

export interface EnemyState {
  id: number
  definitionId: string
  x: number
  y: number
  previousX: number
  previousY: number
  radius: number
  speed: number
  velocityX: number
  velocityY: number
  behaviorElapsedMs: number
  bodyMotionPhaseOffset: number
  layoutMode: EnemyLayoutMode
  phase: EnemyPhase
  materializeRemainingMs: number
  materializeDurationMs: number
  collapseRemainingMs: number
  collapseDurationMs: number
  rewardCommitted: boolean
  rewardEligible: boolean
  encounterId: number | null
  rootBossId: number | null
  splitReferenceCellCount: number
  trackingLoad: number
}

export interface ProjectileState {
  id: number
  sourceWeaponInstanceId: number
  x: number
  y: number
  previousX: number
  previousY: number
  velocityX: number
  velocityY: number
  radius: number
  damage: number
  impactStrengthMultiplier: number
  damageShapeKind: DamageShapeId
  damageTargetMode: DamageTargetMode
  destructionProfileId: DestructionProfileId
  lifetimeMs: number
  isAlive: boolean
  trackingMode: ProjectileTrackingMode
  trackingState: ProjectileTrackingState
  targetEnemyId: number | null
  launchDirectionX: number
  launchDirectionY: number
  trackingRange: number
  homingResponsiveness: number
  maximumCorrectionCos: number
  retargetIntervalMs: number
  nextTargetSearchTimeMs: number
  glyphFrame: number
  visualScale: number
  visualAlpha: number
  visualTint: number
}

export interface ExperienceDropState {
  id: number
  x: number
  y: number
  value: number
  isAlive: boolean
}

export interface InputState {
  horizontal: number
  vertical: number
  pointerScreenX: number
  pointerScreenY: number
  hasPointer: boolean
  pointerRevision: number
}

export function isEnemyCombatPhase(phase: EnemyPhase): boolean {
  return phase === 'ACTIVE' || phase === 'REASSEMBLING'
}

export function isEnemyOutlineCollisionPhase(phase: EnemyPhase): boolean {
  return isEnemyCombatPhase(phase) || phase === 'INACTIVE'
}
