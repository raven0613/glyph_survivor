import type { RenderSnapshot } from '../bridge/renderSnapshot.ts'
import { clearRenderSnapshot } from '../bridge/renderSnapshotLifecycle.ts'

interface RunInputResetPort {
  reset(): void
}

interface RunRenderResetPort {
  clear(): void
}

/** Clears run-owned state while preserving reusable Host and Pixi resources. */
export function clearCompletedRun(
  input: RunInputResetPort,
  renderSnapshot: RenderSnapshot,
  renderer: RunRenderResetPort,
): void {
  input.reset()
  clearRenderSnapshot(renderSnapshot)
  renderer.clear()
}
