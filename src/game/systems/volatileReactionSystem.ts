import { isGlyphLivingState } from '../glyph/glyphStore.ts'
import {
  startVolatilePresentation,
  type VolatileExplosionEvent,
  type VolatileReactionChain,
} from '../runtime/volatileState.ts'
import { recordWeaponDamage } from '../runtime/runStatistics.ts'
import type { WorldState } from '../runtime/worldState.ts'
import {
  DAMAGE_APPLICATION_ROUTE,
  applyDamageApplication,
} from './damageApplication.ts'
import { createGlyphTopologyIndex } from './glyphTopologyPath.ts'

function getPresentationDurationMs(world: WorldState): number {
  const profile =
    world.content.combatVisualTheme.effects.runModifiers.volatile
  const sourceDuration =
    profile.sourceClamp.attackDurationMs +
    profile.sourceClamp.holdDurationMs +
    profile.sourceClamp.settleDurationMs
  const releaseDuration =
    profile.release.delayMs +
    profile.release.attackDurationMs +
    profile.release.holdDurationMs +
    profile.release.settleDurationMs
  const joltDuration =
    profile.neighborJolt.delayMs +
    profile.neighborJolt.attackDurationMs +
    profile.neighborJolt.holdDurationMs +
    profile.neighborJolt.settleDurationMs
  return Math.max(sourceDuration, releaseDuration, joltDuration)
}

function recycleWave(
  world: WorldState,
  wave: VolatileExplosionEvent[],
): void {
  world.volatileState.explosionEventPool.push(...wave)
  wave.length = 0
}

function promoteNextWave(
  world: WorldState,
  chain: VolatileReactionChain,
): void {
  if (
    chain.currentWaveIndex < chain.currentWave.length ||
    chain.nextWave.length === 0
  ) {
    return
  }
  recycleWave(world, chain.currentWave)
  const previousWave = chain.currentWave
  chain.currentWave = chain.nextWave
  chain.nextWave = previousWave
  chain.currentWaveIndex = 0
  chain.waveDepth += 1
  chain.currentWave.sort(
    (first, second) => first.sourceGlyphId - second.sourceGlyphId,
  )
}

function resolveExplosion(
  world: WorldState,
  chain: VolatileReactionChain,
  event: VolatileExplosionEvent,
): void {
  const profile = world.runModifierState.resolvedProfile.volatile
  if (!profile) {
    return
  }
  const ownerGlyphs = world.glyphStore.getOwnerGlyphs(event.ownerId)
  const topology = createGlyphTopologyIndex(
    ownerGlyphs.map((glyph) => ({
      id: glyph.id,
      topologyX: glyph.topologyX,
      topologyY: glyph.topologyY,
      worldX: 0,
      worldY: 0,
    })),
  )
  const source = topology.cellById.get(event.sourceGlyphId)
  const neighbors = source
    ? [...(topology.neighborsById.get(source.id) ?? [])].sort(
        (first, second) => first.id - second.id,
      )
    : []
  const presentationNeighbors = neighbors.map((neighbor) => ({
    id: neighbor.id,
    directionX: neighbor.topologyX - (source?.topologyX ?? 0),
    directionY: neighbor.topologyY - (source?.topologyY ?? 0),
  }))
  const joltedGlyphIds: number[] = []
  const damage = Math.min(
    event.sourceMaxDurability * profile.sourceMaxDurabilityRatio,
    profile.maximumExplosionDamage,
  )
  for (const neighbor of neighbors) {
    world.diagnostics.volatileSecondaryCandidateCount += 1
    const target = world.glyphStore.getById(neighbor.id)
    if (!target || !isGlyphLivingState(target.state)) {
      world.diagnostics.volatileSkippedHuskTargetCount += 1
      continue
    }
    const directionX = neighbor.topologyX - (source?.topologyX ?? 0)
    const directionY = neighbor.topologyY - (source?.topologyY ?? 0)
    const outcome = applyDamageApplication(world, {
      rootAttackEventId: event.rootAttackEventId,
      reactionChainId: chain.id,
      route: DAMAGE_APPLICATION_ROUTE.VOLATILE_SECONDARY,
      sourceWeaponInstanceId: event.sourceWeaponInstanceId,
      targetGlyphId: neighbor.id,
      baseDamage: damage,
      impactDirectionX: directionX,
      impactDirectionY: directionY,
    })
    if (outcome.actualAppliedDurabilityDelta <= 0) {
      continue
    }
    joltedGlyphIds.push(neighbor.id)
    world.diagnostics.volatileSecondaryAppliedCount += 1
    recordWeaponDamage(
      world.runStatistics,
      event.sourceWeaponInstanceId,
      outcome.actualAppliedDurabilityDelta,
    )
  }
  startVolatilePresentation(
    world.volatileState,
    event.sourceGlyphId,
    event.ownerId,
    event.waveDepth,
    getPresentationDurationMs(world),
    presentationNeighbors,
    joltedGlyphIds,
  )
  world.diagnostics.volatileExplosionResolutionCount += 1
  world.diagnostics.volatileExplosionsResolvedThisStep += 1
  world.diagnostics.maximumObservedVolatileWaveDepth = Math.max(
    world.diagnostics.maximumObservedVolatileWaveDepth,
    event.waveDepth,
  )
}

function removeCompletedChains(world: WorldState): void {
  for (
    let index = world.volatileState.activeChains.length - 1;
    index >= 0;
    index -= 1
  ) {
    const chain = world.volatileState.activeChains[index]
    if (
      chain.currentWaveIndex < chain.currentWave.length ||
      chain.nextWave.length > 0
    ) {
      continue
    }
    recycleWave(world, chain.currentWave)
    world.volatileState.chainById.delete(chain.id)
    world.volatileState.activeChains.splice(index, 1)
    world.volatileState.chainPool.push(chain)
  }
}

function updateDiagnostics(world: WorldState): void {
  let deferredCount = 0
  let currentWaveCount = 0
  let nextWaveCount = 0
  for (const chain of world.volatileState.activeChains) {
    const currentCount = chain.currentWave.length - chain.currentWaveIndex
    currentWaveCount += currentCount
    nextWaveCount += chain.nextWave.length
    deferredCount += currentCount + chain.nextWave.length
  }
  world.diagnostics.deferredVolatileExplosionCount = deferredCount
  world.diagnostics.activeVolatileCurrentWaveEventCount = currentWaveCount
  world.diagnostics.activeVolatileNextWaveEventCount = nextWaveCount
  world.diagnostics.volatileSchedulerPoolMisses =
    world.volatileState.schedulerPoolMissCount
  world.diagnostics.volatileCorePresentationPoolMisses =
    world.volatileState.presentationPoolMissCount
  const activeCount = world.volatileState.activeChains.length
  world.diagnostics.activeVolatileReactionChainCount = activeCount
  world.diagnostics.peakVolatileReactionChainCount = Math.max(
    world.diagnostics.peakVolatileReactionChainCount,
    activeCount,
  )
}

/** Resolves current BFS waves under one fair global fixed-step budget. */
export function runVolatileReactionSystem(world: WorldState): void {
  world.diagnostics.volatileExplosionsResolvedThisStep = 0
  const profile = world.runModifierState.resolvedProfile.volatile
  if (!profile || world.volatileState.activeChains.length === 0) {
    updateDiagnostics(world)
    return
  }
  world.volatileState.activeChains.sort((first, second) => first.id - second.id)
  for (const chain of world.volatileState.activeChains) {
    promoteNextWave(world, chain)
    chain.currentWave.sort(
      (first, second) => first.sourceGlyphId - second.sourceGlyphId,
    )
  }

  let remainingBudget = profile.maxExplosionResolutionsPerFixedStep
  while (remainingBudget > 0) {
    const chains = world.volatileState.activeChains
    const cursor = world.volatileState.nextChainIdForResolution
    let selectedIndex = chains.findIndex(
      (chain) =>
        chain.currentWaveIndex < chain.currentWave.length &&
        (cursor === null || chain.id >= cursor),
    )
    if (selectedIndex < 0) {
      selectedIndex = chains.findIndex(
        (chain) => chain.currentWaveIndex < chain.currentWave.length,
      )
    }
    if (selectedIndex < 0) {
      break
    }
    const chain = chains[selectedIndex]
    const event = chain.currentWave[chain.currentWaveIndex]
    chain.currentWaveIndex += 1
    world.volatileState.nextChainIdForResolution =
      chains[(selectedIndex + 1) % chains.length]?.id ?? null
    resolveExplosion(world, chain, event)
    remainingBudget -= 1
  }
  removeCompletedChains(world)
  updateDiagnostics(world)
}
