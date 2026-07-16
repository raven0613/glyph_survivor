import type { DisconnectedModifierParameters } from '../content/modifiers/runModifierDefinition.ts'
import { findLivingConnectedComponents, type LivingTopologyCell } from './livingConnectedComponents.ts'

export interface DisconnectedComponentSnapshot {
  readonly id: number
  readonly glyphIds: readonly number[]
  readonly size: number
  readonly centroidTopologyX: number
  readonly centroidTopologyY: number
  readonly isProtected: boolean
  readonly multiplier: number
  readonly severity: number
}

export interface DisconnectedOwnerTopologySnapshot {
  readonly ownerId: number
  readonly totalLivingCellCount: number
  readonly largestComponentSize: number
  readonly components: readonly Readonly<DisconnectedComponentSnapshot>[]
  readonly componentByGlyphId: ReadonlyMap<
    number,
    Readonly<DisconnectedComponentSnapshot>
  >
  readonly protectedComponentCount: number
  readonly vulnerableComponentCount: number
}

export function calculateDisconnectedSeverity(
  multiplier: number,
  maximumDamageMultiplier: number,
): number {
  if (maximumDamageMultiplier <= 1) {
    return 0
  }
  return Math.max(
    0,
    Math.min(1, (multiplier - 1) / (maximumDamageMultiplier - 1)),
  )
}

export function classifyDisconnectedTopology<T extends LivingTopologyCell>(
  ownerId: number,
  cells: readonly T[],
  parameters: Readonly<DisconnectedModifierParameters>,
): Readonly<DisconnectedOwnerTopologySnapshot> {
  const livingComponents = findLivingConnectedComponents(cells)
  const totalLivingCellCount = livingComponents.reduce(
    (total, component) => total + component.length,
    0,
  )
  const largestComponentSize = livingComponents.reduce(
    (largest, component) => Math.max(largest, component.length),
    0,
  )
  const componentByGlyphId = new Map<
    number,
    Readonly<DisconnectedComponentSnapshot>
  >()
  let protectedComponentCount = 0
  let vulnerableComponentCount = 0
  const components = livingComponents.map((component) => {
    const isProtected =
      component.length / largestComponentSize >=
      parameters.protectedComponentRatio
    const componentRatio = component.length / totalLivingCellCount
    const multiplier = isProtected
      ? 1
      : Math.min(
          parameters.maximumDamageMultiplier,
          1 + parameters.isolationBonusScale * (1 - componentRatio),
        )
    const centroidTopologyX =
      component.reduce((total, cell) => total + cell.topologyX, 0) /
      component.length
    const centroidTopologyY =
      component.reduce((total, cell) => total + cell.topologyY, 0) /
      component.length
    const snapshot = Object.freeze({
      id: Math.min(...component.map(({ id }) => id)),
      glyphIds: Object.freeze(component.map(({ id }) => id)),
      size: component.length,
      centroidTopologyX,
      centroidTopologyY,
      isProtected,
      multiplier,
      severity: calculateDisconnectedSeverity(
        multiplier,
        parameters.maximumDamageMultiplier,
      ),
    })
    if (isProtected) {
      protectedComponentCount += 1
    } else {
      vulnerableComponentCount += 1
    }
    for (const glyphId of snapshot.glyphIds) {
      componentByGlyphId.set(glyphId, snapshot)
    }
    return snapshot
  })
  return Object.freeze({
    ownerId,
    totalLivingCellCount,
    largestComponentSize,
    components: Object.freeze(components),
    componentByGlyphId,
    protectedComponentCount,
    vulnerableComponentCount,
  })
}
