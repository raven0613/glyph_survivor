import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateCameraView,
  calculatePlayerMovementBounds,
  screenToWorld,
} from '../../src/game/runtime/cameraTransform.ts'

test('keeps the player at the center of the camera view', () => {
  const camera = calculateCameraView(2_000, 1_600, 1_280, 720)

  assert.deepEqual(camera, {
    centerX: 2_000,
    centerY: 1_600,
    left: 1_360,
    top: 1_240,
    right: 2_640,
    bottom: 1_960,
    width: 1_280,
    height: 720,
  })
})

test('converts screen coordinates through the camera view', () => {
  const camera = calculateCameraView(2_000, 1_600, 1_280, 720)

  assert.deepEqual(screenToWorld(800, 260, camera), {
    x: 2_160,
    y: 1_500,
  })
})

test('keeps the viewport inside the fixed world', () => {
  assert.deepEqual(calculatePlayerMovementBounds(1_280, 720, 4_000, 4_000), {
    minX: 640,
    minY: 360,
    maxX: 3_360,
    maxY: 3_640,
  })
})
