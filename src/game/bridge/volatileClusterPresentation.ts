import type {
  VolatileCenterHighlightAppearance,
  VolatileClusterBurstAppearance,
} from '../content/visuals/combatVisualThemeTypes.ts'

const FULL_CIRCLE_RADIANS = Math.PI * 2
const UNSIGNED_INTEGER_RANGE = 0x1_0000_0000

const HASH_CHANNEL = Object.freeze({
  CLUSTER_COUNT: 1,
  POINT_COUNT: 2,
  SPAWN_STAGGER: 3,
  LIFETIME: 4,
  CLUSTER_ANGLE: 5,
  CLUSTER_DISTANCE: 6,
  POINT_ANGLE: 7,
  POINT_DISTANCE: 8,
  GLYPH_SCALE: 9,
  CHARACTER: 10,
} as const)

export interface VolatileClusterPointPresentation {
  offsetX: number
  offsetY: number
  scale: number
  alpha: number
  characterIndex: number
}

export interface VolatileClusterPresentation {
  offsetX: number
  offsetY: number
}

export interface VolatileCenterHighlightPresentation {
  scale: number
  alpha: number
}

function mixUnsignedInteger(value: number): number {
  let mixed = value >>> 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0aaad)
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97)
  return (mixed ^ (mixed >>> 15)) >>> 0
}

function stableUnit(
  eventId: number,
  clusterIndex: number,
  pointIndex: number,
  channel: number,
): number {
  const seed =
    Math.imul(eventId, 0x9e3779b1) ^
    Math.imul(clusterIndex + 1, 0x85ebca6b) ^
    Math.imul(pointIndex + 1, 0xc2b2ae35) ^
    Math.imul(channel, 0x27d4eb2f)
  return mixUnsignedInteger(seed) / UNSIGNED_INTEGER_RANGE
}

function chooseInteger(
  minimum: number,
  maximum: number,
  unit: number,
): number {
  return minimum + Math.floor(unit * (maximum - minimum + 1))
}

function interpolate(minimum: number, maximum: number, unit: number): number {
  return minimum + (maximum - minimum) * unit
}

function calculateBeatIntensity(
  ageMs: number,
  attackDurationMs: number,
  holdDurationMs: number,
  settleDurationMs: number,
): number {
  if (ageMs < 0) {
    return 0
  }
  if (ageMs < attackDurationMs) {
    const progress = ageMs / attackDurationMs
    return 1 - (1 - progress) ** 3
  }
  const settleStartMs = attackDurationMs + holdDurationMs
  if (ageMs <= settleStartMs) {
    return 1
  }
  const progress = (ageMs - settleStartMs) / settleDurationMs
  return progress < 1 ? (1 - progress) ** 3 : 0
}

export function getVolatileClusterCount(
  eventId: number,
  profile: Readonly<VolatileClusterBurstAppearance>,
): number {
  return chooseInteger(
    profile.minimumClusterCount,
    profile.maximumClusterCount,
    stableUnit(eventId, 0, 0, HASH_CHANNEL.CLUSTER_COUNT),
  )
}

export function getVolatileClusterPointCount(
  eventId: number,
  clusterIndex: number,
  profile: Readonly<VolatileClusterBurstAppearance>,
): number {
  return chooseInteger(
    profile.minimumPointsPerCluster,
    profile.maximumPointsPerCluster,
    stableUnit(eventId, clusterIndex, 0, HASH_CHANNEL.POINT_COUNT),
  )
}

export function writeVolatileClusterPresentation(
  output: VolatileClusterPresentation,
  eventId: number,
  clusterCount: number,
  clusterIndex: number,
  ageMs: number,
  profile: Readonly<VolatileClusterBurstAppearance>,
): void {
  const totalDurationMs =
    profile.attackDurationMs +
    profile.holdDurationMs +
    profile.settleDurationMs +
    profile.maximumLifetimeVariationMs
  const motionProgress = Math.max(0, Math.min(1, ageMs / totalDurationMs))
  const clusterAngle =
    (clusterIndex / clusterCount) * FULL_CIRCLE_RADIANS +
    (stableUnit(
      eventId,
      clusterIndex,
      0,
      HASH_CHANNEL.CLUSTER_ANGLE,
    ) -
      0.5) *
      profile.maximumClusterAngleJitterRadians
  const clusterDistance =
    interpolate(
      profile.minimumClusterCenterDistance,
      profile.maximumClusterCenterDistance,
      stableUnit(
        eventId,
        clusterIndex,
        0,
        HASH_CHANNEL.CLUSTER_DISTANCE,
      ),
    ) +
    profile.outwardDistance * motionProgress
  output.offsetX = Math.cos(clusterAngle) * clusterDistance
  output.offsetY = Math.sin(clusterAngle) * clusterDistance
}

export function writeVolatileClusterPointPresentation(
  output: VolatileClusterPointPresentation,
  eventId: number,
  clusterIndex: number,
  pointIndex: number,
  clusterOffsetX: number,
  clusterOffsetY: number,
  ageMs: number,
  profile: Readonly<VolatileClusterBurstAppearance>,
): void {
  const spawnDelayMs =
    stableUnit(
      eventId,
      clusterIndex,
      pointIndex,
      HASH_CHANNEL.SPAWN_STAGGER,
    ) * profile.maximumSpawnStaggerMs
  const localAgeMs = ageMs - spawnDelayMs
  const lifetimeVariationMs =
    stableUnit(
      eventId,
      clusterIndex,
      pointIndex,
      HASH_CHANNEL.LIFETIME,
    ) * profile.maximumLifetimeVariationMs
  const settleDurationMs =
    profile.settleDurationMs + lifetimeVariationMs
  const pointAngle =
    stableUnit(
      eventId,
      clusterIndex,
      pointIndex,
      HASH_CHANNEL.POINT_ANGLE,
    ) * FULL_CIRCLE_RADIANS
  const pointDistance =
    Math.sqrt(
      stableUnit(
        eventId,
        clusterIndex,
        pointIndex,
        HASH_CHANNEL.POINT_DISTANCE,
      ),
    ) * profile.pointScatterRadius

  output.offsetX =
    clusterOffsetX +
    Math.cos(pointAngle) * pointDistance
  output.offsetY =
    clusterOffsetY +
    Math.sin(pointAngle) * pointDistance
  output.scale = interpolate(
    profile.minimumGlyphScale,
    profile.maximumGlyphScale,
    stableUnit(
      eventId,
      clusterIndex,
      pointIndex,
      HASH_CHANNEL.GLYPH_SCALE,
    ),
  )
  output.alpha =
    profile.alpha *
    calculateBeatIntensity(
      localAgeMs,
      profile.attackDurationMs,
      profile.holdDurationMs,
      settleDurationMs,
    )
  output.characterIndex = chooseInteger(
    0,
    profile.characters.length - 1,
    stableUnit(
      eventId,
      clusterIndex,
      pointIndex,
      HASH_CHANNEL.CHARACTER,
    ),
  )
}

export function writeVolatileCenterHighlightPresentation(
  output: VolatileCenterHighlightPresentation,
  ageMs: number,
  profile: Readonly<VolatileCenterHighlightAppearance>,
): void {
  output.scale = profile.glyphScale
  output.alpha =
    profile.alpha *
    calculateBeatIntensity(
      ageMs - profile.delayMs,
      profile.attackDurationMs,
      profile.holdDurationMs,
      profile.settleDurationMs,
    )
}
