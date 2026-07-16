import type { DisconnectedEffectAppearance } from './combatVisualThemeTypes.ts'

interface DisconnectedThemeValidators {
  readonly positive: (value: number, name: string) => void
  readonly range: (
    value: number,
    minimum: number,
    maximum: number,
    name: string,
  ) => void
}

export function prepareDisconnectedEffectAppearance(
  input: Readonly<DisconnectedEffectAppearance>,
): DisconnectedEffectAppearance {
  return {
    ambient: { ...input.ambient },
    hitShake: { ...input.hitShake },
  }
}

function validateBeat(
  beat: Readonly<{
    attackDurationMs: number
    holdDurationMs: number
    settleDurationMs: number
  }>,
  name: string,
  positive: DisconnectedThemeValidators['positive'],
): void {
  positive(beat.attackDurationMs, `${name} attackDurationMs`)
  positive(beat.holdDurationMs, `${name} holdDurationMs`)
  positive(beat.settleDurationMs, `${name} settleDurationMs`)
}

export function validateAndFreezeDisconnectedEffectAppearance(
  input: Readonly<DisconnectedEffectAppearance>,
  validators: DisconnectedThemeValidators,
): Readonly<DisconnectedEffectAppearance> {
  validateBeat(input.ambient, 'DISCONNECTED ambient', validators.positive)
  validateBeat(input.hitShake, 'DISCONNECTED hitShake', validators.positive)
  validators.positive(input.ambient.intervalMs, 'DISCONNECTED ambient intervalMs')
  const burstDurationMs =
    input.ambient.attackDurationMs +
    input.ambient.holdDurationMs +
    input.ambient.settleDurationMs
  if (burstDurationMs / input.ambient.intervalMs > 0.15) {
    throw new RangeError(
      'DISCONNECTED ambient burst duty cycle must not exceed fifteen percent.',
    )
  }
  validators.positive(
    input.ambient.maximumSpacingOffset,
    'DISCONNECTED maximumSpacingOffset',
  )
  validators.positive(
    input.ambient.maximumJitterOffset,
    'DISCONNECTED maximumJitterOffset',
  )
  validators.positive(
    input.ambient.maximumRotation,
    'DISCONNECTED ambient maximumRotation',
  )
  validators.positive(
    input.hitShake.maximumOffset,
    'DISCONNECTED hitShake maximumOffset',
  )
  validators.range(
    input.hitShake.residualOffsetRatio,
    0,
    1,
    'DISCONNECTED hitShake residualOffsetRatio',
  )
  validators.positive(
    input.hitShake.maximumRotation,
    'DISCONNECTED hitShake maximumRotation',
  )
  return Object.freeze({
    ambient: Object.freeze({ ...input.ambient }),
    hitShake: Object.freeze({ ...input.hitShake }),
  })
}
