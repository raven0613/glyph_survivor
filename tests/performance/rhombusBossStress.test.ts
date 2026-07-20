import assert from 'node:assert/strict'
import test from 'node:test'
import { Particle, ParticleContainer, Rectangle, Texture } from 'pixi.js'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
  type RenderGlyph,
} from '../../src/game/bridge/renderSnapshot.ts'
import {
  activateRhombusBossContent,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { isGlyphLivingState } from '../../src/game/glyph/glyphStore.ts'
import { createParticleLayerPool } from '../../src/game/rendering/particleLayerPool.ts'
import {
  createWorldState,
  spawnEnemy,
} from '../../src/game/runtime/worldState.ts'
import { runCreatureBodyMotionSystem } from '../../src/game/systems/creatureBodyMotionSystem.ts'
import { runGlyphDiagnosticsSystem } from '../../src/game/systems/glyphDiagnosticsSystem.ts'
import { runHostileProjectileSystem } from '../../src/game/systems/hostileProjectileSystem.ts'
import { runRhombusSpiralAttackSystem } from '../../src/game/systems/rhombusSpiralAttackSystem.ts'

const RHOMBUS_COUNT = 11
const RHOMBUS_GLYPH_COUNT = 463
const EXPECTED_LIVING_GLYPH_COUNT = RHOMBUS_COUNT * RHOMBUS_GLYPH_COUNT
const SAMPLE_COUNT = 30

function createLayerPool(textureCount: number) {
  const container = new ParticleContainer<Particle>({
    texture: Texture.EMPTY,
    boundsArea: new Rectangle(0, 0, 1_920, 1_080),
    dynamicProperties: {
      position: true,
      rotation: true,
      vertex: true,
      uvs: false,
      color: true,
    },
  })
  return createParticleLayerPool(
    container,
    Array.from({ length: textureCount }, () => Texture.EMPTY),
  )
}

function percentile95(samples: readonly number[]): number {
  const ordered = [...samples].sort((left, right) => left - right)
  return ordered[Math.ceil(ordered.length * 0.95) - 1]
}

function assertFiniteGlyphs(glyphs: readonly RenderGlyph[]): void {
  for (const glyph of glyphs) {
    assert.equal(
      [
        glyph.x,
        glyph.y,
        glyph.rotation,
        glyph.scale,
        glyph.alpha,
        glyph.tint,
      ].every(Number.isFinite),
      true,
    )
  }
}

test('profiles active RHOMBUS encounters above the 5,000 Living-Glyph Boss target', (context) => {
  const content = activateRhombusBossContent(prepareGameContent())
  const world = createWorldState(
    'rhombus-5000-glyph-stress',
    1_920,
    1_080,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )

  for (let index = 0; index < RHOMBUS_COUNT; index += 1) {
    const rhombus = spawnEnemy(
      world,
      world.player.x,
      world.player.y,
      0,
      content.rhombusBossDefinition.creature,
    )
    rhombus.phase = 'ACTIVE'
    for (const state of rhombus.componentOrbitStates) {
      state.initialDelayRemainingMs = 0
      state.pauseRemainingMs = 0
    }
  }

  runRhombusSpiralAttackSystem(world, 0)
  runHostileProjectileSystem(world, 0)

  const textureCount = content.glyphFontBanks.totalFrameCount
  const behindPool = createLayerPool(textureCount)
  const bodyPool = createLayerPool(textureCount)
  const frontPool = createLayerPool(textureCount)
  const hostileProjectilePool = createLayerPool(textureCount)
  const snapshot = createRenderSnapshot()
  const bodyMotionSamples: number[] = []
  const snapshotSamples: number[] = []
  const poolSyncSamples: number[] = []
  const fixedStepMs = 1_000 / 60

  runCreatureBodyMotionSystem(world, fixedStepMs)
  writeRenderSnapshot(world, snapshot, 1)
  behindPool.sync(snapshot.enemiesBehind)
  bodyPool.sync(snapshot.enemies)
  frontPool.sync(snapshot.enemiesFront)
  hostileProjectilePool.sync(snapshot.projectiles)
  const maximumOrbitCycleMs = Math.max(
    ...content.rhombusBossDefinition.orbitProfiles.map(
      (profile) =>
        profile.initialDelayMs +
        profile.cadenceOffsetMs +
        profile.revolutionDurationMs +
        profile.postRevolutionPauseMs,
    ),
  )
  const warmupStepCount = Math.ceil(maximumOrbitCycleMs / fixedStepMs) + 1
  for (let warmupIndex = 0; warmupIndex < warmupStepCount; warmupIndex += 1) {
    runCreatureBodyMotionSystem(world, fixedStepMs)
    writeRenderSnapshot(world, snapshot, 1)
    behindPool.sync(snapshot.enemiesBehind)
    bodyPool.sync(snapshot.enemies)
    frontPool.sync(snapshot.enemiesFront)
    hostileProjectilePool.sync(snapshot.projectiles)
  }
  const warmPoolMisses = [
    behindPool.getDiagnostics().poolMissCount,
    bodyPool.getDiagnostics().poolMissCount,
    frontPool.getDiagnostics().poolMissCount,
    hostileProjectilePool.getDiagnostics().poolMissCount,
  ]

  for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; sampleIndex += 1) {
    const bodyMotionStartedAt = performance.now()
    runCreatureBodyMotionSystem(world, fixedStepMs)
    runRhombusSpiralAttackSystem(world, 0)
    runHostileProjectileSystem(world, 0)
    bodyMotionSamples.push(performance.now() - bodyMotionStartedAt)

    const snapshotStartedAt = performance.now()
    writeRenderSnapshot(world, snapshot, 1)
    snapshotSamples.push(performance.now() - snapshotStartedAt)

    const poolSyncStartedAt = performance.now()
    behindPool.sync(snapshot.enemiesBehind)
    bodyPool.sync(snapshot.enemies)
    frontPool.sync(snapshot.enemiesFront)
    hostileProjectilePool.sync(snapshot.projectiles)
    poolSyncSamples.push(performance.now() - poolSyncStartedAt)
  }

  const livingGlyphCount = world.glyphStore.cells.filter((glyph) =>
    isGlyphLivingState(glyph.state),
  ).length
  const renderedEnemyCount =
    snapshot.enemiesBehind.length +
    snapshot.enemies.length +
    snapshot.enemiesFront.length
  const expectedHostileProjectileCount =
    RHOMBUS_COUNT * content.rhombusBossDefinition.attackProfile.spikesPerWave
  runGlyphDiagnosticsSystem(world)

  assert.equal(livingGlyphCount, EXPECTED_LIVING_GLYPH_COUNT)
  assert.equal(renderedEnemyCount, EXPECTED_LIVING_GLYPH_COUNT)
  assert.equal(world.diagnostics.activeRhombusEncounterCount, RHOMBUS_COUNT)
  assert.equal(
    world.diagnostics.activeRhombusGlyphCount,
    EXPECTED_LIVING_GLYPH_COUNT,
  )
  assert.equal(
    world.diagnostics.activeStagedHostileProjectileCount,
    expectedHostileProjectileCount,
  )
  assert.equal(snapshot.projectiles.length, expectedHostileProjectileCount * 2)
  assert.ok(world.diagnostics.componentOrbitTransformEvaluationCount > 0)
  assert.ok(world.diagnostics.componentOrbitGlyphUpdateCount > 0)
  assert.equal(Number.isFinite(world.diagnostics.componentOrbitStepTimeMs), true)
  assert.equal(world.diagnostics.orphanedGlyphCount, 0)
  assert.equal(world.diagnostics.multiplyOwnedGlyphCount, 0)
  assert.deepEqual(
    [
      behindPool.getDiagnostics().poolMissCount,
      bodyPool.getDiagnostics().poolMissCount,
      frontPool.getDiagnostics().poolMissCount,
      hostileProjectilePool.getDiagnostics().poolMissCount,
    ],
    warmPoolMisses,
  )
  assertFiniteGlyphs(snapshot.enemiesBehind)
  assertFiniteGlyphs(snapshot.enemies)
  assertFiniteGlyphs(snapshot.enemiesFront)
  assertFiniteGlyphs(snapshot.projectiles)

  context.diagnostic(
    `RHOMBUS Boss stress: encounters=${RHOMBUS_COUNT}, ` +
      `Living Glyphs=${livingGlyphCount}, staged spikes=${expectedHostileProjectileCount}; ` +
      `orbit/body p95=${percentile95(bodyMotionSamples).toFixed(2)}ms, ` +
      `snapshot p95=${percentile95(snapshotSamples).toFixed(2)}ms, ` +
      `pool sync p95=${percentile95(poolSyncSamples).toFixed(2)}ms`,
  )

  behindPool.clear()
  bodyPool.clear()
  frontPool.clear()
  hostileProjectilePool.clear()
})
