import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compileDigitalDiamond,
  compileReinforcedClusters,
} from '../../src/game/content/bosses/rhombusBodyCompiler.ts'
import {
  RHOMBUS_COMPONENT,
  RHOMBUS_ORBIT_DIRECTION,
  RHOMBUS_SPIRAL_DIRECTION_MODE,
  prepareRhombusBossDefinition,
} from '../../src/game/content/bosses/rhombusBoss.ts'
import { GLYPH_FONT_BANK, getGlyphAtlasFrame } from '../../src/game/glyph/glyphFontBank.ts'
import {
  activateRhombusBossContent,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import { solveArchimedeanSpiralTheta } from '../../src/game/systems/rhombusSpiralGeometry.ts'

const RHOMBUS_SEQUENCE = 'RHOMBUS'

test('compiles the fixed three-component RHOMBUS body with stable identity', () => {
  const definition = prepareRhombusBossDefinition()
  const slots = definition.creature.body.slots
  const componentCounts = Object.fromEntries(
    Object.values(RHOMBUS_COMPONENT).map((componentId) => [
      componentId,
      slots.filter(
        (slot) => slot.topologyComponentId === componentId,
      ).length,
    ]),
  )

  assert.equal(slots.length, 463)
  assert.deepEqual(componentCounts, {
    [RHOMBUS_COMPONENT.MAIN]: 421,
    [RHOMBUS_COMPONENT.SECONDARY]: 41,
    [RHOMBUS_COMPONENT.SATELLITE]: 1,
  })
  assert.deepEqual(
    slots.map((slot) => slot.slotId),
    Array.from({ length: slots.length }, (_, index) => index),
  )

  for (const componentId of Object.values(RHOMBUS_COMPONENT)) {
    const componentSlots = slots.filter(
      (slot) => slot.topologyComponentId === componentId,
    )
    componentSlots.forEach((slot, index) => {
      assert.equal(
        slot.character,
        componentId === RHOMBUS_COMPONENT.SATELLITE
          ? 'R'
          : RHOMBUS_SEQUENCE[index % RHOMBUS_SEQUENCE.length],
      )
    })
  }

  assert.deepEqual(
    definition.targetAnchors.map((anchor) => anchor.topologyComponentId),
    Object.values(RHOMBUS_COMPONENT),
  )
  assert.equal(new Set(definition.targetAnchors.map((anchor) => anchor.id)).size, 3)
  assert.deepEqual(
    definition.orbitProfiles.map((profile) => profile.direction),
    [
      RHOMBUS_ORBIT_DIRECTION.CLOCKWISE,
      RHOMBUS_ORBIT_DIRECTION.COUNTERCLOCKWISE,
    ],
  )
  assert.equal(
    definition.orbitProfiles[0].centerOffsetY,
    definition.fontProfile.rowAdvanceWorldUnits,
  )
  assert.notEqual(
    definition.orbitProfiles[0].revolutionDurationMs,
    definition.orbitProfiles[0].postRevolutionPauseMs,
  )
  assert.ok(
    definition.maximumGameplayFootprintRadius >
      definition.creature.broadPhaseRadius,
  )
})

test('prepares hostile spike identity and launch-ring authoring', () => {
  const attack = prepareRhombusBossDefinition().attackProfile

  assert.equal(attack.fontBankId, GLYPH_FONT_BANK.HOSTILE_ATTACK)
  assert.equal(
    attack.leftGlyphFrame,
    getGlyphAtlasFrame(GLYPH_FONT_BANK.HOSTILE_ATTACK, '<'),
  )
  assert.equal(
    attack.rightGlyphFrame,
    getGlyphAtlasFrame(GLYPH_FONT_BANK.HOSTILE_ATTACK, '>'),
  )
  assert.equal(
    attack.spiralDirectionMode,
    RHOMBUS_SPIRAL_DIRECTION_MODE.CLOCKWISE,
  )
  assert.equal(attack.firstWaveDirection, RHOMBUS_ORBIT_DIRECTION.CLOCKWISE)
  assert.ok(attack.spikesPerWave >= 3)
  assert.ok(attack.launchRingRadiusWorldUnits > 0)
  assert.ok(attack.launchRingHoldMs > 0)
  assert.ok(
    attack.launchRingInitialPhaseRadians >= 0 &&
      attack.launchRingInitialPhaseRadians < Math.PI * 2,
  )

  const slotAngleRadians = (Math.PI * 2) / attack.spikesPerWave
  const distancePerRelease =
    attack.flightSpeedWorldUnitsPerSecond *
    (attack.emissionIntervalMs / 1_000)
  const angularAdvancePerRelease = solveArchimedeanSpiralTheta(
    distancePerRelease,
    attack.spiralTightnessWorldUnitsPerRadian,
    attack.launchRingRadiusWorldUnits,
  )
  const radialSeparationPerRelease =
    angularAdvancePerRelease *
    attack.spiralTightnessWorldUnitsPerRadian
  const initialOutwardVelocityRatio =
    attack.spiralTightnessWorldUnitsPerRadian /
    Math.hypot(
      attack.spiralTightnessWorldUnitsPerRadian,
      attack.launchRingRadiusWorldUnits,
    )
  const maximumAngularTravel = solveArchimedeanSpiralTheta(
    attack.maximumTravelDistanceWorldUnits,
    attack.spiralTightnessWorldUnitsPerRadian,
    attack.launchRingRadiusWorldUnits,
  )

  assert.ok(angularAdvancePerRelease > 0)
  assert.ok(angularAdvancePerRelease < slotAngleRadians * 0.1)
  assert.ok(radialSeparationPerRelease > attack.pairSpacingWorldUnits)
  assert.ok(initialOutwardVelocityRatio > 0.95)
  assert.ok(maximumAngularTravel > Math.PI / 12)
  assert.ok(maximumAngularTravel < Math.PI / 4)
  assert.ok(
    Math.min(
      attack.maximumTravelDistanceWorldUnits,
      attack.flightSpeedWorldUnitsPerSecond *
        (attack.waveIntervalMs / 1_000),
    ) >
      attack.launchRingRadiusWorldUnits * 3,
  )
})

test('digital diamond compiler preserves the fixed row-width formula', () => {
  const cells = compileDigitalDiamond(5)
  const rowWidths = new Map<number, number>()
  for (const cell of cells) {
    rowWidths.set(cell.row, (rowWidths.get(cell.row) ?? 0) + 1)
  }

  assert.equal(cells.length, 41)
  assert.deepEqual([...rowWidths.values()], [1, 3, 5, 7, 9, 7, 5, 3, 1])
})

test('reinforced brick layout is deterministic, connected, separated, and prefix-stable', () => {
  const cells = compileDigitalDiamond(15)
  const three = compileReinforcedClusters({
    cells,
    requestedClusterCount: 3,
    seed: 'rhombus-content-v1',
  })
  const four = compileReinforcedClusters({
    cells,
    requestedClusterCount: 4,
    seed: 'rhombus-content-v1',
  })

  assert.deepEqual(four.slice(0, three.length), three)
  assert.deepEqual(
    compileReinforcedClusters({
      cells,
      requestedClusterCount: 3,
      seed: 'rhombus-content-v1',
    }),
    three,
  )

  const occupiedByCluster = new Map<string, number>()
  three.forEach((cluster, clusterIndex) => {
    assert.ok(cluster.cells.length === 2 || cluster.cells.length === 3)
    const keys = new Set(cluster.cells.map((cell) => `${cell.column},${cell.row}`))
    const reached = new Set<string>([...keys].slice(0, 1))
    for (let changed = true; changed; ) {
      changed = false
      for (const key of keys) {
        const [column, row] = key.split(',').map(Number)
        if (
          [...reached].some((reachedKey) => {
            const [reachedColumn, reachedRow] = reachedKey.split(',').map(Number)
            return Math.abs(column - reachedColumn) + Math.abs(row - reachedRow) === 1
          }) &&
          !reached.has(key)
        ) {
          reached.add(key)
          changed = true
        }
      }
    }
    assert.equal(reached.size, keys.size)

    for (const key of keys) {
      assert.equal(occupiedByCluster.has(key), false)
      occupiedByCluster.set(key, clusterIndex)
    }
  })

  for (const [key, clusterIndex] of occupiedByCluster) {
    const [column, row] = key.split(',').map(Number)
    for (const [offsetX, offsetY] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const neighborClusterIndex = occupiedByCluster.get(
        `${column + offsetX},${row + offsetY}`,
      )
      assert.ok(
        neighborClusterIndex === undefined || neighborClusterIndex === clusterIndex,
      )
    }
  }
})

test('reinforced clusters only thicken existing main-body cells', () => {
  const definition = prepareRhombusBossDefinition()
  const mainSlots = definition.creature.body.slots.filter(
    (slot) => slot.topologyComponentId === RHOMBUS_COMPONENT.MAIN,
  )
  const reinforcedDurability = Math.max(
    ...mainSlots.map((slot) => slot.maxDurability),
  )
  const baseDurability = Math.min(
    ...mainSlots.map((slot) => slot.maxDurability),
  )
  const reinforcedCellCount = definition.reinforcedClusters.reduce(
    (total, cluster) => total + cluster.cells.length,
    0,
  )

  assert.ok(reinforcedDurability > baseDurability)
  assert.equal(
    mainSlots.filter((slot) => slot.maxDurability === reinforcedDurability).length,
    reinforcedCellCount,
  )
  assert.equal(
    definition.creature.body.slots
      .filter((slot) => slot.topologyComponentId !== RHOMBUS_COMPONENT.MAIN)
      .some((slot) => slot.maxDurability === reinforcedDurability),
    false,
  )
  assert.equal(
    definition.compileDiagnostics.reinforcedAcceptedCandidateCount,
    definition.reinforcedClusters.length,
  )
  assert.ok(
    definition.compileDiagnostics.reinforcedCandidateCount >=
      definition.compileDiagnostics.reinforcedAcceptedCandidateCount +
        definition.compileDiagnostics.reinforcedRejectedCandidateCount,
  )
  assert.ok(definition.compileDiagnostics.reinforcedRejectedCandidateCount > 0)
  assert.ok(
    Number.isFinite(
      definition.compileDiagnostics.reinforcedCompileTimeMs,
    ),
  )
  assert.ok(definition.compileDiagnostics.reinforcedCompileTimeMs >= 0)
})

test('reinforced compiler rejects a count beyond its legal prefix', () => {
  assert.throws(
    () =>
      compileReinforcedClusters({
        cells: compileDigitalDiamond(15),
        requestedClusterCount: Number.MAX_SAFE_INTEGER,
        seed: 'rhombus-content-v1',
      }),
    /cluster count/i,
  )
})

test('asset-backed RHOMBUS enters the creature registry only after LOADING activation', () => {
  const loadingContent = prepareGameContent()
  const rhombus = loadingContent.rhombusBossDefinition.creature

  assert.equal(loadingContent.creatureDefinitions[rhombus.id], undefined)

  const readyContent = activateRhombusBossContent(loadingContent)
  assert.equal(readyContent.creatureDefinitions[rhombus.id], rhombus)
  assert.equal(activateRhombusBossContent(readyContent), readyContent)
})
