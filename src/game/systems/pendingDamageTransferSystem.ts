import { isGlyphLivingState } from '../glyph/glyphStore.ts'
import type { DamageTransferReservation } from '../glyph/localDamage.ts'
import {
  isEnemyCombatPhase,
  type PendingDamageTransferState,
  type TopologyTransferPulseState,
} from '../runtime/worldEntities.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { recordWeaponDamage } from '../runtime/runStatistics.ts'
import {
  DAMAGE_APPLICATION_ROUTE,
  applyDamageApplication,
  completeDirectDamageBatch,
  prepareDirectDamageBatch,
} from './damageApplication.ts'

export function schedulePendingDamageTransfer(
  world: WorldState,
  reservation: Readonly<DamageTransferReservation>,
  reservedDamage: number,
): void {
  const path = world.pendingDamageTransferPathPool.pop()
  if (!path) {
    world.diagnostics.pendingTransferPathPoolMisses += 1
  }
  const pathGlyphIds = path ?? []
  pathGlyphIds.push(...reservation.pathGlyphIds)

  const recycledState = world.pendingDamageTransferPool.pop()
  if (!recycledState) {
    world.diagnostics.pendingTransferStatePoolMisses += 1
  }
  const transfer = recycledState ?? ({} as PendingDamageTransferState)
  Object.assign(transfer, {
    id: world.nextPendingDamageTransferId,
    attackEventId: reservation.attackEventId,
    sourceWeaponInstanceId: reservation.sourceWeaponInstanceId,
    visualRoleId: reservation.visualRoleId,
    ownerId: reservation.ownerId,
    sourceGlyphId: reservation.sourceGlyphId,
    targetGlyphId: reservation.targetGlyphId,
    reservedDamage,
    impactDirectionX: reservation.impactDirectionX,
    impactDirectionY: reservation.impactDirectionY,
    pathGlyphIds,
    nextPathIndex: 1,
    remainingToNextPulseMs: reservation.sourceFlashDurationMs,
  })
  world.nextPendingDamageTransferId += 1
  world.pendingDamageTransfers.push(transfer)
  world.diagnostics.activePendingTransferCount += 1
  world.diagnostics.retainedPendingTransferPathCellCount +=
    pathGlyphIds.length
}

function releasePulse(
  world: WorldState,
  pulse: TopologyTransferPulseState,
): void {
  world.topologyTransferPulsePool.push(pulse)
}

function advancePulses(world: WorldState, deltaMs: number): void {
  let writeIndex = 0
  for (const pulse of world.topologyTransferPulses) {
    pulse.remainingMs = Math.max(0, pulse.remainingMs - deltaMs)
    if (pulse.remainingMs === 0) {
      releasePulse(world, pulse)
      continue
    }
    world.topologyTransferPulses[writeIndex] = pulse
    writeIndex += 1
  }
  world.topologyTransferPulses.length = writeIndex
}

function createPulse(
  world: WorldState,
  transfer: PendingDamageTransferState,
  glyphId: number,
  elapsedSinceArrivalMs: number,
): void {
  const durationMs =
    world.content.combatVisualTheme.effects.topologyTransfer.pulseDurationMs
  const remainingMs = durationMs - elapsedSinceArrivalMs
  if (remainingMs <= 0) {
    return
  }
  const recycledPulse = world.topologyTransferPulsePool.pop()
  if (!recycledPulse) {
    world.diagnostics.topologyTransferPulsePoolMisses += 1
  }
  const pulse = recycledPulse ?? ({} as TopologyTransferPulseState)
  Object.assign(pulse, {
    id: world.nextTopologyTransferPulseId,
    transferId: transfer.id,
    glyphId,
    remainingMs,
    durationMs,
  })
  world.nextTopologyTransferPulseId += 1
  world.topologyTransferPulses.push(pulse)
}

function isValidArrivalTarget(
  world: WorldState,
  transfer: PendingDamageTransferState,
): boolean {
  const owner = world.enemyById.get(transfer.ownerId)
  const target = world.glyphStore.getById(transfer.targetGlyphId)
  return Boolean(
    owner &&
      isEnemyCombatPhase(owner.phase) &&
      target &&
      target.ownerId === transfer.ownerId &&
      isGlyphLivingState(target.state),
  )
}

function commitArrival(
  world: WorldState,
  transfer: PendingDamageTransferState,
  elapsedSinceArrivalMs: number,
): void {
  if (!isValidArrivalTarget(world, transfer)) {
    world.diagnostics.pendingTransferInvalidTargetCancellationCount += 1
    return
  }
  const target = world.glyphStore.getById(transfer.targetGlyphId)
  if (!target) {
    throw new Error('Validated topology-transfer target disappeared.')
  }
  const directBatch = prepareDirectDamageBatch(
    world,
    transfer.attackEventId,
    [target.id],
  )
  const outcome = applyDamageApplication(
    world,
    {
      rootAttackEventId: transfer.attackEventId,
      reactionChainId: null,
      route: DAMAGE_APPLICATION_ROUTE.DIRECT_TRANSFER_ARRIVAL,
      sourceWeaponInstanceId: transfer.sourceWeaponInstanceId,
      targetGlyphId: target.id,
      baseDamage: transfer.reservedDamage,
      impactDirectionX: transfer.impactDirectionX,
      impactDirectionY: transfer.impactDirectionY,
    },
    directBatch,
  )
  completeDirectDamageBatch(world, directBatch)
  const appliedDamage = outcome.actualAppliedDurabilityDelta
  if (appliedDamage <= 0) {
    world.diagnostics.pendingTransferInvalidTargetCancellationCount += 1
    return
  }
  createPulse(world, transfer, target.id, elapsedSinceArrivalMs)
  recordWeaponDamage(
    world.runStatistics,
    transfer.sourceWeaponInstanceId,
    appliedDamage,
  )
  world.diagnostics.pendingTransferArrivalCommitCount += 1
}

function releaseTransfer(
  world: WorldState,
  transfer: PendingDamageTransferState,
): void {
  world.diagnostics.activePendingTransferCount -= 1
  world.diagnostics.retainedPendingTransferPathCellCount -=
    transfer.pathGlyphIds.length
  transfer.pathGlyphIds.length = 0
  world.pendingDamageTransferPathPool.push(transfer.pathGlyphIds)
  world.pendingDamageTransferPool.push(transfer)
}

function advanceTransfer(
  world: WorldState,
  transfer: PendingDamageTransferState,
  deltaMs: number,
): boolean {
  transfer.remainingToNextPulseMs -= deltaMs
  const stepIntervalMs =
    world.content.combatVisualTheme.effects.topologyTransfer.stepIntervalMs
  while (
    transfer.remainingToNextPulseMs <= 0 &&
    transfer.nextPathIndex < transfer.pathGlyphIds.length
  ) {
    const glyphId = transfer.pathGlyphIds[transfer.nextPathIndex]
    const elapsedSinceArrivalMs = -transfer.remainingToNextPulseMs
    transfer.nextPathIndex += 1
    if (glyphId === transfer.targetGlyphId) {
      commitArrival(world, transfer, elapsedSinceArrivalMs)
      return false
    }
    createPulse(world, transfer, glyphId, elapsedSinceArrivalMs)
    transfer.remainingToNextPulseMs += stepIntervalMs
  }
  return transfer.nextPathIndex < transfer.pathGlyphIds.length
}

/** Advances only during ordinary fixed simulation steps, never paused phases. */
export function runPendingDamageTransferSystem(
  world: WorldState,
  deltaMs: number,
): void {
  advancePulses(world, deltaMs)
  let writeIndex = 0
  for (const transfer of world.pendingDamageTransfers) {
    if (!advanceTransfer(world, transfer, deltaMs)) {
      releaseTransfer(world, transfer)
      continue
    }
    world.pendingDamageTransfers[writeIndex] = transfer
    writeIndex += 1
  }
  world.pendingDamageTransfers.length = writeIndex
}
