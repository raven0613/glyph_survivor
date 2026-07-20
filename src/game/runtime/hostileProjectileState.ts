import type { GlyphFontBankId } from '../glyph/glyphFontBank.ts'
import type { PlayerDamageRoute } from './playerSurvival.ts'

export const HOSTILE_PROJECTILE_PHASE = Object.freeze({
  STAGED_IN_RING: 'STAGED_IN_RING',
  ACTIVE: 'ACTIVE',
  DISSIPATING: 'DISSIPATING',
  SPENT: 'SPENT',
} as const)

export type HostileProjectilePhase =
  (typeof HOSTILE_PROJECTILE_PHASE)[keyof typeof HOSTILE_PROJECTILE_PHASE]

export interface HostileProjectileState {
  id: number
  eventId: number
  sourceOwnerId: number
  sourceEncounterId: number | null
  waveIndex: number
  waveSlotIndex: number
  phase: HostileProjectilePhase
  originX: number
  originY: number
  x: number
  y: number
  previousX: number
  previousY: number
  tangentX: number
  tangentY: number
  tangentRotation: number
  launchOffsetX: number
  launchOffsetY: number
  launchTangentX: number
  launchTangentY: number
  launchTangentRotation: number
  thetaRadians: number
  directionSign: -1 | 1
  travelledDistance: number
  previousTravelledDistance: number
  maximumTravelDistance: number
  flightSpeed: number
  spiralTightness: number
  initialRadius: number
  initialPhaseRadians: number
  collisionRadius: number
  pairSpacing: number
  damage: number
  damageRoute: PlayerDamageRoute
  leftGlyphFrame: number
  rightGlyphFrame: number
  fontBankId: GlyphFontBankId
  visualScale: number
  dissipationRemainingMs: number
  dissipationDurationMs: number
}

export interface HostileProjectileSweepSample {
  x: number
  y: number
  tangentX: number
  tangentY: number
  tangentRotation: number
}

export interface RhombusSpiralAttackState {
  readonly ownerId: number
  waveIndex: number
  phase: 'WAITING_FOR_FORMATION' | 'HOLDING_RING' | 'RELEASING'
  directionSign: -1 | 1
  nextSlotIndex: number
  timeUntilNextActionMs: number
  readonly waveProjectiles: HostileProjectileState[]
}
