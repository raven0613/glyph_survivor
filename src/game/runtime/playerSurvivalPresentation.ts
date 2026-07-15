import type {
  PlayerDamageStepOutcome,
  PlayerSurvivalState,
} from './playerSurvival.ts'

export const PLAYER_SURVIVAL_PRESENTATION_EVENT = Object.freeze({
  HEALTH_DAMAGED: 'HEALTH_DAMAGED',
  SHIELD_HIT: 'SHIELD_HIT',
  SHIELD_DEPLETED: 'SHIELD_DEPLETED',
  SHIELD_RESTORED: 'SHIELD_RESTORED',
} as const)

export type PlayerSurvivalPresentationEventKind =
  (typeof PLAYER_SURVIVAL_PRESENTATION_EVENT)[keyof typeof PLAYER_SURVIVAL_PRESENTATION_EVENT]

export interface PlayerSurvivalPresentationState {
  eventRevision: number
  eventKind: PlayerSurvivalPresentationEventKind | null
  eventStartedAtMs: number
  eventSeed: number
}

export function createPlayerSurvivalPresentationState(
  initialShieldLayers: number,
): PlayerSurvivalPresentationState {
  const startsShielded = initialShieldLayers > 0
  return {
    eventRevision: startsShielded ? 1 : 0,
    eventKind: startsShielded
      ? PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_RESTORED
      : null,
    eventStartedAtMs: 0,
    eventSeed: startsShielded ? 1 : 0,
  }
}

function recordEvent(
  state: PlayerSurvivalPresentationState,
  kind: PlayerSurvivalPresentationEventKind,
  runTimeMs: number,
  eventSeed: number | null,
): void {
  state.eventRevision += 1
  state.eventKind = kind
  state.eventStartedAtMs = runTimeMs
  state.eventSeed = eventSeed ?? state.eventRevision
}

export function recordPlayerSurvivalPresentation(
  state: PlayerSurvivalPresentationState,
  survival: Readonly<PlayerSurvivalState>,
  outcome: Readonly<PlayerDamageStepOutcome>,
  runTimeMs: number,
): void {
  if (outcome.healthDamageApplied > 0) {
    recordEvent(
      state,
      PLAYER_SURVIVAL_PRESENTATION_EVENT.HEALTH_DAMAGED,
      runTimeMs,
      outcome.acceptedEventId,
    )
    return
  }
  if (outcome.shieldLayersConsumed > 0) {
    recordEvent(
      state,
      survival.currentShieldLayers > 0
        ? PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_HIT
        : PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_DEPLETED,
      runTimeMs,
      outcome.acceptedEventId,
    )
    return
  }
  const shieldGrewFromZero =
    outcome.shieldLayersRestored > 0 &&
    survival.currentShieldLayers === outcome.shieldLayersRestored
  if (shieldGrewFromZero) {
    recordEvent(
      state,
      PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_RESTORED,
      runTimeMs,
      null,
    )
  }
}
