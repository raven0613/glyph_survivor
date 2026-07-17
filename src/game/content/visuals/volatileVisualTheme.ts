import type {
  EffectBeatTiming,
  HexColor,
  VisualColor,
  VolatileClusterBurstAppearance,
  VolatileEffectAppearance,
} from './combatVisualThemeTypes.ts'

const PRINTABLE_ASCII_PATTERN = /^[ -~]$/
const MAXIMUM_CLUSTER_COUNT = 8
const MAXIMUM_POINTS_PER_CLUSTER = 12
const MAXIMUM_ACTIVE_POINT_COUNT = 20_000

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
  const clusterBurst = input.clusterBurst
  return {
    sourceClamp: { ...input.sourceClamp },
    release: {
      ...input.release,
      ...prepareColor(input.release, 'VOLATILE release'),
      characters: [...input.release.characters],
    },
    neighborJolt: { ...input.neighborJolt },
    clusterBurst: {
      ...clusterBurst,
      ...prepareColor(clusterBurst, 'VOLATILE cluster burst'),
      characters: [...clusterBurst.characters],
      centerHighlight: {
        ...clusterBurst.centerHighlight,
        ...prepareColor(
          clusterBurst.centerHighlight,
          'VOLATILE center highlight',
        ),
      },
    },
  }
}

function getBeatDurationMs(timing: Readonly<EffectBeatTiming>): number {
  return (
    timing.attackDurationMs +
    timing.holdDurationMs +
    timing.settleDurationMs
  )
}

export function getVolatileEffectDurationMs(
  profile: Readonly<VolatileEffectAppearance>,
): number {
  return Math.max(
    getBeatDurationMs(profile.sourceClamp),
    profile.release.delayMs + getBeatDurationMs(profile.release),
    profile.neighborJolt.delayMs + getBeatDurationMs(profile.neighborJolt),
    profile.clusterBurst.maximumSpawnStaggerMs +
      getBeatDurationMs(profile.clusterBurst) +
      profile.clusterBurst.maximumLifetimeVariationMs,
    profile.clusterBurst.centerHighlight.delayMs +
      getBeatDurationMs(profile.clusterBurst.centerHighlight),
  )
}

function validatePositiveInteger(
  value: number,
  maximum: number,
  name: string,
): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new RangeError(
      `${name} must be a positive integer no greater than ${maximum}.`,
    )
  }
}

function validateCharacterSet(
  characters: readonly string[],
  name: string,
): void {
  if (
    characters.length === 0 ||
    characters.some((character) => !PRINTABLE_ASCII_PATTERN.test(character))
  ) {
    throw new TypeError(`${name} must contain single Printable ASCII glyphs.`)
  }
}

function validateClusterBurst(
  input: Readonly<VolatileClusterBurstAppearance>,
  validators: VolatileThemeValidators,
): void {
  validators.validateColor(input, 'VOLATILE cluster burst')
  validators.validateColor(
    input.centerHighlight,
    'VOLATILE center highlight',
  )
  for (const [name, timing] of [
    ['cluster burst', input],
    ['center highlight', input.centerHighlight],
  ] as const) {
    validators.positive(timing.attackDurationMs, `${name} attackDurationMs`)
    validators.positive(timing.holdDurationMs, `${name} holdDurationMs`)
    validators.positive(timing.settleDurationMs, `${name} settleDurationMs`)
  }
  validators.range(
    input.maximumSpawnStaggerMs,
    0,
    500,
    'VOLATILE maximumSpawnStaggerMs',
  )
  validators.range(
    input.maximumLifetimeVariationMs,
    0,
    500,
    'VOLATILE maximumLifetimeVariationMs',
  )
  validatePositiveInteger(
    input.minimumClusterCount,
    MAXIMUM_CLUSTER_COUNT,
    'VOLATILE minimumClusterCount',
  )
  validatePositiveInteger(
    input.maximumClusterCount,
    MAXIMUM_CLUSTER_COUNT,
    'VOLATILE maximumClusterCount',
  )
  validatePositiveInteger(
    input.minimumPointsPerCluster,
    MAXIMUM_POINTS_PER_CLUSTER,
    'VOLATILE minimumPointsPerCluster',
  )
  validatePositiveInteger(
    input.maximumPointsPerCluster,
    MAXIMUM_POINTS_PER_CLUSTER,
    'VOLATILE maximumPointsPerCluster',
  )
  if (input.minimumClusterCount > input.maximumClusterCount) {
    throw new RangeError('VOLATILE cluster count range is reversed.')
  }
  if (input.minimumPointsPerCluster > input.maximumPointsPerCluster) {
    throw new RangeError('VOLATILE point count range is reversed.')
  }
  validators.range(
    input.minimumClusterCenterDistance,
    0,
    Number.MAX_SAFE_INTEGER,
    'VOLATILE minimumClusterCenterDistance',
  )
  validators.positive(
    input.maximumClusterCenterDistance,
    'VOLATILE maximumClusterCenterDistance',
  )
  if (
    input.minimumClusterCenterDistance > input.maximumClusterCenterDistance
  ) {
    throw new RangeError('VOLATILE cluster center distance range is reversed.')
  }
  validators.range(
    input.maximumClusterAngleJitterRadians,
    0,
    Math.PI,
    'VOLATILE maximumClusterAngleJitterRadians',
  )
  validators.positive(input.pointScatterRadius, 'VOLATILE pointScatterRadius')
  validators.positive(input.outwardDistance, 'VOLATILE outwardDistance')
  validators.positive(input.minimumGlyphScale, 'VOLATILE minimumGlyphScale')
  validators.positive(input.maximumGlyphScale, 'VOLATILE maximumGlyphScale')
  if (input.minimumGlyphScale > input.maximumGlyphScale) {
    throw new RangeError('VOLATILE Glyph scale range is reversed.')
  }
  validatePositiveInteger(
    input.maximumActivePointCount,
    MAXIMUM_ACTIVE_POINT_COUNT,
    'VOLATILE maximumActivePointCount',
  )
  validateCharacterSet(input.characters, 'VOLATILE cluster characters')
  validators.range(
    input.centerHighlight.delayMs,
    0,
    500,
    'VOLATILE center highlight delayMs',
  )
  validators.positive(
    input.centerHighlight.glyphScale,
    'VOLATILE center highlight glyphScale',
  )
  validateCharacterSet(
    [input.centerHighlight.character],
    'VOLATILE center highlight character',
  )
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
  validateClusterBurst(input.clusterBurst, validators)
  return Object.freeze({
    sourceClamp: Object.freeze({ ...input.sourceClamp }),
    release: Object.freeze({
      ...input.release,
      characters: Object.freeze([...input.release.characters]),
    }),
    neighborJolt: Object.freeze({ ...input.neighborJolt }),
    clusterBurst: Object.freeze({
      ...input.clusterBurst,
      characters: Object.freeze([...input.clusterBurst.characters]),
      centerHighlight: Object.freeze({
        ...input.clusterBurst.centerHighlight,
      }),
    }),
  })
}
