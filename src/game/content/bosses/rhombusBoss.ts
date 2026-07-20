import {
  CREATURE_BODY_MOTION_BEHAVIOR,
  CREATURE_COLLAPSE_BEHAVIOR,
  CREATURE_LAYOUT_BEHAVIOR,
  CREATURE_MOVEMENT_BEHAVIOR,
  CREATURE_SPLIT_BEHAVIOR,
  defineCreature,
  type ComponentOrbitGroupDefinition,
  type CreatureDefinition,
  type CreatureTargetAnchorDefinition,
} from '../creatures/creatureDefinition.ts'
import type { PreparedGlyphFontBanks } from '../visuals/glyphFontBanks.ts'
import { preparePrototypeGlyphFontBanks } from '../visuals/glyphFontBanks.ts'
import { GLYPH_APPEARANCE_PROFILE } from '../visuals/combatVisualTheme.ts'
import { GLYPH_FONT_BANK } from '../../glyph/glyphFontBank.ts'
import { getGlyphAtlasFrame } from '../../glyph/glyphFontBank.ts'
import {
  defineGlyphBody,
  type GlyphBodySlotInput,
} from '../../glyph/glyphLayout.ts'
import { DAMAGE_TOPOLOGY_TRAVERSAL_SCOPE } from '../../glyph/localDamage.ts'
import {
  GLYPH_MATERIAL,
  getGlyphMaterialDefinition,
} from '../../glyph/glyphMaterial.ts'
import {
  compileDigitalDiamond,
  compileReinforcedClustersWithDiagnostics,
  type DigitalDiamondCell,
  type ReinforcedCluster,
} from './rhombusBodyCompiler.ts'
import {
  compileRhombusCollapseSlots,
  type PreparedRhombusCollapseSlotPlan,
} from './rhombusCollapseCompiler.ts'

export const RHOMBUS_COMPONENT = Object.freeze({
  MAIN: 'RHOMBUS_MAIN',
  SECONDARY: 'RHOMBUS_SECONDARY',
  SATELLITE: 'RHOMBUS_SATELLITE',
} as const)

export type RhombusComponentId =
  (typeof RHOMBUS_COMPONENT)[keyof typeof RHOMBUS_COMPONENT]

export const RHOMBUS_ORBIT_DIRECTION = Object.freeze({
  CLOCKWISE: 'CLOCKWISE',
  COUNTERCLOCKWISE: 'COUNTERCLOCKWISE',
} as const)

export type RhombusOrbitDirection =
  (typeof RHOMBUS_ORBIT_DIRECTION)[keyof typeof RHOMBUS_ORBIT_DIRECTION]

export const RHOMBUS_SPIRAL_DIRECTION_MODE = Object.freeze({
  CLOCKWISE: 'CLOCKWISE',
  COUNTERCLOCKWISE: 'COUNTERCLOCKWISE',
  ALTERNATE_PER_WAVE: 'ALTERNATE_PER_WAVE',
} as const)

export type RhombusSpiralDirectionMode =
  (typeof RHOMBUS_SPIRAL_DIRECTION_MODE)[keyof typeof RHOMBUS_SPIRAL_DIRECTION_MODE]

export interface RhombusOrbitProfile {
  readonly id: string
  readonly topologyComponentId:
  | typeof RHOMBUS_COMPONENT.SECONDARY
  | typeof RHOMBUS_COMPONENT.SATELLITE
  readonly revolutionDurationMs: number
  readonly postRevolutionPauseMs: number
  readonly direction: RhombusOrbitDirection
  readonly initialPhaseRadians: number
  readonly initialDelayMs: number
  readonly cadenceOffsetMs: number
  readonly centerOffsetX: number
  readonly centerOffsetY: number
  readonly axisRotationRadians: number
  readonly primaryRadiusWorldUnits: number
  readonly secondaryRadiusWorldUnits: number
  readonly behindDepthThreshold: number
  readonly frontDepthThreshold: number
  readonly depthBandHysteresis: number
}

export interface RhombusAttackProfile {
  readonly damage: number
  readonly damageRoute: 'SHIELD_FIRST'
  readonly flightSpeedWorldUnitsPerSecond: number
  readonly spikesPerWave: number
  readonly launchRingRadiusWorldUnits: number
  readonly launchRingInitialPhaseRadians: number
  readonly launchRingHoldMs: number
  readonly emissionIntervalMs: number
  readonly waveIntervalMs: number
  readonly spiralTightnessWorldUnitsPerRadian: number
  readonly spiralDirectionMode: RhombusSpiralDirectionMode
  readonly firstWaveDirection: RhombusOrbitDirection
  readonly maximumTravelDistanceWorldUnits: number
  readonly projectileCollisionRadiusWorldUnits: number
  readonly pairSpacingWorldUnits: number
  readonly visualScale: number
  readonly fontBankId: typeof GLYPH_FONT_BANK.HOSTILE_ATTACK
  readonly leftGlyphFrame: number
  readonly rightGlyphFrame: number
}

export interface RhombusCollapseProfile {
  readonly fallDurationMs: number
  readonly settleDurationMs: number
  readonly maximumFallDelayMs: number
  readonly maximumRotationRadians: number
  readonly pileSupportBandHeightWorldUnits: number
  readonly collapsePlanSeed: string
}

export interface RhombusSpawnProfile {
  readonly materializeDurationMs: number
  readonly spawnAggregationMarginWorldUnits: number
  readonly bossSpawnSeparationPaddingWorldUnits: number
}

export interface RhombusTargetAnchorDefinition {
  readonly id: string
  readonly topologyComponentId: RhombusComponentId
  readonly ownerScope: 'CREATURE'
  readonly motionGroupId: number
  readonly localX: number
  readonly localY: number
}

export interface PreparedRhombusBossDefinition {
  readonly contentVersion: 1
  readonly creature: CreatureDefinition
  readonly componentSlotIds: Readonly<Record<RhombusComponentId, readonly number[]>>
  readonly targetAnchors: readonly Readonly<RhombusTargetAnchorDefinition>[]
  readonly reinforcedClusters: readonly Readonly<ReinforcedCluster>[]
  readonly compileDiagnostics: Readonly<{
    reinforcedCandidateCount: number
    reinforcedAcceptedCandidateCount: number
    reinforcedRejectedCandidateCount: number
    reinforcedCompileTimeMs: number
  }>
  readonly rootMovement: Readonly<{
    trackingResponsiveness: number
    turnResponsiveness: number
  }>
  readonly orbitProfiles: readonly Readonly<RhombusOrbitProfile>[]
  readonly attackProfile: Readonly<RhombusAttackProfile>
  readonly collapseProfile: Readonly<RhombusCollapseProfile>
  readonly collapseSlotPlans: readonly Readonly<PreparedRhombusCollapseSlotPlan>[]
  readonly spawnProfile: Readonly<RhombusSpawnProfile>
  readonly maximumGameplayFootprintRadius: number
  readonly fontProfile: Readonly<{
    bodyFontBankId: typeof GLYPH_FONT_BANK.RHOMBUS_BODY
    bodyFontAssetId: string
    bodyFontFamily: string
    bodyFontRasterSizePx: number
    bodyFontBaselineOffsetPx: number
    bodyGlyphScale: number
    columnAdvanceWorldUnits: number
    rowAdvanceWorldUnits: number
    glyphCollisionRadiusWorldUnits: number
    atlasPaddingPx: number
  }>
}

const RHOMBUS_SEQUENCE = 'RHOMBUS'
const MAIN_SIDE_LENGTH = 15
const SECONDARY_SIDE_LENGTH = 5
const RHOMBUS_ROW_ADVANCE_WORLD_UNITS = 15

const RHOMBUS_AUTHORING = Object.freeze({
  bodyGlyphScale: 0.58,
  columnAdvanceWorldUnits: 18,
  rowAdvanceWorldUnits: RHOMBUS_ROW_ADVANCE_WORLD_UNITS,
  glyphCollisionRadiusWorldUnits: 8,
  mainBaseCellMaxDurability: 2,
  secondaryBaseCellMaxDurability: 2,
  satelliteCellMaxDurability: 3,
  reinforcedClusterCount: 18,
  reinforcedCellMaxDurability: 4,
  reinforcedClusterLayoutSeed: 'boss.rhombus.prototype.v1.bricks',
  maximumSpeed: 38,
  movementResponsiveness: 2.4,
  turnResponsiveness: 1.8,
  contactDamage: 1,
  collapseDurationMs: 1_800,
  experienceReward: 8,
  orbitProfiles: Object.freeze([
    Object.freeze({
      id: 'rhombus.secondary.horizontal',
      topologyComponentId: RHOMBUS_COMPONENT.SECONDARY,
      revolutionDurationMs: 680,
      postRevolutionPauseMs: 920,
      direction: RHOMBUS_ORBIT_DIRECTION.CLOCKWISE,
      initialPhaseRadians: 0,
      initialDelayMs: 0,
      cadenceOffsetMs: 0,
      centerOffsetX: 0,
      centerOffsetY: RHOMBUS_ROW_ADVANCE_WORLD_UNITS,
      axisRotationRadians: 0,
      primaryRadiusWorldUnits: 310,
      secondaryRadiusWorldUnits: 58,
      behindDepthThreshold: -0.16,
      frontDepthThreshold: 0.16,
      depthBandHysteresis: 0.05,
    }),
    Object.freeze({
      id: 'rhombus.satellite.diagonal',
      topologyComponentId: RHOMBUS_COMPONENT.SATELLITE,
      revolutionDurationMs: 520,
      postRevolutionPauseMs: 1_060,
      direction: RHOMBUS_ORBIT_DIRECTION.COUNTERCLOCKWISE,
      initialPhaseRadians: 0,
      initialDelayMs: 180,
      cadenceOffsetMs: 240,
      centerOffsetX: 0,
      centerOffsetY: 0,
      axisRotationRadians: -Math.PI / 4,
      primaryRadiusWorldUnits: 365,
      secondaryRadiusWorldUnits: 72,
      behindDepthThreshold: -0.18,
      frontDepthThreshold: 0.18,
      depthBandHysteresis: 0.05,
    }),
  ]),
  attackProfile: Object.freeze({
    damage: 1,
    damageRoute: 'SHIELD_FIRST' as const,
    flightSpeedWorldUnitsPerSecond: 360,
    spikesPerWave: 18,
    launchRingRadiusWorldUnits: 60,
    launchRingInitialPhaseRadians: -Math.PI / 2,
    launchRingHoldMs: 320,
    emissionIntervalMs: 150,
    waveIntervalMs: 3_500,
    spiralTightnessWorldUnitsPerRadian: 2_400,
    spiralDirectionMode: RHOMBUS_SPIRAL_DIRECTION_MODE.CLOCKWISE,
    firstWaveDirection: RHOMBUS_ORBIT_DIRECTION.CLOCKWISE,
    maximumTravelDistanceWorldUnits: 2_000,
    projectileCollisionRadiusWorldUnits: 9,
    pairSpacingWorldUnits: 12,
    visualScale: 0.8,
  }),
  collapseProfile: Object.freeze({
    fallDurationMs: 900,
    settleDurationMs: 350,
    maximumFallDelayMs: 220,
    maximumRotationRadians: 0.42,
    pileSupportBandHeightWorldUnits: 18,
    collapsePlanSeed: 'boss.rhombus.prototype.v1.collapse',
  }),
  spawnProfile: Object.freeze({
    materializeDurationMs: 900,
    spawnAggregationMarginWorldUnits: 40,
    bossSpawnSeparationPaddingWorldUnits: 180,
  }),
})

const FULL_TURN_RADIANS = Math.PI * 2

function normalizeRadians(value: number): number {
  const normalized = value % FULL_TURN_RADIANS
  return normalized < 0 ? normalized + FULL_TURN_RADIANS : normalized
}

function requirePositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and greater than zero.`)
  }
}

function requireNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and non-negative.`)
  }
}

function prepareOrbitProfile(
  input: Readonly<RhombusOrbitProfile>,
): Readonly<RhombusOrbitProfile> {
  if (input.id.trim().length === 0) {
    throw new TypeError('RHOMBUS orbit profile id must not be empty.')
  }
  requirePositiveFinite(input.revolutionDurationMs, `${input.id} revolutionDurationMs`)
  requireNonNegativeFinite(
    input.postRevolutionPauseMs,
    `${input.id} postRevolutionPauseMs`,
  )
  requireNonNegativeFinite(input.initialDelayMs, `${input.id} initialDelayMs`)
  requireNonNegativeFinite(input.cadenceOffsetMs, `${input.id} cadenceOffsetMs`)
  requirePositiveFinite(
    input.primaryRadiusWorldUnits,
    `${input.id} primaryRadiusWorldUnits`,
  )
  requirePositiveFinite(
    input.secondaryRadiusWorldUnits,
    `${input.id} secondaryRadiusWorldUnits`,
  )
  for (const [name, value] of [
    ['initialPhaseRadians', input.initialPhaseRadians],
    ['centerOffsetX', input.centerOffsetX],
    ['centerOffsetY', input.centerOffsetY],
    ['axisRotationRadians', input.axisRotationRadians],
  ] as const) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${input.id} ${name} must be finite.`)
    }
  }
  if (
    !Object.values(RHOMBUS_ORBIT_DIRECTION).some(
      (direction) => direction === input.direction,
    )
  ) {
    throw new Error(`${input.id} has an invalid orbit direction.`)
  }
  if (
    !Number.isFinite(input.behindDepthThreshold) ||
    !Number.isFinite(input.frontDepthThreshold) ||
    input.behindDepthThreshold >= input.frontDepthThreshold
  ) {
    throw new RangeError(`${input.id} must preserve behind < front thresholds.`)
  }
  requireNonNegativeFinite(
    input.depthBandHysteresis,
    `${input.id} depthBandHysteresis`,
  )
  if (
    input.depthBandHysteresis * 2 >=
    input.frontDepthThreshold - input.behindDepthThreshold
  ) {
    throw new RangeError(`${input.id} depth hysteresis must fit its threshold gap.`)
  }
  return Object.freeze({
    ...input,
    initialPhaseRadians: normalizeRadians(input.initialPhaseRadians),
  })
}

function prepareAttackProfile(
  input: typeof RHOMBUS_AUTHORING.attackProfile,
): Readonly<RhombusAttackProfile> {
  for (const [name, value] of [
    ['damage', input.damage],
    ['flightSpeedWorldUnitsPerSecond', input.flightSpeedWorldUnitsPerSecond],
    ['launchRingRadiusWorldUnits', input.launchRingRadiusWorldUnits],
    ['launchRingHoldMs', input.launchRingHoldMs],
    ['emissionIntervalMs', input.emissionIntervalMs],
    ['waveIntervalMs', input.waveIntervalMs],
    [
      'spiralTightnessWorldUnitsPerRadian',
      input.spiralTightnessWorldUnitsPerRadian,
    ],
    ['maximumTravelDistanceWorldUnits', input.maximumTravelDistanceWorldUnits],
    [
      'projectileCollisionRadiusWorldUnits',
      input.projectileCollisionRadiusWorldUnits,
    ],
    ['pairSpacingWorldUnits', input.pairSpacingWorldUnits],
    ['visualScale', input.visualScale],
  ] as const) {
    requirePositiveFinite(value, `RHOMBUS attack ${name}`)
  }
  if (!Number.isSafeInteger(input.spikesPerWave) || input.spikesPerWave < 3) {
    throw new RangeError('RHOMBUS spikesPerWave must be a safe integer of at least three.')
  }
  if (input.damageRoute !== 'SHIELD_FIRST') {
    throw new Error('RHOMBUS hostile spikes must use SHIELD_FIRST damage routing.')
  }
  if (
    !Object.values(RHOMBUS_SPIRAL_DIRECTION_MODE).some(
      (mode) => mode === input.spiralDirectionMode,
    ) ||
    !Object.values(RHOMBUS_ORBIT_DIRECTION).some(
      (direction) => direction === input.firstWaveDirection,
    )
  ) {
    throw new Error('RHOMBUS attack has an invalid spiral direction contract.')
  }
  if (!Number.isFinite(input.launchRingInitialPhaseRadians)) {
    throw new RangeError('RHOMBUS launchRingInitialPhaseRadians must be finite.')
  }
  return Object.freeze({
    ...input,
    launchRingInitialPhaseRadians: normalizeRadians(
      input.launchRingInitialPhaseRadians,
    ),
    fontBankId: GLYPH_FONT_BANK.HOSTILE_ATTACK,
    leftGlyphFrame: getGlyphAtlasFrame(GLYPH_FONT_BANK.HOSTILE_ATTACK, '<'),
    rightGlyphFrame: getGlyphAtlasFrame(GLYPH_FONT_BANK.HOSTILE_ATTACK, '>'),
  })
}

function prepareCollapseProfile(
  input: Readonly<RhombusCollapseProfile>,
): Readonly<RhombusCollapseProfile> {
  requirePositiveFinite(input.fallDurationMs, 'RHOMBUS collapse fallDurationMs')
  requirePositiveFinite(input.settleDurationMs, 'RHOMBUS collapse settleDurationMs')
  requireNonNegativeFinite(
    input.maximumFallDelayMs,
    'RHOMBUS collapse maximumFallDelayMs',
  )
  requirePositiveFinite(
    input.maximumRotationRadians,
    'RHOMBUS collapse maximumRotationRadians',
  )
  requirePositiveFinite(
    input.pileSupportBandHeightWorldUnits,
    'RHOMBUS collapse pileSupportBandHeightWorldUnits',
  )
  if (input.collapsePlanSeed.trim().length === 0) {
    throw new TypeError('RHOMBUS collapsePlanSeed must not be empty.')
  }
  return Object.freeze({ ...input })
}

function prepareSpawnProfile(
  input: Readonly<RhombusSpawnProfile>,
): Readonly<RhombusSpawnProfile> {
  requirePositiveFinite(
    input.materializeDurationMs,
    'RHOMBUS spawn materializeDurationMs',
  )
  requireNonNegativeFinite(
    input.spawnAggregationMarginWorldUnits,
    'RHOMBUS spawn aggregation margin',
  )
  requirePositiveFinite(
    input.bossSpawnSeparationPaddingWorldUnits,
    'RHOMBUS Boss separation padding',
  )
  return Object.freeze({ ...input })
}

function coordinateKey(cell: Readonly<DigitalDiamondCell>): string {
  return `${cell.column},${cell.row}`
}

function createComponentSlots(
  cells: readonly Readonly<DigitalDiamondCell>[],
  topologyComponentId: RhombusComponentId,
  firstSlotId: number,
  baseDurability: number,
  reinforcedCellKeys: ReadonlySet<string>,
): GlyphBodySlotInput[] {
  return cells.map((cell, sequenceIndex) => ({
    slotId: firstSlotId + sequenceIndex,
    role: 'BODY',
    character: RHOMBUS_SEQUENCE[sequenceIndex % RHOMBUS_SEQUENCE.length],
    topologyComponentId,
    fontBankId: GLYPH_FONT_BANK.RHOMBUS_BODY,
    topologyX: cell.column,
    topologyY: cell.row,
    localX: cell.column * RHOMBUS_AUTHORING.columnAdvanceWorldUnits,
    localY: cell.row * RHOMBUS_AUTHORING.rowAdvanceWorldUnits,
    maxDurability: reinforcedCellKeys.has(coordinateKey(cell))
      ? RHOMBUS_AUTHORING.reinforcedCellMaxDurability
      : baseDurability,
    collisionRadius: RHOMBUS_AUTHORING.glyphCollisionRadiusWorldUnits,
    scale: RHOMBUS_AUTHORING.bodyGlyphScale,
    material: GLYPH_MATERIAL.RHOMBUS,
  }))
}

function createComponentSlotIds(
  slots: readonly GlyphBodySlotInput[],
): Readonly<Record<RhombusComponentId, readonly number[]>> {
  return Object.freeze(
    Object.fromEntries(
      Object.values(RHOMBUS_COMPONENT).map((componentId) => [
        componentId,
        Object.freeze(
          slots
            .filter((slot) => slot.topologyComponentId === componentId)
            .map((slot) => slot.slotId),
        ),
      ]),
    ) as Record<RhombusComponentId, readonly number[]>,
  )
}

export function prepareRhombusBossDefinition(
  fontBanks: PreparedGlyphFontBanks = preparePrototypeGlyphFontBanks(),
): PreparedRhombusBossDefinition {
  const bodyFontBank = fontBanks.byId[GLYPH_FONT_BANK.RHOMBUS_BODY]
  if (bodyFontBank.assetId === null) {
    throw new Error('RHOMBUS body font bank must use a bundled asset.')
  }
  const hostileAttackFontBank =
    fontBanks.byId[GLYPH_FONT_BANK.HOSTILE_ATTACK]
  if (
    hostileAttackFontBank.assetId === null ||
    !hostileAttackFontBank.requiredCharacters.includes('<') ||
    !hostileAttackFontBank.requiredCharacters.includes('>')
  ) {
    throw new Error('Shared hostile-attack font bank must prepare < and >.')
  }
  if (
    RHOMBUS_AUTHORING.reinforcedCellMaxDurability <=
    RHOMBUS_AUTHORING.mainBaseCellMaxDurability
  ) {
    throw new RangeError('RHOMBUS reinforced durability must exceed main base durability.')
  }

  const mainCells = compileDigitalDiamond(MAIN_SIDE_LENGTH)
  const secondaryCells = compileDigitalDiamond(SECONDARY_SIDE_LENGTH)
  const reinforcedCompileStartedAtMs = performance.now()
  const reinforcedCompilation = compileReinforcedClustersWithDiagnostics({
    cells: mainCells,
    requestedClusterCount: RHOMBUS_AUTHORING.reinforcedClusterCount,
    seed: RHOMBUS_AUTHORING.reinforcedClusterLayoutSeed,
  })
  const reinforcedCompileTimeMs = performance.now() - reinforcedCompileStartedAtMs
  const reinforcedClusters = reinforcedCompilation.clusters
  const reinforcedCellKeys = new Set(
    reinforcedClusters.flatMap((cluster) => cluster.cells.map(coordinateKey)),
  )
  const mainSlots = createComponentSlots(
    mainCells,
    RHOMBUS_COMPONENT.MAIN,
    0,
    RHOMBUS_AUTHORING.mainBaseCellMaxDurability,
    reinforcedCellKeys,
  )
  const secondarySlots = createComponentSlots(
    secondaryCells,
    RHOMBUS_COMPONENT.SECONDARY,
    mainSlots.length,
    RHOMBUS_AUTHORING.secondaryBaseCellMaxDurability,
    new Set(),
  )
  const satelliteSlot: GlyphBodySlotInput = {
    slotId: mainSlots.length + secondarySlots.length,
    role: 'BODY',
    character: 'R',
    topologyComponentId: RHOMBUS_COMPONENT.SATELLITE,
    fontBankId: GLYPH_FONT_BANK.RHOMBUS_BODY,
    topologyX: 0,
    topologyY: 0,
    localX: 0,
    localY: 0,
    maxDurability: RHOMBUS_AUTHORING.satelliteCellMaxDurability,
    collisionRadius: RHOMBUS_AUTHORING.glyphCollisionRadiusWorldUnits,
    scale: RHOMBUS_AUTHORING.bodyGlyphScale,
    material: GLYPH_MATERIAL.RHOMBUS,
  }
  const slots = Object.freeze([...mainSlots, ...secondarySlots, satelliteSlot])
  const body = defineGlyphBody({
    id: 'boss.rhombus.prototype.body',
    expectedGlyphCount: 463,
    slots,
  })
  const orbitProfiles = Object.freeze(
    RHOMBUS_AUTHORING.orbitProfiles.map(prepareOrbitProfile),
  )
  if (
    new Set(orbitProfiles.map((profile) => profile.id)).size !==
    orbitProfiles.length ||
    new Set(
      orbitProfiles.map((profile) => profile.topologyComponentId),
    ).size !== 2
  ) {
    throw new Error('RHOMBUS requires one stable orbit profile per companion.')
  }
  const attackProfile = prepareAttackProfile(RHOMBUS_AUTHORING.attackProfile)
  const collapseProfile = prepareCollapseProfile(
    RHOMBUS_AUTHORING.collapseProfile,
  )
  const spawnProfile = prepareSpawnProfile(RHOMBUS_AUTHORING.spawnProfile)
  const motionGroupByComponent = Object.freeze({
    [RHOMBUS_COMPONENT.MAIN]: 0,
    [RHOMBUS_COMPONENT.SECONDARY]: 1,
    [RHOMBUS_COMPONENT.SATELLITE]: 2,
  } as const)
  const groupBySlotId = Object.freeze(
    Object.fromEntries(
      slots.map((slot) => [
        slot.slotId,
        motionGroupByComponent[slot.topologyComponentId as RhombusComponentId],
      ]),
    ) as Record<number, number>,
  )
  const componentOrbitGroups = Object.freeze(
    orbitProfiles.map((profile) =>
      Object.freeze({
        ...profile,
        motionGroupId: motionGroupByComponent[profile.topologyComponentId],
      }),
    ),
  ) satisfies readonly Readonly<ComponentOrbitGroupDefinition>[]
  const targetAnchors = Object.freeze(
    Object.values(RHOMBUS_COMPONENT).map((topologyComponentId) =>
      Object.freeze({
        id: `boss.rhombus.prototype.anchor.${topologyComponentId.toLowerCase()}`,
        topologyComponentId,
        ownerScope: 'CREATURE' as const,
        motionGroupId: motionGroupByComponent[topologyComponentId],
        localX: 0,
        localY: 0,
      }),
    ),
  ) satisfies readonly Readonly<
    RhombusTargetAnchorDefinition & CreatureTargetAnchorDefinition
  >[]
  const creature = defineCreature({
    id: 'boss.rhombus.prototype',
    category: 'BOSS',
    appearanceProfileId: GLYPH_APPEARANCE_PROFILE.RHOMBUS_BOSS,
    body,
    maximumSpeed: RHOMBUS_AUTHORING.maximumSpeed,
    movementBehaviorId: CREATURE_MOVEMENT_BEHAVIOR.DAMPED_PURSUIT,
    movementResponsiveness: RHOMBUS_AUTHORING.movementResponsiveness,
    layoutBehaviorId: CREATURE_LAYOUT_BEHAVIOR.STATIC,
    layoutCycleDurationMs: 0,
    authoredMorphStrength: 0,
    compiledMorphStrength: 0,
    bodyMotion: Object.freeze({
      behaviorId: CREATURE_BODY_MOTION_BEHAVIOR.COMPONENT_ORBIT,
      maximumOffset: Math.max(
        ...componentOrbitGroups.map(
          (profile) =>
            Math.hypot(profile.centerOffsetX, profile.centerOffsetY) +
            Math.max(
              profile.primaryRadiusWorldUnits,
              profile.secondaryRadiusWorldUnits,
            ),
        ),
      ),
      groupBySlotId,
      orbitGroups: componentOrbitGroups,
    }),
    targetAnchors,
    damageTopologyTraversalScope:
      DAMAGE_TOPOLOGY_TRAVERSAL_SCOPE.CANONICAL_COMPONENT,
    splitBehaviorId: CREATURE_SPLIT_BEHAVIOR.NONE,
    collapseBehaviorId: CREATURE_COLLAPSE_BEHAVIOR.RHOMBUS_MASONRY,
    minimumIndependentCellRatio: 0,
    contactDamage: RHOMBUS_AUTHORING.contactDamage,
    collapseDurationMs: RHOMBUS_AUTHORING.collapseDurationMs,
    experienceReward: RHOMBUS_AUTHORING.experienceReward,
  })
  if (
    collapseProfile.fallDurationMs +
    collapseProfile.settleDurationMs +
    collapseProfile.maximumFallDelayMs >
    creature.collapseDurationMs
  ) {
    throw new RangeError(
      'RHOMBUS collapse plan must resolve within collapseDurationMs.',
    )
  }
  const componentBodyRadius = Object.fromEntries(
    Object.values(RHOMBUS_COMPONENT).map((componentId) => [
      componentId,
      slots
        .filter((slot) => slot.topologyComponentId === componentId)
        .reduce(
          (maximum, slot) =>
            Math.max(
              maximum,
              Math.hypot(slot.localX, slot.localY) + slot.collisionRadius,
            ),
          0,
        ),
    ]),
  ) as Record<RhombusComponentId, number>
  const maximumMaterialOffset = getGlyphMaterialDefinition(
    GLYPH_MATERIAL.RHOMBUS,
  ).maximumOffset
  const maximumGameplayFootprintRadius =
    Math.max(
      componentBodyRadius[RHOMBUS_COMPONENT.MAIN],
      ...orbitProfiles.map(
        (profile) =>
          Math.hypot(profile.centerOffsetX, profile.centerOffsetY) +
          Math.hypot(
            profile.primaryRadiusWorldUnits,
            profile.secondaryRadiusWorldUnits,
          ) +
          componentBodyRadius[profile.topologyComponentId],
      ),
    ) +
    maximumMaterialOffset +
    spawnProfile.spawnAggregationMarginWorldUnits

  return Object.freeze({
    contentVersion: 1,
    creature,
    componentSlotIds: createComponentSlotIds(slots),
    targetAnchors,
    reinforcedClusters,
    compileDiagnostics: Object.freeze({
      reinforcedCandidateCount: reinforcedCompilation.candidateCount,
      reinforcedAcceptedCandidateCount:
        reinforcedCompilation.acceptedCandidateCount,
      reinforcedRejectedCandidateCount:
        reinforcedCompilation.rejectedCandidateCount,
      reinforcedCompileTimeMs,
    }),
    rootMovement: Object.freeze({
      trackingResponsiveness: RHOMBUS_AUTHORING.movementResponsiveness,
      turnResponsiveness: RHOMBUS_AUTHORING.turnResponsiveness,
    }),
    orbitProfiles,
    attackProfile,
    collapseProfile,
    collapseSlotPlans: compileRhombusCollapseSlots(
      slots,
      collapseProfile.collapsePlanSeed,
    ),
    spawnProfile,
    maximumGameplayFootprintRadius,
    fontProfile: Object.freeze({
      bodyFontBankId: GLYPH_FONT_BANK.RHOMBUS_BODY,
      bodyFontAssetId: bodyFontBank.assetId,
      bodyFontFamily: bodyFontBank.family,
      bodyFontRasterSizePx: bodyFontBank.rasterSizePx,
      bodyFontBaselineOffsetPx: bodyFontBank.baselineOffsetPx,
      bodyGlyphScale: RHOMBUS_AUTHORING.bodyGlyphScale,
      columnAdvanceWorldUnits: RHOMBUS_AUTHORING.columnAdvanceWorldUnits,
      rowAdvanceWorldUnits: RHOMBUS_AUTHORING.rowAdvanceWorldUnits,
      glyphCollisionRadiusWorldUnits:
        RHOMBUS_AUTHORING.glyphCollisionRadiusWorldUnits,
      atlasPaddingPx: bodyFontBank.atlasPaddingPx,
    }),
  })
}
