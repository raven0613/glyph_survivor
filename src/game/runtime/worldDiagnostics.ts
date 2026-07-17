import {
  createRunModifierDiagnostics,
  type RunModifierDiagnostics,
} from './runModifierDiagnostics.ts'

export interface WorldDiagnostics extends RunModifierDiagnostics {
  droppedSimulationTimeMs: number
  simulationStepCount: number
  enemyPoolMisses: number
  projectilePoolMisses: number
  dropPoolMisses: number
  targetSearchCount: number
  targetReacquireCount: number
  glyphPoolMisses: number
  flameEmitterPoolMisses: number
  healthyGlyphCount: number
  damagedGlyphCount: number
  huskGlyphCount: number
  spreadCandidateCount: number
  spreadPreciseTestCount: number
  damageClaimDedupCount: number
  activePendingTransferCount: number
  retainedPendingTransferPathCellCount: number
  pendingTransferArrivalCommitCount: number
  pendingTransferInvalidTargetCancellationCount: number
  pendingTransferStatePoolMisses: number
  pendingTransferPathPoolMisses: number
  topologyTransferPulsePoolMisses: number
  topologyPathSearchTimeMs: number
  attackEmissionCount: number
  rangeExpiredProjectileCount: number
  orbitSweepCandidateCount: number
  orbitSweepPreciseTestCount: number
  bodyMotionSimulationTimeMs: number
  bodyMotionStepTimeMs: number
  bodyMotionEvaluationCount: number
  bodyMotionGlyphUpdateCount: number
  bodyMotionActiveCreatureCount: number
  bodyMotionActiveGlyphCount: number
}

export function createWorldDiagnostics(): WorldDiagnostics {
  return {
    ...createRunModifierDiagnostics(),
    droppedSimulationTimeMs: 0,
    simulationStepCount: 0,
    enemyPoolMisses: 0,
    projectilePoolMisses: 0,
    dropPoolMisses: 0,
    targetSearchCount: 0,
    targetReacquireCount: 0,
    glyphPoolMisses: 0,
    flameEmitterPoolMisses: 0,
    healthyGlyphCount: 0,
    damagedGlyphCount: 0,
    huskGlyphCount: 0,
    spreadCandidateCount: 0,
    spreadPreciseTestCount: 0,
    damageClaimDedupCount: 0,
    activePendingTransferCount: 0,
    retainedPendingTransferPathCellCount: 0,
    pendingTransferArrivalCommitCount: 0,
    pendingTransferInvalidTargetCancellationCount: 0,
    pendingTransferStatePoolMisses: 0,
    pendingTransferPathPoolMisses: 0,
    topologyTransferPulsePoolMisses: 0,
    topologyPathSearchTimeMs: 0,
    attackEmissionCount: 0,
    rangeExpiredProjectileCount: 0,
    orbitSweepCandidateCount: 0,
    orbitSweepPreciseTestCount: 0,
    bodyMotionSimulationTimeMs: 0,
    bodyMotionStepTimeMs: 0,
    bodyMotionEvaluationCount: 0,
    bodyMotionGlyphUpdateCount: 0,
    bodyMotionActiveCreatureCount: 0,
    bodyMotionActiveGlyphCount: 0,
  }
}
