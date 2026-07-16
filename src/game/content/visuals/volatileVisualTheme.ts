import type {
  HexColor,
  VisualColor,
  VolatileEffectAppearance,
} from './combatVisualThemeTypes.ts'

interface VolatileThemeValidators {
  readonly validateColor: (color: VisualColor, name: string) => void
  readonly positive: (value: number, name: string) => void
  readonly range: (
    value: number,
    minimum: number,
    maximum: number,
    name: string,
  ) => void
}

export function prepareVolatileEffectAppearance(
  input: Readonly<VolatileEffectAppearance<HexColor>>,
  prepareColor: (
    color: VisualColor<HexColor>,
    name: string,
  ) => VisualColor,
): VolatileEffectAppearance {
  return {
    sourceClamp: { ...input.sourceClamp },
    release: {
      ...input.release,
      ...prepareColor(input.release, 'VOLATILE release'),
      characters: [...input.release.characters],
    },
    neighborJolt: { ...input.neighborJolt },
  }
}

export function validateAndFreezeVolatileEffectAppearance(
  input: Readonly<VolatileEffectAppearance>,
  validators: VolatileThemeValidators,
): Readonly<VolatileEffectAppearance> {
  for (const [name, beat] of [
    ['source clamp', input.sourceClamp],
    ['release', input.release],
    ['neighbor jolt', input.neighborJolt],
  ] as const) {
    validators.positive(beat.attackDurationMs, `VOLATILE ${name} attackDurationMs`)
    validators.positive(beat.holdDurationMs, `VOLATILE ${name} holdDurationMs`)
    validators.positive(beat.settleDurationMs, `VOLATILE ${name} settleDurationMs`)
  }
  validators.range(
    input.sourceClamp.minimumScale,
    0.1,
    0.99,
    'VOLATILE source minimumScale',
  )
  validators.validateColor(input.release, 'VOLATILE release')
  validators.range(input.release.delayMs, 0, 500, 'VOLATILE release delayMs')
  validators.positive(input.release.startDistance, 'VOLATILE startDistance')
  validators.positive(input.release.endDistance, 'VOLATILE endDistance')
  if (input.release.endDistance <= input.release.startDistance) {
    throw new RangeError('VOLATILE release must move outward.')
  }
  validators.positive(input.release.glyphScale, 'VOLATILE glyphScale')
  if (
    input.release.characters.length !== 4 ||
    input.release.characters.some((character) => character.length !== 1)
  ) {
    throw new TypeError(
      'VOLATILE release requires four single-glyph axis characters.',
    )
  }
  validators.range(
    input.neighborJolt.delayMs,
    0,
    500,
    'VOLATILE neighbor delayMs',
  )
  validators.positive(
    input.neighborJolt.maximumOffset,
    'VOLATILE neighbor maximumOffset',
  )
  validators.positive(
    input.neighborJolt.maximumRotation,
    'VOLATILE neighbor maximumRotation',
  )
  return Object.freeze({
    sourceClamp: Object.freeze({ ...input.sourceClamp }),
    release: Object.freeze({
      ...input.release,
      characters: Object.freeze([...input.release.characters]),
    }),
    neighborJolt: Object.freeze({ ...input.neighborJolt }),
  })
}
