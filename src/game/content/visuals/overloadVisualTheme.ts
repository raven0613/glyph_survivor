import type {
  HexColor,
  OverloadEffectAppearance,
  VisualColor,
} from './combatVisualThemeTypes.ts'

interface OverloadThemeValidators {
  readonly validateColor: (color: VisualColor, name: string) => void
  readonly positive: (value: number, name: string) => void
  readonly range: (
    value: number,
    minimum: number,
    maximum: number,
    name: string,
  ) => void
}

export function prepareOverloadEffectAppearance(
  input: Readonly<OverloadEffectAppearance<HexColor>>,
  prepareColor: (
    color: VisualColor<HexColor>,
    name: string,
  ) => VisualColor,
): OverloadEffectAppearance {
  return {
    compression: { ...input.compression },
    shockwave: {
      ...input.shockwave,
      ...prepareColor(input.shockwave, 'OVERLOAD shockwave'),
    },
    crackedSurface: {
      ...input.crackedSurface,
      fragmentBrightnessGains: [
        ...input.crackedSurface.fragmentBrightnessGains,
      ],
    },
  }
}

export function validateAndFreezeOverloadEffectAppearance(
  input: Readonly<OverloadEffectAppearance>,
  validators: OverloadThemeValidators,
): Readonly<OverloadEffectAppearance> {
  for (const [name, timing] of [
    ['compression', input.compression],
    ['shockwave', input.shockwave],
  ] as const) {
    validators.positive(timing.attackDurationMs, `${name} attackDurationMs`)
    validators.positive(timing.holdDurationMs, `${name} holdDurationMs`)
    validators.positive(timing.settleDurationMs, `${name} settleDurationMs`)
  }
  validators.range(
    input.compression.parallelScale,
    0.1,
    0.99,
    'OVERLOAD compression parallelScale',
  )
  validators.range(
    input.compression.perpendicularScale,
    1,
    1.5,
    'OVERLOAD compression perpendicularScale',
  )
  validators.validateColor(input.shockwave, 'OVERLOAD shockwave')
  validators.positive(input.shockwave.startRadius, 'OVERLOAD startRadius')
  validators.positive(input.shockwave.endRadius, 'OVERLOAD endRadius')
  if (input.shockwave.endRadius <= input.shockwave.startRadius) {
    throw new RangeError('OVERLOAD shockwave must expand outward.')
  }
  if (
    !Number.isSafeInteger(input.shockwave.particleCount) ||
    input.shockwave.particleCount < 4 ||
    input.shockwave.particleCount > 12
  ) {
    throw new RangeError(
      'OVERLOAD shockwave particleCount must be an integer from 4 to 12.',
    )
  }
  validators.positive(input.shockwave.glyphScale, 'OVERLOAD glyphScale')
  if (
    input.shockwave.characters.length === 0 ||
    input.shockwave.characters.some((character) => character.length !== 1)
  ) {
    throw new TypeError('OVERLOAD shockwave characters must be single glyphs.')
  }
  validators.range(
    input.crackedSurface.alphaMultiplier,
    0,
    1,
    'CRACKED alphaMultiplier',
  )
  validators.positive(
    input.crackedSurface.maximumFragmentOffset,
    'CRACKED maximumFragmentOffset',
  )
  validators.positive(
    input.crackedSurface.maximumFragmentRotation,
    'CRACKED maximumFragmentRotation',
  )
  if (input.crackedSurface.fragmentBrightnessGains.length !== 3) {
    throw new RangeError('CRACKED requires three fragment brightness gains.')
  }
  input.crackedSurface.fragmentBrightnessGains.forEach((gain, index) =>
    validators.positive(gain, `CRACKED fragmentBrightnessGains[${index}]`),
  )

  return Object.freeze({
    compression: Object.freeze({ ...input.compression }),
    shockwave: Object.freeze({
      ...input.shockwave,
      characters: Object.freeze([...input.shockwave.characters]),
    }),
    crackedSurface: Object.freeze({
      ...input.crackedSurface,
      fragmentBrightnessGains: Object.freeze([
        ...input.crackedSurface.fragmentBrightnessGains,
      ]),
    }),
  })
}
