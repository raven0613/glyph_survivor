import assert from 'node:assert/strict'
import test from 'node:test'
import { Particle, ParticleContainer, Rectangle, Texture } from 'pixi.js'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
  type RenderGlyph,
} from '../../src/game/bridge/renderSnapshot.ts'
import {
  getCreatureDefinition,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { PRINTABLE_ASCII_GLYPH_COUNT } from '../../src/game/glyph/glyphFrame.ts'
import { isGlyphLivingState } from '../../src/game/glyph/glyphStore.ts'
import { spawnProjectile } from '../../src/game/runtime/spawnProjectile.ts'
import {
  createWorldState,
  spawnEnemy,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import { createParticleLayerPool } from '../../src/game/rendering/particleLayerPool.ts'
import { runCreatureBodyMotionSystem } from '../../src/game/systems/creatureBodyMotionSystem.ts'

interface StressScenario {
  readonly name: string
  readonly slimeCount: number
  readonly snakeCount: number
  readonly zombieCount: number
  readonly expectedCreatureCount: number
  readonly expectedLivingGlyphCount: number
  readonly expectedAnimatedCreatureCount: number
  readonly expectedAnimatedGlyphCount: number
  readonly projectileCount: number
  readonly visualParticleCount: number
}

const ORDINARY_COMBAT_SCENARIO: StressScenario = Object.freeze({
  name: 'ordinary combat',
  slimeCount: 20,
  snakeCount: 180,
  zombieCount: 100,
  expectedCreatureCount: 300,
  expectedLivingGlyphCount: 2_000,
  expectedAnimatedCreatureCount: 280,
  expectedAnimatedGlyphCount: 1_000,
  projectileCount: 500,
  visualParticleCount: 2_000,
})

const BOSS_STRESS_SCENARIO: StressScenario = Object.freeze({
  name: 'Boss stress',
  slimeCount: 56,
  snakeCount: 444,
  zombieCount: 0,
  expectedCreatureCount: 500,
  expectedLivingGlyphCount: 5_020,
  expectedAnimatedCreatureCount: 444,
  expectedAnimatedGlyphCount: 2_220,
  projectileCount: 1_000,
  visualParticleCount: 5_000,
})

function spawnActiveCreatures(
  world: WorldState,
  definitionId: string,
  count: number,
): void {
  const definition = getCreatureDefinition(world.content, definitionId)
  for (let index = 0; index < count; index += 1) {
    const enemy = spawnEnemy(
      world,
      world.player.x,
      world.player.y,
      0,
      definition,
    )
    enemy.phase = 'ACTIVE'
    enemy.velocityX = index % 2 === 0 ? definition.maximumSpeed : -definition.maximumSpeed
  }
}

function createStressWorld(scenario: StressScenario): WorldState {
  const content = prepareGameContent()
  const world = createWorldState(
    `body-motion-${scenario.name}`,
    1_920,
    1_080,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  spawnActiveCreatures(
    world,
    content.slimeBossDefinition.id,
    scenario.slimeCount,
  )
  spawnActiveCreatures(world, 'enemy.snake', scenario.snakeCount)
  spawnActiveCreatures(world, 'enemy.zombie', scenario.zombieCount)

  const weapon = world.weaponLoadout.equipped[0]
  const profile = weapon.resolvedProfile
  if (profile.targetStrategyId !== 'AIM_ASSISTED') {
    throw new Error('Stress fixture requires an assisted projectile profile.')
  }
  for (let index = 0; index < scenario.projectileCount; index += 1) {
    spawnProjectile(world, {
      sourceWeaponInstanceId: weapon.id,
      x: world.player.x,
      y: world.player.y,
      directionX: 1,
      directionY: 0,
      profile,
      targetEnemyId: null,
    })
  }
  return world
}

function createLayerPool() {
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
    Array.from({ length: PRINTABLE_ASCII_GLYPH_COUNT }, () => Texture.EMPTY),
  )
}

function createVisualParticles(count: number): readonly RenderGlyph[] {
  return Array.from({ length: count }, (_, index) => ({
    id: -(index + 1),
    glyphFrame: index % PRINTABLE_ASCII_GLYPH_COUNT,
    x: index % 1_920,
    y: Math.floor(index / 1_920),
    rotation: 0,
    scale: 0.5,
    alpha: 1,
    tint: 0xffffff,
  }))
}

function percentile95(samples: readonly number[]): number {
  const ordered = [...samples].sort((left, right) => left - right)
  return ordered[Math.ceil(ordered.length * 0.95) - 1]
}

function assertFiniteRenderGlyphs(glyphs: readonly RenderGlyph[]): void {
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

function runStressScenario(
  scenario: StressScenario,
  diagnostic: (message: string) => void,
): void {
  const world = createStressWorld(scenario)
  const snapshot = createRenderSnapshot()
  const enemyPool = createLayerPool()
  const projectilePool = createLayerPool()
  const visualParticlePool = createLayerPool()
  const visualParticles = createVisualParticles(scenario.visualParticleCount)
  const bodyMotionSamples: number[] = []
  const snapshotSamples: number[] = []
  const poolSyncSamples: number[] = []
  const fixedStepMs = 1_000 / 60

  runCreatureBodyMotionSystem(world, fixedStepMs)
  writeRenderSnapshot(world, snapshot, 1)
  enemyPool.sync(snapshot.enemies)
  projectilePool.sync(snapshot.projectiles)
  visualParticlePool.sync(visualParticles)
  const enemyPoolMissesAfterWarmup = enemyPool.getDiagnostics().poolMissCount
  const projectilePoolMissesAfterWarmup =
    projectilePool.getDiagnostics().poolMissCount
  const visualPoolMissesAfterWarmup =
    visualParticlePool.getDiagnostics().poolMissCount

  for (let sampleIndex = 0; sampleIndex < 30; sampleIndex += 1) {
    const bodyMotionStartedAt = performance.now()
    runCreatureBodyMotionSystem(world, fixedStepMs)
    bodyMotionSamples.push(performance.now() - bodyMotionStartedAt)

    const snapshotStartedAt = performance.now()
    writeRenderSnapshot(world, snapshot, 1)
    snapshotSamples.push(performance.now() - snapshotStartedAt)

    const poolSyncStartedAt = performance.now()
    enemyPool.sync(snapshot.enemies)
    projectilePool.sync(snapshot.projectiles)
    visualParticlePool.sync(visualParticles)
    poolSyncSamples.push(performance.now() - poolSyncStartedAt)
  }

  const livingGlyphCount = world.glyphStore.cells.filter((glyph) =>
    isGlyphLivingState(glyph.state),
  ).length
  const huskGlyphCount = world.glyphStore.cells.length - livingGlyphCount
  assert.equal(world.enemies.length, scenario.expectedCreatureCount)
  assert.equal(livingGlyphCount, scenario.expectedLivingGlyphCount)
  assert.equal(huskGlyphCount, 0)
  assert.equal(world.projectiles.length, scenario.projectileCount)
  assert.equal(snapshot.enemies.length, scenario.expectedLivingGlyphCount)
  assert.equal(snapshot.projectiles.length, scenario.projectileCount)
  assert.equal(
    world.diagnostics.bodyMotionActiveCreatureCount,
    scenario.expectedAnimatedCreatureCount,
  )
  assert.equal(
    world.diagnostics.bodyMotionActiveGlyphCount,
    scenario.expectedAnimatedGlyphCount,
  )
  assert.equal(Number.isFinite(world.diagnostics.bodyMotionStepTimeMs), true)
  assert.equal(enemyPool.getDiagnostics().poolMissCount, enemyPoolMissesAfterWarmup)
  assert.equal(
    projectilePool.getDiagnostics().poolMissCount,
    projectilePoolMissesAfterWarmup,
  )
  assert.equal(
    visualParticlePool.getDiagnostics().poolMissCount,
    visualPoolMissesAfterWarmup,
  )
  assert.equal(
    visualParticlePool.getDiagnostics().activeParticleCount,
    scenario.visualParticleCount,
  )
  assertFiniteRenderGlyphs(snapshot.enemies)
  assertFiniteRenderGlyphs(snapshot.projectiles)

  diagnostic(
    `${scenario.name}: creatures=${world.enemies.length}, ` +
      `Living Glyphs=${livingGlyphCount}, Husks=${huskGlyphCount}, ` +
      `projectiles=${world.projectiles.length}, ` +
      `visual particles=${scenario.visualParticleCount}; ` +
      `Body Motion p95=${percentile95(bodyMotionSamples).toFixed(2)}ms, ` +
      `snapshot p95=${percentile95(snapshotSamples).toFixed(2)}ms, ` +
      `pool sync p95=${percentile95(poolSyncSamples).toFixed(2)}ms`,
  )

  enemyPool.clear()
  projectilePool.clear()
  visualParticlePool.clear()
}

test('profiles the documented ordinary-combat population without changing authoritative motion', (context) => {
  runStressScenario(ORDINARY_COMBAT_SCENARIO, (message) => {
    context.diagnostic(message)
  })
})

test('profiles the documented Boss-stress population without changing authoritative motion', (context) => {
  runStressScenario(BOSS_STRESS_SCENARIO, (message) => {
    context.diagnostic(message)
  })
})
