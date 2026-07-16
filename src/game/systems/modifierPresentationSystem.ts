import type { WorldState } from '../runtime/worldState.ts'
import { stepOverloadPresentation } from '../runtime/overloadPresentationState.ts'
import { stepDisconnectedHitPresentation } from '../runtime/disconnectedState.ts'
import { stepVolatilePresentation } from '../runtime/volatileState.ts'

/** Advances Runtime-owned presentation time only during fixed gameplay steps. */
export function runModifierPresentationSystem(
  world: WorldState,
  deltaMs: number,
): void {
  stepOverloadPresentation(world.overloadPresentation, deltaMs)
  stepDisconnectedHitPresentation(world.disconnectedState, deltaMs)
  stepVolatilePresentation(world.volatileState, deltaMs)
  const volatileCount = world.volatileState.activePresentationEvents.length
  world.diagnostics.activeVolatilePresentationEventCount = volatileCount
  world.diagnostics.peakVolatilePresentationEventCount = Math.max(
    world.diagnostics.peakVolatilePresentationEventCount,
    volatileCount,
  )
  const activeCount = world.overloadPresentation.activeEvents.length
  world.diagnostics.activeOverloadPresentationEventCount = activeCount
  world.diagnostics.peakOverloadPresentationEventCount = Math.max(
    world.diagnostics.peakOverloadPresentationEventCount,
    activeCount,
  )
  const disconnectedHitCount = world.disconnectedState.activeHitEvents.length
  world.diagnostics.activeDisconnectedHitPresentationCount =
    disconnectedHitCount
  world.diagnostics.peakDisconnectedHitPresentationCount = Math.max(
    world.diagnostics.peakDisconnectedHitPresentationCount,
    disconnectedHitCount,
  )
}
