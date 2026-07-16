import {
  GLYPH_CELL_STATE,
  isGlyphLivingState,
  type GlyphCellState,
} from '../glyph/glyphStore.ts'
import { GLYPH_STATUS_FLAG, hasGlyphStatus } from '../glyph/glyphStatus.ts'
import { createGlyphTopologyIndex } from './glyphTopologyPath.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { startOverloadPresentation } from '../runtime/overloadPresentationState.ts'
import {
  calculateDisconnectedSeverity,
  type DisconnectedComponentSnapshot,
} from '../glyph/disconnectedTopology.ts'
import { startDisconnectedHitPresentation } from '../runtime/disconnectedState.ts'
import {
  getDisconnectedTopologySnapshot,
  invalidateDisconnectedTopologyOwner,
} from './disconnectedTopologySystem.ts'
import { enqueueVolatileSource } from '../runtime/volatileState.ts'

export const DAMAGE_APPLICATION_ROUTE = Object.freeze({
  DIRECT_LOCAL: 'DIRECT_LOCAL',
  DIRECT_TRANSFER_ARRIVAL: 'DIRECT_TRANSFER_ARRIVAL',
  DAMAGE_SPREAD: 'DAMAGE_SPREAD',
  VOLATILE_SECONDARY: 'VOLATILE_SECONDARY',
} as const)

export type DamageApplicationRoute =
  (typeof DAMAGE_APPLICATION_ROUTE)[keyof typeof DAMAGE_APPLICATION_ROUTE]

export interface DamageApplicationRequest {
  readonly rootAttackEventId: number
  readonly reactionChainId: number | null
  readonly route: DamageApplicationRoute
  readonly sourceWeaponInstanceId: number
  readonly targetGlyphId: number
  readonly baseDamage: number
  readonly impactDirectionX: number
  readonly impactDirectionY: number
}

export interface DamageApplicationOutcome {
  readonly id: number
  readonly rootAttackEventId: number
  readonly reactionChainId: number | null
  readonly route: DamageApplicationRoute
  readonly sourceWeaponInstanceId: number
  readonly targetGlyphId: number
  readonly baseDirectDamage: number
  readonly crackBonusDamage: number
  readonly disconnectedBonusDamage: number
  readonly resolvedEffectiveDamage: number
  readonly actualAppliedDurabilityDelta: number
  readonly enteredHusk: boolean
  readonly previousGlyphState: GlyphCellState | null
  readonly nextGlyphState: GlyphCellState | null
}

export interface DirectDamageBatch {
  readonly rootAttackEventId: number
  readonly crackedAtStart: ReadonlySet<number>
  readonly neighborIdsBySourceId: ReadonlyMap<number, readonly number[]>
  readonly disconnectedComponentByTargetId: ReadonlyMap<
    number,
    Readonly<DisconnectedComponentSnapshot>
  >
  readonly pendingDisconnectedHitByComponentId: Map<
    number,
    PendingDisconnectedHit
  >
  readonly pendingCrackTargetIds: Set<number>
  readonly volatileChainIdByOwnerId: Map<number, number>
  completed: boolean
}

interface PendingDisconnectedHit {
  readonly component: Readonly<DisconnectedComponentSnapshot>
  readonly directionX: number
  readonly directionY: number
}

function resolveLatchedDisconnectedComponent(
  world: WorldState,
  glyphId: number,
  component: Readonly<DisconnectedComponentSnapshot>,
): Readonly<DisconnectedComponentSnapshot> {
  const glyph = world.glyphStore.getById(glyphId)
  const parameters = world.runModifierState.resolvedProfile.disconnected
  if (
    !glyph ||
    !parameters ||
    !hasGlyphStatus(glyph, GLYPH_STATUS_FLAG.DISCONNECTED_LATCHED) ||
    glyph.disconnectedLatchedMultiplier <= component.multiplier
  ) {
    return component
  }
  return Object.freeze({
    id: -glyph.id,
    glyphIds: Object.freeze([glyph.id]),
    size: 1,
    centroidTopologyX: glyph.topologyX,
    centroidTopologyY: glyph.topologyY,
    isProtected: false,
    multiplier: glyph.disconnectedLatchedMultiplier,
    severity: calculateDisconnectedSeverity(
      glyph.disconnectedLatchedMultiplier,
      parameters.maximumDamageMultiplier,
    ),
  })
}

function isDirectRoute(route: DamageApplicationRoute): boolean {
  return (
    route === DAMAGE_APPLICATION_ROUTE.DIRECT_LOCAL ||
    route === DAMAGE_APPLICATION_ROUTE.DIRECT_TRANSFER_ARRIVAL
  )
}

export function prepareDirectDamageBatch(
  world: WorldState,
  rootAttackEventId: number,
  targetGlyphIds: readonly number[],
): DirectDamageBatch {
  const crackedAtStart = new Set<number>()
  const neighborIdsBySourceId = new Map<number, readonly number[]>()
  const disconnectedComponentByTargetId = new Map<
    number,
    Readonly<DisconnectedComponentSnapshot>
  >()
  const ownerIds = new Set<number>()
  for (const glyphId of new Set(targetGlyphIds)) {
    const glyph = world.glyphStore.getById(glyphId)
    if (!glyph) {
      continue
    }
    ownerIds.add(glyph.ownerId)
    if (
      hasGlyphStatus(glyph, GLYPH_STATUS_FLAG.CRACKED) &&
      glyph.crackedCreatedByRootAttackEventId !== rootAttackEventId
    ) {
      crackedAtStart.add(glyph.id)
    }
  }

  if (world.runModifierState.resolvedProfile.overload) {
    for (const ownerId of ownerIds) {
      const topology = createGlyphTopologyIndex(
        world.glyphStore.getOwnerGlyphs(ownerId).map((glyph) => ({
          id: glyph.id,
          topologyX: glyph.topologyX,
          topologyY: glyph.topologyY,
          worldX: 0,
          worldY: 0,
        })),
      )
      for (const glyphId of targetGlyphIds) {
        const glyph = world.glyphStore.getById(glyphId)
        if (glyph?.ownerId !== ownerId) {
          continue
        }
        neighborIdsBySourceId.set(
          glyphId,
          Object.freeze(
            (topology.neighborsById.get(glyphId) ?? []).map(({ id }) => id),
          ),
        )
      }
    }
  }
  if (world.runModifierState.resolvedProfile.disconnected) {
    for (const ownerId of ownerIds) {
      const snapshot = getDisconnectedTopologySnapshot(world, ownerId)
      if (!snapshot) {
        continue
      }
      for (const glyphId of targetGlyphIds) {
        const component = snapshot.componentByGlyphId.get(glyphId)
        if (component) {
          disconnectedComponentByTargetId.set(
            glyphId,
            resolveLatchedDisconnectedComponent(world, glyphId, component),
          )
        }
      }
    }
  }

  return {
    rootAttackEventId,
    crackedAtStart,
    neighborIdsBySourceId,
    disconnectedComponentByTargetId,
    pendingDisconnectedHitByComponentId: new Map(),
    pendingCrackTargetIds: new Set(),
    volatileChainIdByOwnerId: new Map(),
    completed: false,
  }
}

function startOverloadEffect(
  world: WorldState,
  targetGlyphId: number,
  directionX: number,
  directionY: number,
): void {
  const overloadTheme =
    world.content.combatVisualTheme.effects.runModifiers.overload
  const compressionDurationMs =
    overloadTheme.compression.attackDurationMs +
    overloadTheme.compression.holdDurationMs +
    overloadTheme.compression.settleDurationMs
  const shockwaveDurationMs =
    overloadTheme.shockwave.attackDurationMs +
    overloadTheme.shockwave.holdDurationMs +
    overloadTheme.shockwave.settleDurationMs
  const result = startOverloadPresentation(
    world.overloadPresentation,
    targetGlyphId,
    directionX,
    directionY,
    Math.max(compressionDurationMs, shockwaveDurationMs),
  )
  if (result.poolMiss) {
    world.diagnostics.overloadPresentationPoolMisses += 1
  }
  world.diagnostics.activeOverloadPresentationEventCount =
    world.overloadPresentation.activeEvents.length
  world.diagnostics.peakOverloadPresentationEventCount = Math.max(
    world.diagnostics.peakOverloadPresentationEventCount,
    world.overloadPresentation.activeEvents.length,
  )
}

function collectOverloadOutcome(
  world: WorldState,
  batch: DirectDamageBatch,
  request: Readonly<DamageApplicationRequest>,
  resolvedDamage: number,
  actualDamage: number,
  maxDurability: number,
): void {
  const overload = world.runModifierState.resolvedProfile.overload
  if (!overload || actualDamage <= 0) {
    return
  }
  world.diagnostics.overloadThresholdEvaluationCount += 1
  if (resolvedDamage / maxDurability < overload.overloadThresholdRatio) {
    return
  }

  world.diagnostics.overloadTriggerCount += 1
  startOverloadEffect(
    world,
    request.targetGlyphId,
    request.impactDirectionX,
    request.impactDirectionY,
  )
  for (const neighborId of
    batch.neighborIdsBySourceId.get(request.targetGlyphId) ?? []) {
    if (batch.pendingCrackTargetIds.has(neighborId)) {
      world.diagnostics.crackApplicationDedupCount += 1
    } else {
      batch.pendingCrackTargetIds.add(neighborId)
    }
  }
}

export function applyDamageApplication(
  world: WorldState,
  request: Readonly<DamageApplicationRequest>,
  directBatch?: DirectDamageBatch,
): Readonly<DamageApplicationOutcome> {
  if (!Number.isFinite(request.baseDamage) || request.baseDamage <= 0) {
    throw new RangeError('Damage Application baseDamage must be positive.')
  }
  if (isDirectRoute(request.route) && !directBatch) {
    throw new Error('Direct Damage Applications require a prepared batch.')
  }
  if (directBatch?.completed) {
    throw new Error('Cannot apply damage through a completed direct batch.')
  }

  const glyph = world.glyphStore.getById(request.targetGlyphId)
  const previousGlyphState = glyph?.state ?? null
  const isDirect = isDirectRoute(request.route)
  const overload = world.runModifierState.resolvedProfile.overload
  const disconnectedComponent = isDirect
    ? directBatch?.disconnectedComponentByTargetId.get(request.targetGlyphId)
    : undefined
  const disconnectedMultiplier = disconnectedComponent?.multiplier ?? 1
  const disconnectedBonusDamage =
    request.baseDamage * (disconnectedMultiplier - 1)
  const usesCrack = Boolean(
    isDirect &&
      overload &&
      directBatch?.crackedAtStart.has(request.targetGlyphId) &&
      glyph &&
      isGlyphLivingState(glyph.state),
  )
  const crackDamageMultiplier = overload?.crackDamageMultiplier ?? 1
  const crackBonusDamage = usesCrack
    ? request.baseDamage * (crackDamageMultiplier - 1)
    : 0
  const resolvedEffectiveDamage =
    request.baseDamage + disconnectedBonusDamage + crackBonusDamage

  if (usesCrack) {
    const consumed = world.glyphStore.consumeCracked(
      request.targetGlyphId,
      request.rootAttackEventId,
    )
    if (!consumed) {
      throw new Error('A snapshotted Crack could not be consumed.')
    }
    world.diagnostics.crackConsumptionCount += 1
  }

  const actualAppliedDurabilityDelta = glyph
    ? world.glyphStore.applyDamage(glyph.id, resolvedEffectiveDamage)
    : 0
  if (request.route === DAMAGE_APPLICATION_ROUTE.VOLATILE_SECONDARY) {
    world.diagnostics.runModifierDamageActualDelta +=
      actualAppliedDurabilityDelta
  } else if (isDirect) {
    world.diagnostics.runModifierDamageActualDelta += Math.max(
      0,
      actualAppliedDurabilityDelta - request.baseDamage,
    )
  }
  if (
    directBatch &&
    disconnectedComponent &&
    disconnectedMultiplier > 1 &&
    actualAppliedDurabilityDelta > 0 &&
    !directBatch.pendingDisconnectedHitByComponentId.has(
      disconnectedComponent.id,
    )
  ) {
    directBatch.pendingDisconnectedHitByComponentId.set(
      disconnectedComponent.id,
      {
        component: disconnectedComponent,
        directionX: request.impactDirectionX,
        directionY: request.impactDirectionY,
      },
    )
  }
  const nextGlyphState = glyph?.state ?? null
  const enteredHusk = Boolean(
    glyph &&
      previousGlyphState !== null &&
    isGlyphLivingState(previousGlyphState) &&
      nextGlyphState === GLYPH_CELL_STATE.HUSK,
  )
  if (enteredHusk && glyph) {
    world.topologyDirtyOwnerIds.add(glyph.ownerId)
    invalidateDisconnectedTopologyOwner(world, glyph.ownerId)
    if (world.runModifierState.resolvedProfile.volatile) {
      const isReaction =
        request.route === DAMAGE_APPLICATION_ROUTE.VOLATILE_SECONDARY
      const existingChainId = isReaction
        ? request.reactionChainId
        : directBatch?.volatileChainIdByOwnerId.get(glyph.ownerId) ?? null
      const chainId = enqueueVolatileSource(world.volatileState, {
        sourceGlyphId: glyph.id,
        ownerId: glyph.ownerId,
        sourceMaxDurability: glyph.maxDurability,
        rootAttackEventId: request.rootAttackEventId,
        sourceWeaponInstanceId: request.sourceWeaponInstanceId,
        causingApplicationId: world.nextDamageApplicationId,
        reactionChainId: existingChainId,
        appendToNextWave: isReaction && existingChainId !== null,
      })
      if (!isReaction && directBatch && chainId !== null) {
        directBatch.volatileChainIdByOwnerId.set(glyph.ownerId, chainId)
      }
    }
  }

  if (isDirect && directBatch && glyph) {
    collectOverloadOutcome(
      world,
      directBatch,
      request,
      resolvedEffectiveDamage,
      actualAppliedDurabilityDelta,
      glyph.maxDurability,
    )
  }

  const outcome: Readonly<DamageApplicationOutcome> = Object.freeze({
    id: world.nextDamageApplicationId,
    rootAttackEventId: request.rootAttackEventId,
    reactionChainId: request.reactionChainId,
    route: request.route,
    sourceWeaponInstanceId: request.sourceWeaponInstanceId,
    targetGlyphId: request.targetGlyphId,
    baseDirectDamage: isDirect ? request.baseDamage : 0,
    crackBonusDamage,
    disconnectedBonusDamage,
    resolvedEffectiveDamage,
    actualAppliedDurabilityDelta,
    enteredHusk,
    previousGlyphState,
    nextGlyphState,
  })
  world.nextDamageApplicationId += 1
  return outcome
}

export function completeDirectDamageBatch(
  world: WorldState,
  batch: DirectDamageBatch,
): void {
  if (batch.completed) {
    throw new Error('Direct damage batch has already completed.')
  }
  batch.completed = true
  const hitAppearance =
    world.content.combatVisualTheme.effects.runModifiers.disconnected.hitShake
  const hitDurationMs =
    hitAppearance.attackDurationMs +
    hitAppearance.holdDurationMs +
    hitAppearance.settleDurationMs
  for (const pending of batch.pendingDisconnectedHitByComponentId.values()) {
    const result = startDisconnectedHitPresentation(
      world.disconnectedState,
      pending.component.id,
      pending.component.glyphIds,
      pending.component.severity,
      pending.directionX,
      pending.directionY,
      hitDurationMs,
    )
    if (result.poolMiss) {
      world.diagnostics.disconnectedHitPresentationPoolMisses += 1
    }
  }
  const activeHitCount = world.disconnectedState.activeHitEvents.length
  world.diagnostics.activeDisconnectedHitPresentationCount = activeHitCount
  world.diagnostics.peakDisconnectedHitPresentationCount = Math.max(
    world.diagnostics.peakDisconnectedHitPresentationCount,
    activeHitCount,
  )
  const targetIds = [...batch.pendingCrackTargetIds].sort(
    (first, second) => first - second,
  )
  for (const targetId of targetIds) {
    const target = world.glyphStore.getById(targetId)
    if (!target || !isGlyphLivingState(target.state)) {
      continue
    }
    if (world.glyphStore.applyCracked(targetId, batch.rootAttackEventId)) {
      world.diagnostics.crackApplicationCount += 1
    } else {
      world.diagnostics.crackApplicationDedupCount += 1
    }
  }
}
