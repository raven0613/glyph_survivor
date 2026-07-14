export interface FixedStepFrameInput {
  readonly accumulatorMs: number
  readonly frameDeltaMs: number
  readonly fixedStepMs: number
  readonly maxStepsPerFrame: number
  readonly maxFrameDeltaMs: number
}

export interface FixedStepFrameResult {
  readonly stepCount: number
  readonly accumulatorMs: number
  readonly droppedTimeMs: number
}

export function calculateFixedStepFrame(
  input: FixedStepFrameInput,
): FixedStepFrameResult {
  const clampedDeltaMs = Math.min(
    Math.max(input.frameDeltaMs, 0),
    input.maxFrameDeltaMs,
  )
  const availableTimeMs = Math.max(input.accumulatorMs, 0) + clampedDeltaMs
  const possibleStepCount = Math.floor(availableTimeMs / input.fixedStepMs)
  const stepCount = Math.min(possibleStepCount, input.maxStepsPerFrame)
  const remainingAfterStepsMs =
    availableTimeMs - stepCount * input.fixedStepMs
  const canKeepAccumulator = possibleStepCount <= input.maxStepsPerFrame

  return {
    stepCount,
    accumulatorMs: canKeepAccumulator ? remainingAfterStepsMs : 0,
    droppedTimeMs: canKeepAccumulator ? 0 : remainingAfterStepsMs,
  }
}

/** Runs planned catch-up steps but rechecks the authoritative phase each time. */
export function runFixedStepsWhileActive(
  stepCount: number,
  shouldStep: () => boolean,
  step: () => void,
): number {
  let completed = 0
  while (completed < stepCount && shouldStep()) {
    step()
    completed += 1
  }
  return completed
}
