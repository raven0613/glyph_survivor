export interface SurvivalVisualColor<ColorValue = number> {
  readonly tint: ColorValue
  readonly alpha: number
}

export interface PlayerSurvivalVisualTheme<ColorValue = number> {
  readonly healthDamage: {
    readonly flash: SurvivalVisualColor<ColorValue>
    readonly durationMs: number
    readonly pulseCount: number
    readonly shakeDistance: number
    readonly shakeCycles: number
    readonly shakeVerticalRatio: number
    readonly fragment: SurvivalVisualColor<ColorValue>
    readonly fragmentCount: number
    readonly fragmentDurationMs: number
    readonly fragmentStaggerMs: number
    readonly fragmentMinimumDistance: number
    readonly fragmentMaximumDistance: number
    readonly fragmentScale: number
  }
  readonly shield: {
    readonly base: SurvivalVisualColor<ColorValue>
    readonly glow: SurvivalVisualColor<ColorValue>
    readonly glyphOffsetX: number
    readonly glyphScale: number
    readonly glowRadiusX: number
    readonly glowRadiusY: number
    readonly glowBlurStrength: number
    readonly glowBlurQuality: number
    readonly glowBlurKernelSize: number
    readonly glowBlurResolution: number
    readonly glowBlurPadding: number
    readonly hitShakeDurationMs: number
    readonly hitShakeDistance: number
    readonly hitShakeCycles: number
    readonly hitShakeVerticalRatio: number
    readonly depletionFadeDurationMs: number
    readonly depletionOffsetDistance: number
    readonly restoreDurationMs: number
    readonly restoreOvershoot: number
  }
}

type PrepareColor<AuthoringColor> = (
  color: SurvivalVisualColor<AuthoringColor>,
  name: string,
) => SurvivalVisualColor

export function preparePlayerSurvivalVisualTheme<AuthoringColor>(
  input: PlayerSurvivalVisualTheme<AuthoringColor>,
  prepareColor: PrepareColor<AuthoringColor>,
): PlayerSurvivalVisualTheme {
  return {
    healthDamage: {
      ...input.healthDamage,
      flash: prepareColor(input.healthDamage.flash, 'health damage flash'),
      fragment: prepareColor(
        input.healthDamage.fragment,
        'health damage fragment',
      ),
    },
    shield: {
      ...input.shield,
      base: prepareColor(input.shield.base, 'shield base'),
      glow: prepareColor(input.shield.glow, 'shield glow'),
    },
  }
}

export interface PlayerSurvivalVisualValidators {
  validateColor(color: SurvivalVisualColor, name: string): void
  positive(value: number, name: string): void
  range(value: number, minimum: number, maximum: number, name: string): void
}

export function validateAndFreezePlayerSurvivalVisualTheme(
  input: PlayerSurvivalVisualTheme,
  validators: PlayerSurvivalVisualValidators,
): PlayerSurvivalVisualTheme {
  const health = input.healthDamage
  const shield = input.shield
  validators.validateColor(health.flash, 'health damage flash')
  validators.validateColor(health.fragment, 'health damage fragment')
  validators.positive(health.durationMs, 'health damage durationMs')
  validators.positive(health.pulseCount, 'health damage pulseCount')
  validators.positive(health.shakeDistance, 'health damage shakeDistance')
  validators.positive(health.shakeCycles, 'health damage shakeCycles')
  validators.range(
    health.shakeVerticalRatio,
    0,
    1,
    'health damage shakeVerticalRatio',
  )
  if (!Number.isSafeInteger(health.fragmentCount) || health.fragmentCount < 0) {
    throw new RangeError(
      'health damage fragmentCount must be a non-negative safe integer.',
    )
  }
  validators.positive(
    health.fragmentDurationMs,
    'health damage fragmentDurationMs',
  )
  validators.range(
    health.fragmentStaggerMs,
    0,
    health.fragmentDurationMs,
    'health damage fragmentStaggerMs',
  )
  validators.range(
    health.fragmentMinimumDistance,
    0,
    health.fragmentMaximumDistance,
    'health damage fragmentMinimumDistance',
  )
  validators.positive(
    health.fragmentMaximumDistance,
    'health damage fragmentMaximumDistance',
  )
  validators.positive(health.fragmentScale, 'health damage fragmentScale')

  validators.validateColor(shield.base, 'shield base')
  validators.validateColor(shield.glow, 'shield glow')
  validators.positive(shield.glyphOffsetX, 'shield glyphOffsetX')
  validators.positive(shield.glyphScale, 'shield glyphScale')
  validators.positive(shield.glowRadiusX, 'shield glowRadiusX')
  validators.positive(shield.glowRadiusY, 'shield glowRadiusY')
  validators.positive(shield.glowBlurStrength, 'shield glowBlurStrength')
  if (
    !Number.isSafeInteger(shield.glowBlurQuality) ||
    shield.glowBlurQuality < 1 ||
    shield.glowBlurQuality > 4
  ) {
    throw new RangeError(
      'shield glowBlurQuality must be a safe integer between 1 and 4.',
    )
  }
  if (![5, 7, 9, 11, 13, 15].includes(shield.glowBlurKernelSize)) {
    throw new RangeError(
      'shield glowBlurKernelSize must be one of 5, 7, 9, 11, 13, or 15.',
    )
  }
  validators.range(
    shield.glowBlurResolution,
    0.25,
    1,
    'shield glowBlurResolution',
  )
  validators.positive(shield.glowBlurPadding, 'shield glowBlurPadding')
  validators.positive(shield.hitShakeDurationMs, 'shield hitShakeDurationMs')
  validators.positive(shield.hitShakeDistance, 'shield hitShakeDistance')
  validators.positive(shield.hitShakeCycles, 'shield hitShakeCycles')
  validators.range(
    shield.hitShakeVerticalRatio,
    0,
    1,
    'shield hitShakeVerticalRatio',
  )
  validators.positive(
    shield.depletionFadeDurationMs,
    'shield depletionFadeDurationMs',
  )
  validators.positive(
    shield.depletionOffsetDistance,
    'shield depletionOffsetDistance',
  )
  validators.positive(shield.restoreDurationMs, 'shield restoreDurationMs')
  validators.range(shield.restoreOvershoot, 0, 0.5, 'shield restoreOvershoot')

  return Object.freeze({
    healthDamage: Object.freeze({
      ...health,
      flash: Object.freeze({ ...health.flash }),
      fragment: Object.freeze({ ...health.fragment }),
    }),
    shield: Object.freeze({
      ...shield,
      base: Object.freeze({ ...shield.base }),
      glow: Object.freeze({ ...shield.glow }),
    }),
  })
}
