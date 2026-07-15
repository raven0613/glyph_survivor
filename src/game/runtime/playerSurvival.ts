import { normalizeNonNegativeGameplayNumber } from '../core/gameplayNumber.ts'

export const PLAYER_DAMAGE_ROUTE = Object.freeze({
  SHIELD_FIRST: 'SHIELD_FIRST',
  HEALTH_ONLY: 'HEALTH_ONLY',
} as const)

export type PlayerDamageRoute =
  (typeof PLAYER_DAMAGE_ROUTE)[keyof typeof PLAYER_DAMAGE_ROUTE]

export const PLAYER_DAMAGE_SOURCE_KIND = Object.freeze({
  CREATURE_CONTACT: 'CREATURE_CONTACT',
  ENEMY_PROJECTILE: 'ENEMY_PROJECTILE',
} as const)

export type PlayerDamageSourceKind =
  (typeof PLAYER_DAMAGE_SOURCE_KIND)[keyof typeof PLAYER_DAMAGE_SOURCE_KIND]

const PLAYER_DAMAGE_SOURCE_ORDINAL: Readonly<
  Record<PlayerDamageSourceKind, number>
> = Object.freeze({
  [PLAYER_DAMAGE_SOURCE_KIND.CREATURE_CONTACT]: 0,
  [PLAYER_DAMAGE_SOURCE_KIND.ENEMY_PROJECTILE]: 1,
})

export interface PlayerSurvivalConfig {
  readonly initialPlayerHealth: number
  readonly initialPlayerShieldLayers: number
  readonly shieldRechargeIntervalMs: number
  readonly playerDamageInvulnerabilityMs: number
  readonly playerCollisionRadius: number
}

export interface PlayerSurvivalState {
  currentHealth: number
  maximumHealth: number
  currentShieldLayers: number
  maximumShieldLayers: number
  readonly acceptedDamageEventIds: Set<number>
  lastAcceptedDamageAtMs: number | null
  damageInvulnerableUntilMs: number
  nextShieldRechargeAtMs: number | null
}

export interface PlayerDamageCandidate {
  eventId: number
  sourceKind: PlayerDamageSourceKind
  sourceId: number
  amount: number
  route: PlayerDamageRoute
}

export interface PlayerDamageStepOutcome {
  acceptedEventId: number | null
  acceptedSourceId: number | null
  healthDamageApplied: number
  shieldLayersConsumed: number
  shieldLayersRestored: number
  playerDied: boolean
}

function requireFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and positive.`)
  }
}

export function assertValidPlayerSurvivalConfig(
  config: Readonly<PlayerSurvivalConfig>,
): void {
  requireFinitePositive(config.initialPlayerHealth, 'initialPlayerHealth')
  if (
    !Number.isSafeInteger(config.initialPlayerShieldLayers) ||
    config.initialPlayerShieldLayers < 0
  ) {
    throw new RangeError(
      'initialPlayerShieldLayers must be a non-negative safe integer.',
    )
  }
  requireFinitePositive(
    config.shieldRechargeIntervalMs,
    'shieldRechargeIntervalMs',
  )
  requireFinitePositive(
    config.playerDamageInvulnerabilityMs,
    'playerDamageInvulnerabilityMs',
  )
  requireFinitePositive(config.playerCollisionRadius, 'playerCollisionRadius')
}

export function createPlayerSurvivalState(
  config: Readonly<PlayerSurvivalConfig>,
): PlayerSurvivalState {
  assertValidPlayerSurvivalConfig(config)
  return {
    currentHealth: config.initialPlayerHealth,
    maximumHealth: config.initialPlayerHealth,
    currentShieldLayers: config.initialPlayerShieldLayers,
    maximumShieldLayers: config.initialPlayerShieldLayers,
    acceptedDamageEventIds: new Set<number>(),
    lastAcceptedDamageAtMs: null,
    damageInvulnerableUntilMs: 0,
    nextShieldRechargeAtMs: null,
  }
}

export function createPlayerDamageStepOutcome(): PlayerDamageStepOutcome {
  return {
    acceptedEventId: null,
    acceptedSourceId: null,
    healthDamageApplied: 0,
    shieldLayersConsumed: 0,
    shieldLayersRestored: 0,
    playerDied: false,
  }
}

function resetOutcome(
  outcome: PlayerDamageStepOutcome,
  playerDied: boolean,
): void {
  outcome.acceptedEventId = null
  outcome.acceptedSourceId = null
  outcome.healthDamageApplied = 0
  outcome.shieldLayersConsumed = 0
  outcome.shieldLayersRestored = 0
  outcome.playerDied = playerDied
}

function isValidCandidate(
  candidate: Readonly<PlayerDamageCandidate>,
): boolean {
  return (
    Number.isSafeInteger(candidate.eventId) &&
    candidate.eventId > 0 &&
    Number.isSafeInteger(candidate.sourceId) &&
    candidate.sourceId > 0 &&
    Number.isFinite(candidate.amount) &&
    candidate.amount > 0 &&
    candidate.sourceKind in PLAYER_DAMAGE_SOURCE_ORDINAL &&
    (candidate.route === PLAYER_DAMAGE_ROUTE.SHIELD_FIRST ||
      candidate.route === PLAYER_DAMAGE_ROUTE.HEALTH_ONLY)
  )
}

function comesBefore(
  candidate: Readonly<PlayerDamageCandidate>,
  current: Readonly<PlayerDamageCandidate>,
): boolean {
  const sourceKindDifference =
    PLAYER_DAMAGE_SOURCE_ORDINAL[candidate.sourceKind] -
    PLAYER_DAMAGE_SOURCE_ORDINAL[current.sourceKind]
  if (sourceKindDifference !== 0) {
    return sourceKindDifference < 0
  }
  if (candidate.sourceId !== current.sourceId) {
    return candidate.sourceId < current.sourceId
  }
  return candidate.eventId < current.eventId
}

function findFirstCandidate(
  candidates: readonly Readonly<PlayerDamageCandidate>[],
  candidateCount: number,
  acceptedDamageEventIds: ReadonlySet<number>,
): Readonly<PlayerDamageCandidate> | null {
  let firstCandidate: Readonly<PlayerDamageCandidate> | null = null
  for (let index = 0; index < candidateCount; index += 1) {
    const candidate = candidates[index]
    if (
      isValidCandidate(candidate) &&
      !acceptedDamageEventIds.has(candidate.eventId) &&
      (!firstCandidate || comesBefore(candidate, firstCandidate))
    ) {
      firstCandidate = candidate
    }
  }
  return firstCandidate
}

function rechargeShield(
  state: PlayerSurvivalState,
  runTimeMs: number,
  config: Readonly<PlayerSurvivalConfig>,
  outcome: PlayerDamageStepOutcome,
): void {
  if (state.currentShieldLayers >= state.maximumShieldLayers) {
    state.nextShieldRechargeAtMs = null
    return
  }
  if (state.nextShieldRechargeAtMs === null) {
    state.nextShieldRechargeAtMs =
      runTimeMs + config.shieldRechargeIntervalMs
    return
  }
  while (
    state.currentShieldLayers < state.maximumShieldLayers &&
    runTimeMs >= state.nextShieldRechargeAtMs
  ) {
    state.currentShieldLayers += 1
    outcome.shieldLayersRestored += 1
    state.nextShieldRechargeAtMs += config.shieldRechargeIntervalMs
  }
  if (state.currentShieldLayers === state.maximumShieldLayers) {
    state.nextShieldRechargeAtMs = null
  }
}

/** Resolves one fixed step without allocating or consulting wall-clock time. */
export function resolvePlayerDamageStep(
  state: PlayerSurvivalState,
  candidates: readonly Readonly<PlayerDamageCandidate>[],
  candidateCount: number,
  runTimeMs: number,
  config: Readonly<PlayerSurvivalConfig>,
  outcome: PlayerDamageStepOutcome,
): void {
  if (
    !Number.isSafeInteger(candidateCount) ||
    candidateCount < 0 ||
    candidateCount > candidates.length
  ) {
    throw new RangeError('candidateCount is outside the candidate buffer.')
  }
  if (!Number.isFinite(runTimeMs) || runTimeMs < 0) {
    throw new RangeError('runTimeMs must be finite and non-negative.')
  }

  resetOutcome(outcome, state.currentHealth === 0)
  if (outcome.playerDied) {
    return
  }

  const candidate = findFirstCandidate(
    candidates,
    candidateCount,
    state.acceptedDamageEventIds,
  )
  if (!candidate || runTimeMs < state.damageInvulnerableUntilMs) {
    rechargeShield(state, runTimeMs, config, outcome)
    return
  }

  outcome.acceptedEventId = candidate.eventId
  outcome.acceptedSourceId = candidate.sourceId
  state.acceptedDamageEventIds.add(candidate.eventId)
  if (
    candidate.route === PLAYER_DAMAGE_ROUTE.SHIELD_FIRST &&
    state.currentShieldLayers > 0
  ) {
    state.currentShieldLayers -= 1
    outcome.shieldLayersConsumed = 1
  } else {
    const previousHealth = state.currentHealth
    state.currentHealth = normalizeNonNegativeGameplayNumber(
      Math.max(0, previousHealth - candidate.amount),
    )
    outcome.healthDamageApplied = previousHealth - state.currentHealth
  }

  state.lastAcceptedDamageAtMs = runTimeMs
  state.damageInvulnerableUntilMs =
    runTimeMs + config.playerDamageInvulnerabilityMs
  state.nextShieldRechargeAtMs =
    state.currentShieldLayers < state.maximumShieldLayers
      ? runTimeMs + config.shieldRechargeIntervalMs
      : null
  outcome.playerDied = state.currentHealth === 0
}
