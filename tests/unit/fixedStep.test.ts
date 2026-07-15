import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateFixedStepFrame,
  runFixedStepsWhileActive,
  runFixedStepsWhileModeStable,
} from '../../src/game/runtime/fixedStep.ts'

test('caps catch-up steps and reports dropped simulation time', () => {
  const result = calculateFixedStepFrame({
    accumulatorMs: 0,
    frameDeltaMs: 200,
    fixedStepMs: 10,
    maxStepsPerFrame: 5,
    maxFrameDeltaMs: 100,
  })

  assert.equal(result.stepCount, 5)
  assert.equal(result.accumulatorMs, 0)
  assert.equal(result.droppedTimeMs, 50)
})

test('stops catch-up immediately when an upgrade pauses simulation', () => {
  let isRunning = true
  let steps = 0

  const completed = runFixedStepsWhileActive(4, () => isRunning, () => {
    steps += 1
    isRunning = false
  })

  assert.equal(completed, 1)
  assert.equal(steps, 1)
})

test('preserves fractional accumulated time for the next frame', () => {
  const result = calculateFixedStepFrame({
    accumulatorMs: 4,
    frameDeltaMs: 11,
    fixedStepMs: 10,
    maxStepsPerFrame: 5,
    maxFrameDeltaMs: 100,
  })

  assert.equal(result.stepCount, 1)
  assert.equal(result.accumulatorMs, 5)
  assert.equal(result.droppedTimeMs, 0)
})

test('stops the current catch-up batch when running changes to death review', () => {
  let mode: 'RUNNING' | 'DEATH_REVIEW' = 'RUNNING'
  let runningSteps = 0
  let reviewSteps = 0

  const completed = runFixedStepsWhileModeStable(
    4,
    mode,
    () => mode,
    (stepMode) => {
      if (stepMode === 'RUNNING') {
        runningSteps += 1
        mode = 'DEATH_REVIEW'
      } else {
        reviewSteps += 1
      }
    },
  )

  assert.equal(completed, 1)
  assert.equal(runningSteps, 1)
  assert.equal(reviewSteps, 0)
})
