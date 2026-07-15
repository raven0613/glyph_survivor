export interface PlayerDeathReviewConfig {
  readonly playerDeathFallDurationMs: number
  readonly playerDeathGroundedDurationMs: number
  readonly deathReviewEnemyWanderIntervalMs: number
  readonly deathReviewEnemyWanderSpeedMultiplier: number
  readonly deathReviewEnemyWanderTurnResponsiveness: number
}

export interface PlayerDeathReviewState {
  active: boolean
  revision: number
  lethalPresentationRevision: number
  elapsedMs: number
  canEnterRunResult: boolean
}

function requireFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and positive.`)
  }
}

export function assertValidPlayerDeathReviewConfig(
  config: Readonly<PlayerDeathReviewConfig>,
): void {
  requireFinitePositive(
    config.playerDeathFallDurationMs,
    'playerDeathFallDurationMs',
  )
  requireFinitePositive(
    config.playerDeathGroundedDurationMs,
    'playerDeathGroundedDurationMs',
  )
  requireFinitePositive(
    config.deathReviewEnemyWanderIntervalMs,
    'deathReviewEnemyWanderIntervalMs',
  )
  requireFinitePositive(
    config.deathReviewEnemyWanderSpeedMultiplier,
    'deathReviewEnemyWanderSpeedMultiplier',
  )
  requireFinitePositive(
    config.deathReviewEnemyWanderTurnResponsiveness,
    'deathReviewEnemyWanderTurnResponsiveness',
  )
}

export function createPlayerDeathReviewState(): PlayerDeathReviewState {
  return {
    active: false,
    revision: 0,
    lethalPresentationRevision: 0,
    elapsedMs: 0,
    canEnterRunResult: false,
  }
}

export function beginPlayerDeathReview(
  state: PlayerDeathReviewState,
  lethalPresentationRevision: number,
): boolean {
  if (state.active) {
    return false
  }
  if (
    !Number.isSafeInteger(lethalPresentationRevision) ||
    lethalPresentationRevision <= 0
  ) {
    throw new RangeError(
      'lethalPresentationRevision must be a positive safe integer.',
    )
  }

  state.active = true
  state.revision += 1
  state.lethalPresentationRevision = lethalPresentationRevision
  state.elapsedMs = 0
  state.canEnterRunResult = false
  return true
}

export function advancePlayerDeathReview(
  state: PlayerDeathReviewState,
  deltaMs: number,
  config: Readonly<PlayerDeathReviewConfig>,
): boolean {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    throw new RangeError('death-review deltaMs must be finite and non-negative.')
  }
  if (!state.active || state.canEnterRunResult) {
    return false
  }

  state.elapsedMs += deltaMs
  const promptReadyAtMs =
    config.playerDeathFallDurationMs + config.playerDeathGroundedDurationMs
  if (state.elapsedMs < promptReadyAtMs) {
    return false
  }

  state.canEnterRunResult = true
  return true
}

export function getPlayerDeathFallProgress(
  state: Readonly<PlayerDeathReviewState>,
  config: Readonly<PlayerDeathReviewConfig>,
): number {
  if (!state.active) {
    return 0
  }
  return Math.min(1, state.elapsedMs / config.playerDeathFallDurationMs)
}

export function getDeathReviewPresentationTimeMs(
  runTimeMs: number,
  state: Readonly<PlayerDeathReviewState>,
): number {
  return runTimeMs + (state.active ? state.elapsedMs : 0)
}
