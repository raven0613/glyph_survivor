import assert from 'node:assert/strict'
import test from 'node:test'
import { Particle, ParticleContainer, Rectangle, Texture } from 'pixi.js'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
  type RenderGlyph,
} from '../../src/game/bridge/renderSnapshot.ts'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { RUN_MODIFIER_EFFECT_STRATEGY } from '../../src/game/content/modifiers/runModifierDefinition.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { PROTOTYPE_COMBAT_VISUAL_THEME } from '../../src/game/content/visuals/prototypeCombatVisualTheme.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../../src/game/glyph/glyphPosition.ts'
import { startOverloadPresentation } from '../../src/game/runtime/overloadPresentationState.ts'
import { enqueueVolatileSource, startVolatilePresentation } from '../../src/game/runtime/volatileState.ts'
import {
  createWorldState,
  spawnEnemy,
  type WorldState,
} from '../../src/game/runtime/worldState.ts'
import {
  countCrackedFragmentAtlasSources,
  createCrackedSurfacePool,
} from '../../src/game/rendering/crackedSurfacePool.ts'
import type { CrackedGlyphFragmentFrame } from '../../src/game/rendering/crackedGlyphFragmentFrame.ts'
import { runDisconnectedTopologySystem } from '../../src/game/systems/disconnectedTopologySystem.ts'
import { runModifierPresentationSystem } from '../../src/game/systems/modifierPresentationSystem.ts'
import { runVolatileReactionSystem } from '../../src/game/systems/volatileReactionSystem.ts'

function createWorldWithAllModifiers(seed: string): WorldState {
  const content = prepareGameContent()
  const world = createWorldState(
    seed,
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const volatile = content.runModifierDefinitions.find(
    ({ effectStrategyId }) =>
      effectStrategyId === RUN_MODIFIER_EFFECT_STRATEGY.VOLATILE,
  )
  const disconnected = content.runModifierDefinitions.find(
    ({ effectStrategyId }) =>
      effectStrategyId === RUN_MODIFIER_EFFECT_STRATEGY.DISCONNECTED,
  )
  const overload = content.runModifierDefinitions.find(
    ({ effectStrategyId }) =>
      effectStrategyId === RUN_MODIFIER_EFFECT_STRATEGY.OVERLOAD,
  )
  assert.ok(
    volatile?.effectStrategyId === RUN_MODIFIER_EFFECT_STRATEGY.VOLATILE,
  )
  assert.ok(
    disconnected?.effectStrategyId ===
      RUN_MODIFIER_EFFECT_STRATEGY.DISCONNECTED,
  )
  assert.ok(
    overload?.effectStrategyId === RUN_MODIFIER_EFFECT_STRATEGY.OVERLOAD,
  )
  world.runModifierState.resolvedProfile = Object.freeze({
    volatile: volatile.volatile,
    disconnected: disconnected.disconnected,
    overload: overload.overload,
  })
  return world
}

function spawnSlimes(world: WorldState, count: number): void {
  for (let index = 0; index < count; index += 1) {
    const slime = spawnEnemy(
      world,
      world.player.x,
      world.player.y,
      0,
      world.content.slimeBossDefinition,
    )
    slime.phase = 'ACTIVE'
  }
}

function createFragmentFrames(): readonly (readonly Readonly<CrackedGlyphFragmentFrame>[])[] {
  return [
    [
      { x: 0, y: 0, width: 64, height: 21, centerOffsetX: 0, centerOffsetY: -21.5, texture: Texture.EMPTY },
      { x: 0, y: 21, width: 64, height: 22, centerOffsetX: 0, centerOffsetY: 0, texture: Texture.EMPTY },
      { x: 0, y: 43, width: 64, height: 21, centerOffsetX: 0, centerOffsetY: 21.5, texture: Texture.EMPTY },
    ],
  ]
}

function createCrackedSurface(id: number): RenderGlyph & { patternIndex: number } {
  return {
    id,
    glyphFrame: 0,
    x: id % 100,
    y: Math.floor(id / 100),
    rotation: 0,
    scale: 0.5,
    alpha: 1,
    tint: 0xffffff,
    patternIndex: id % 3,
  }
}

test('measures pooled CRACKED surfaces at 25, 50, and 100 percent of 5,000 visible Glyphs', (context) => {
  const container = new ParticleContainer<Particle>({
    texture: Texture.EMPTY,
    boundsArea: new Rectangle(0, 0, 100, 100),
    dynamicProperties: {
      position: true,
      rotation: true,
      vertex: true,
      uvs: false,
      color: true,
    },
  })
  const fragmentFrames = createFragmentFrames()
  const pool = createCrackedSurfacePool(
    container,
    fragmentFrames,
    PROTOTYPE_COMBAT_VISUAL_THEME.effects.runModifiers.overload.crackedSurface,
  )
  const allSurfaces = Array.from({ length: 5_000 }, (_, index) =>
    createCrackedSurface(index + 1),
  )
  const measurements: string[] = []

  for (const ratio of [0.25, 0.5, 1]) {
    const surfaceCount = 5_000 * ratio
    const startedAt = performance.now()
    pool.sync(allSurfaces.slice(0, surfaceCount))
    const elapsedMs = performance.now() - startedAt
    measurements.push(`${ratio * 100}%=${elapsedMs.toFixed(2)}ms`)
    assert.equal(
      pool.getDiagnostics().activeFragmentParticleCount,
      surfaceCount * 3,
    )
  }

  assert.equal(countCrackedFragmentAtlasSources(fragmentFrames), 1)
  assert.equal(pool.getDiagnostics().peakFragmentParticleCount, 15_000)
  const missesAtPeak = pool.getDiagnostics().poolMissCount
  pool.sync([])
  pool.sync(allSurfaces)
  assert.equal(pool.getDiagnostics().poolMissCount, missesAtPeak)
  context.diagnostic(`CRACKED pool sync: ${measurements.join(', ')}`)
  pool.clear()
})

test('measures 5,000 visible Glyphs with all three Modifier presentation channels active', (context) => {
  const world = createWorldWithAllModifiers('modifier-render-stress')
  spawnSlimes(world, 100)
  const glyphs = world.glyphStore.cells
  assert.equal(glyphs.length, 5_000)
  for (const glyph of glyphs) {
    assert.equal(world.glyphStore.applyCracked(glyph.id, 1), true)
    assert.equal(world.glyphStore.applyDisconnectedLatch(glyph.id, 1.6, 1), true)
  }
  runDisconnectedTopologySystem(world)
  for (const glyph of glyphs.slice(0, 64)) {
    startOverloadPresentation(world.overloadPresentation, glyph.id, 1, 0, 200)
    startVolatilePresentation(
      world.volatileState,
      glyph.id,
      glyph.ownerId,
      0,
      100,
      [{ id: glyph.id, directionX: 1, directionY: 0 }],
      [glyph.id],
    )
  }
  runModifierPresentationSystem(world, 20)
  const snapshot = createRenderSnapshot()
  const startedAt = performance.now()

  writeRenderSnapshot(world, snapshot, 1)

  const elapsedMs = performance.now() - startedAt
  assert.equal(snapshot.enemies.length, 5_000)
  assert.equal(snapshot.crackedSurfaces.length, 4_936)
  assert.equal(snapshot.overloadDeformations.length, 64)
  assert.equal(snapshot.overloadShockwaves.length, 512)
  assert.equal(snapshot.volatileCoreOverlays.length, 64)
  assert.equal(snapshot.overloadDeformations[0].scale, glyphs[0].scale)
  const firstRendered = snapshot.enemies.find(({ id }) => id === glyphs[0].id)
  assert.ok(firstRendered)
  const firstOwner = world.enemyById.get(glyphs[0].ownerId)
  assert.ok(firstOwner)
  assert.ok(
    Math.hypot(
      firstRendered.x - getGlyphWorldX(firstOwner.x, glyphs[0]),
      firstRendered.y - getGlyphWorldY(firstOwner.y, glyphs[0]),
    ) <=
      world.content.combatVisualTheme.effects.runModifiers.composition
        .maximumOffset,
  )
  context.diagnostic(
    `5,000-Glyph combined Modifier snapshot sync=${elapsedMs.toFixed(2)}ms`,
  )
})

test('resolves exactly the configured VOLATILE source budget and defers the rest without loss', (context) => {
  const world = createWorldWithAllModifiers('volatile-budget-stress')
  const volatile = world.runModifierState.resolvedProfile.volatile
  assert.ok(volatile)
  const resolutionBudget = volatile.maxExplosionResolutionsPerFixedStep
  while (world.glyphStore.cells.length <= resolutionBudget) {
    spawnSlimes(world, 1)
  }
  const sources = world.glyphStore.cells.slice(0, resolutionBudget + 1)
  for (const source of sources) {
    world.glyphStore.applyDamage(source.id, source.currentDurability)
    enqueueVolatileSource(world.volatileState, {
      sourceGlyphId: source.id,
      ownerId: source.ownerId,
      sourceMaxDurability: source.maxDurability,
      rootAttackEventId: source.id,
      sourceWeaponInstanceId: world.weaponLoadout.equipped[0].id,
      causingApplicationId: source.id,
      reactionChainId: null,
      appendToNextWave: false,
    })
  }
  const startedAt = performance.now()

  runVolatileReactionSystem(world, 0)

  const firstStepMs = performance.now() - startedAt
  assert.equal(
    world.diagnostics.volatileExplosionsResolvedThisStep,
    resolutionBudget,
  )
  assert.equal(world.diagnostics.deferredVolatileExplosionCount, 1)
  assert.equal(
    world.volatileState.activePresentationEvents.length,
    resolutionBudget,
  )
  runVolatileReactionSystem(world, 0)
  assert.equal(world.diagnostics.volatileExplosionsResolvedThisStep, 1)
  assert.equal(world.diagnostics.deferredVolatileExplosionCount, 0)
  assert.equal(
    world.diagnostics.volatileExplosionResolutionCount,
    resolutionBudget + 1,
  )
  context.diagnostic(
    `${resolutionBudget}-source VOLATILE headless step=${firstStepMs.toFixed(2)}ms`,
  )
})
