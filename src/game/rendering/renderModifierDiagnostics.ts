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
  readonly activeVolatileClusterPointCount: number
  readonly peakVolatileClusterPointCount: number
  readonly minimumReadableVolatileClusterPointCount: number
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
  readonly activeVolatileClusterPointCount: number
  readonly minimumReadableVolatileClusterPointCount: number
  readonly volatileOptionalVisualBudgetSuppressionCount: number
  readonly previousPeakVolatileClusterPointCount: number
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
    activeVolatileClusterPointCount:
      input.activeVolatileClusterPointCount,
    peakVolatileClusterPointCount: Math.max(
      input.previousPeakVolatileClusterPointCount,
      input.activeVolatileClusterPointCount,
    ),
    minimumReadableVolatileClusterPointCount:
      input.minimumReadableVolatileClusterPointCount,
    activeOptionalParticleCount: Math.max(
      0,
      input.activeVolatileClusterPointCount -
        input.minimumReadableVolatileClusterPointCount,
    ),
    optionalVisualBudgetSuppressionCount:
      input.volatileOptionalVisualBudgetSuppressionCount,
    effectPoolMissCount:
      input.overloadDeformation.poolMissCount +
      input.overloadCoreOverlay.poolMissCount +
      input.volatileCoreOverlay.poolMissCount,
  })
}
