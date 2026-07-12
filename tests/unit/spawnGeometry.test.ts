import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCameraView } from '../../src/game/runtime/cameraTransform.ts'
import {
  chooseSpawnSide,
  createSpawnCandidate,
  isSpawnCandidateValid,
} from '../../src/game/systems/spawnGeometry.ts'

test('uses the forward side inside the sixty percent movement bias', () => {
  assert.equal(chooseSpawnSide(1, 0, () => 0.59), 'right')
  assert.equal(chooseSpawnSide(0, -1, () => 0.2), 'top')
})

test('creates ordinary enemies 150 to 300 units outside the camera', () => {
  const camera = calculateCameraView(2_000, 2_000, 1_000, 800)
  const candidate = createSpawnCandidate(camera, 'right', () => 0.5)

  assert.equal(candidate.x, camera.right + 225)
  assert.equal(candidate.y, camera.top + camera.height * 0.5)
})

test('rejects candidates inside the viewport, obstacles, or other enemies', () => {
  const camera = calculateCameraView(2_000, 2_000, 1_000, 800)
  const world = { left: 0, top: 0, right: 4_000, bottom: 4_000 }
  const otherEnemy = [{ x: 2_700, y: 2_000, radius: 20 }]
  const obstacle = [{ left: 2_650, top: 1_950, right: 2_750, bottom: 2_050 }]

  assert.equal(
    isSpawnCandidateValid({ x: 2_000, y: 2_000 }, 20, camera, world, [], []),
    false,
  )
  assert.equal(
    isSpawnCandidateValid({ x: 2_700, y: 2_000 }, 20, camera, world, otherEnemy, []),
    false,
  )
  assert.equal(
    isSpawnCandidateValid({ x: 2_700, y: 2_000 }, 20, camera, world, [], obstacle),
    false,
  )
  assert.equal(
    isSpawnCandidateValid({ x: 2_700, y: 2_300 }, 20, camera, world, [], []),
    true,
  )
})
