import type {
  ProjectileTrackingMode,
  ProjectileTrackingState,
} from '../content/weapons/projectileTracking.ts'

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
  xp: number
  level: number
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
  x: number
  y: number
  previousX: number
  previousY: number
  velocityX: number
  velocityY: number
  radius: number
  damage: number
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
