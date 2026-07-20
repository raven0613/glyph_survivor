import type { RenderSnapshot } from './renderSnapshot.ts'
import { clearRenderPlayerState } from './playerRenderSnapshot.ts'

/** Releases references to every view owned by the completed run. */
export function clearRenderSnapshot(snapshot: RenderSnapshot): void {
  clearRenderPlayerState(snapshot)
  snapshot.enemies.length = 0
  snapshot.enemiesBehind.length = 0
  snapshot.enemiesFront.length = 0
  snapshot.effects.length = 0
  snapshot.topologyTransferPulses.length = 0
  snapshot.projectiles.length = 0
  snapshot.orbits.length = 0
  snapshot.drops.length = 0
  snapshot.flameEmitters.length = 0
  snapshot.crackedSurfaces.length = 0
  snapshot.overloadDeformations.length = 0
  snapshot.overloadShockwaves.length = 0
  snapshot.volatileCoreOverlays.length = 0
  snapshot.volatileOverlayDiagnostics.activeClusterPointCount = 0
  snapshot.volatileOverlayDiagnostics.minimumReadableClusterPointCount = 0
  snapshot.volatileOverlayDiagnostics.optionalVisualBudgetSuppressionCount = 0
}
