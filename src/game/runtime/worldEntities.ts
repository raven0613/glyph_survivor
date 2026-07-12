import type {
  ProjectileTrackingMode,
  ProjectileTrackingState,
} from '../content/weapons/projectileTracking.ts'

export type EnemyPhase = 'MATERIALIZING' | 'ACTIVE' | 'DEAD'

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
  x: number
  y: number
  previousX: number
  previousY: number
  radius: number
  speed: number
  hp: number
  phase: EnemyPhase
  materializeRemainingMs: number
  materializeDurationMs: number
  rewardCommitted: boolean
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
