import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canMaintainTargetLock,
  getStateAfterTargetLoss,
} from '../../src/game/systems/projectileTrackingRules.ts'
import { selectBestProjectileTarget } from '../../src/game/systems/targetSelection.ts'

const ACTIVE = 'ACTIVE' as const

test('assisted targeting selects an active enemy inside the launch cone', () => {
  const target = selectBestProjectileTarget(
    [
      { id: 1, x: 100, y: 0, phase: 'MATERIALIZING', trackingLoad: 0 },
      { id: 2, x: -80, y: 0, phase: ACTIVE, trackingLoad: 0 },
      { id: 3, x: 120, y: 20, phase: ACTIVE, trackingLoad: 0 },
    ],
    0,
    0,
    1,
    0,
    700,
    Math.cos((35 * Math.PI) / 180),
  )

  assert.equal(target?.id, 3)
})

test('target selection favors a less crowded enemy at a similar distance', () => {
  const target = selectBestProjectileTarget(
    [
      { id: 1, x: 100, y: 0, phase: ACTIVE, trackingLoad: 5 },
      { id: 2, x: 110, y: 0, phase: ACTIVE, trackingLoad: 0 },
    ],
    0,
    0,
    1,
    0,
    700,
    -1,
  )

  assert.equal(target?.id, 2)
})

test('assisted projectiles permanently lose lock after passing the target', () => {
  const canMaintain = canMaintainTargetLock(
    {
      trackingMode: 'ASSISTED',
      x: 100,
      y: 0,
      velocityX: 600,
      velocityY: 0,
      launchDirectionX: 1,
      launchDirectionY: 0,
      trackingRange: 700,
      maximumCorrectionCos: Math.cos((35 * Math.PI) / 180),
    },
    { x: 70, y: 0, radius: 18, phase: ACTIVE },
  )

  assert.equal(canMaintain, false)
  assert.equal(getStateAfterTargetLoss('ASSISTED'), 'BALLISTIC')
})

test('homing projectiles may keep a target behind them and seek after loss', () => {
  const canMaintain = canMaintainTargetLock(
    {
      trackingMode: 'HOMING',
      x: 100,
      y: 0,
      velocityX: 600,
      velocityY: 0,
      launchDirectionX: 1,
      launchDirectionY: 0,
      trackingRange: 900,
      maximumCorrectionCos: -1,
    },
    { x: 90, y: 0, radius: 18, phase: ACTIVE },
  )

  assert.equal(canMaintain, true)
  assert.equal(getStateAfterTargetLoss('HOMING'), 'SEEKING')
})
