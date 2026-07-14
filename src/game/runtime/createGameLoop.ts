import {
  calculateFixedStepFrame,
  runFixedStepsWhileActive,
} from './fixedStep.ts'
import { GAME_CONFIG } from './gameConfig.ts'

export interface GameLoop {
  start(): void
  dispose(): void
}

export interface GameLoopOptions {
  readonly shouldStep: () => boolean
  readonly step: (fixedStepMs: number) => void
  readonly render: (interpolationAlpha: number) => void
  readonly recordDroppedTime: (droppedTimeMs: number) => void
}

export function createGameLoop(options: GameLoopOptions): GameLoop {
  let animationFrameId: number | null = null
  let previousTimestampMs: number | null = null
  let accumulatorMs = 0
  let isDisposed = false

  function frame(timestampMs: number): void {
    if (isDisposed) {
      return
    }

    const frameDeltaMs =
      previousTimestampMs === null ? 0 : timestampMs - previousTimestampMs
    previousTimestampMs = timestampMs

    if (options.shouldStep()) {
      const fixedFrame = calculateFixedStepFrame({
        accumulatorMs,
        frameDeltaMs,
        fixedStepMs: GAME_CONFIG.fixedStepMs,
        maxStepsPerFrame: GAME_CONFIG.maxStepsPerFrame,
        maxFrameDeltaMs: GAME_CONFIG.maxFrameDeltaMs,
      })
      accumulatorMs = fixedFrame.accumulatorMs

      const completedSteps = runFixedStepsWhileActive(
        fixedFrame.stepCount,
        options.shouldStep,
        () => options.step(GAME_CONFIG.fixedStepMs),
      )
      if (completedSteps < fixedFrame.stepCount) {
        accumulatorMs = 0
      }

      if (fixedFrame.droppedTimeMs > 0) {
        options.recordDroppedTime(fixedFrame.droppedTimeMs)
      }
    } else {
      accumulatorMs = 0
    }

    options.render(accumulatorMs / GAME_CONFIG.fixedStepMs)
    animationFrameId = requestAnimationFrame(frame)
  }

  return Object.freeze({
    start() {
      if (isDisposed || animationFrameId !== null) {
        return
      }

      animationFrameId = requestAnimationFrame(frame)
    },

    dispose() {
      if (isDisposed) {
        return
      }

      isDisposed = true
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
    },
  })
}
