import { classifyDisconnectedTopology } from '../glyph/disconnectedTopology.ts'
import type { WorldState } from '../runtime/worldState.ts'

export function invalidateDisconnectedTopologyOwner(
  world: WorldState,
  ownerId: number,
): void {
  world.disconnectedState.topologyByOwnerId.delete(ownerId)
}

export function getDisconnectedTopologySnapshot(
  world: WorldState,
  ownerId: number,
) {
  const parameters = world.runModifierState.resolvedProfile.disconnected
  if (!parameters) {
    return null
  }
  const cached = world.disconnectedState.topologyByOwnerId.get(ownerId)
  if (cached) {
    return cached
  }
  const startedAtMs = performance.now()
  const snapshot = classifyDisconnectedTopology(
    ownerId,
    world.glyphStore.getOwnerGlyphs(ownerId),
    parameters,
  )
  world.diagnostics.disconnectedTopologyCacheRebuildCount += 1
  world.diagnostics.disconnectedTopologyCacheRebuildTimeMs +=
    performance.now() - startedAtMs
  world.disconnectedState.topologyByOwnerId.set(ownerId, snapshot)
  return snapshot
}

/** Keeps the read-only presentation cache current without per-frame topology work. */
export function runDisconnectedTopologySystem(world: WorldState): void {
  if (!world.runModifierState.resolvedProfile.disconnected) {
    world.disconnectedState.topologyByOwnerId.clear()
    world.diagnostics.disconnectedProtectedComponentCount = 0
    world.diagnostics.disconnectedVulnerableComponentCount = 0
    return
  }
  for (const ownerId of world.disconnectedState.topologyByOwnerId.keys()) {
    if (!world.enemyById.has(ownerId)) {
      world.disconnectedState.topologyByOwnerId.delete(ownerId)
    }
  }
  for (const enemy of world.enemies) {
    if (enemy.phase !== 'DEAD') {
      getDisconnectedTopologySnapshot(world, enemy.id)
    }
  }
  let protectedCount = 0
  let vulnerableCount = 0
  for (const snapshot of world.disconnectedState.topologyByOwnerId.values()) {
    protectedCount += snapshot.protectedComponentCount
    vulnerableCount += snapshot.vulnerableComponentCount
  }
  world.diagnostics.disconnectedProtectedComponentCount = protectedCount
  world.diagnostics.disconnectedVulnerableComponentCount = vulnerableCount
}
