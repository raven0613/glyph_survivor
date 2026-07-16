import type { CrackedSurfacePoolDiagnostics } from './crackedSurfacePool.ts'
import type { OverloadDeformationPoolDiagnostics } from './overloadDeformationPool.ts'
import type { ParticleLayerPoolDiagnostics } from './particleLayerPool.ts'

export interface ModifierRenderDiagnostics {
  readonly activeCrackedFragmentParticleCount: number
  readonly peakCrackedFragmentParticleCount: number
  readonly fragmentAtlasSourceCount: number
  readonly statusOverlayPoolMissCount: number
  readonly activeModifierCoreOverlayCount: number
  readonly peakModifierCoreOverlayCount: number
  readonly activeOptionalParticleCount: number
  readonly optionalVisualBudgetSuppressionCount: number
  readonly effectPoolMissCount: number
}

export interface ResolveModifierRenderDiagnosticsInput {
  readonly crackedSurface: Readonly<CrackedSurfacePoolDiagnostics>
  readonly overloadDeformation: Readonly<OverloadDeformationPoolDiagnostics>
  readonly overloadCoreOverlay: Readonly<ParticleLayerPoolDiagnostics>
  readonly volatileCoreOverlay: Readonly<ParticleLayerPoolDiagnostics>
  readonly fragmentAtlasSourceCount: number
  readonly previousPeakCoreOverlayCount: number
}

export function resolveModifierRenderDiagnostics(
  input: Readonly<ResolveModifierRenderDiagnosticsInput>,
): Readonly<ModifierRenderDiagnostics> {
  const activeCoreOverlayCount =
    input.overloadCoreOverlay.activeParticleCount +
    input.volatileCoreOverlay.activeParticleCount
  return Object.freeze({
    activeCrackedFragmentParticleCount:
      input.crackedSurface.activeFragmentParticleCount,
    peakCrackedFragmentParticleCount:
      input.crackedSurface.peakFragmentParticleCount,
    fragmentAtlasSourceCount: input.fragmentAtlasSourceCount,
    statusOverlayPoolMissCount: input.crackedSurface.poolMissCount,
    activeModifierCoreOverlayCount: activeCoreOverlayCount,
    peakModifierCoreOverlayCount: Math.max(
      input.previousPeakCoreOverlayCount,
      activeCoreOverlayCount,
    ),
    activeOptionalParticleCount: 0,
    optionalVisualBudgetSuppressionCount: 0,
    effectPoolMissCount:
      input.overloadDeformation.poolMissCount +
      input.overloadCoreOverlay.poolMissCount +
      input.volatileCoreOverlay.poolMissCount,
  })
}
