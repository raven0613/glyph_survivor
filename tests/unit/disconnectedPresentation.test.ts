import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateDisconnectedAmbientMotion,
  calculateDisconnectedHitMotion,
} from '../../src/game/bridge/disconnectedPresentation.ts'
import { PROTOTYPE_COMBAT_VISUAL_THEME } from '../../src/game/content/visuals/prototypeCombatVisualTheme.ts'

const appearance =
  PROTOTYPE_COMBAT_VISUAL_THEME.effects.runModifiers.disconnected

test('keeps protected components visually stable', () => {
  const motion = calculateDisconnectedAmbientMotion(
    {
      presentationTimeMs: 500,
      seedHash: 1,
      componentId: 10,
      glyphId: 11,
      severity: 0,
      topologyX: 2,
      topologyY: 0,
      centroidTopologyX: 0,
      centroidTopologyY: 0,
    },
    appearance.ambient,
  )

  assert.deepEqual(motion, { offsetX: 0, offsetY: 0, rotation: 0 })
})

test('loosens vulnerable Glyph spacing away from the canonical component centroid', () => {
  const motion = calculateDisconnectedAmbientMotion(
    {
      presentationTimeMs: 0,
      seedHash: 1,
      componentId: 10,
      glyphId: 11,
      severity: 1,
      topologyX: 2,
      topologyY: 0,
      centroidTopologyX: 0,
      centroidTopologyY: 0,
    },
    appearance.ambient,
  )

  assert.ok(motion.offsetX > 0)
  assert.ok(Math.abs(motion.offsetY) < 1e-9)
  assert.ok(motion.offsetX <= appearance.ambient.maximumSpacingOffset)
})

test('uses a deterministic low-duty-cycle ambient micro-burst', () => {
  let movingSamples = 0
  const sampleCount = 200
  for (let index = 0; index < sampleCount; index += 1) {
    const time = (appearance.ambient.intervalMs * index) / sampleCount
    const motion = calculateDisconnectedAmbientMotion(
      {
        presentationTimeMs: time,
        seedHash: 5,
        componentId: 10,
        glyphId: 11,
        severity: 1,
        topologyX: 0,
        topologyY: 0,
        centroidTopologyX: 0,
        centroidTopologyY: 0,
      },
      appearance.ambient,
    )
    if (Math.hypot(motion.offsetX, motion.offsetY) > 0.001) {
      movingSamples += 1
    }
  }

  assert.ok(movingSamples / sampleCount < 0.12)
  assert.deepEqual(
    calculateDisconnectedAmbientMotion(
      {
        presentationTimeMs: 725,
        seedHash: 5,
        componentId: 10,
        glyphId: 11,
        severity: 1,
        topologyX: 0,
        topologyY: 0,
        centroidTopologyX: 0,
        centroidTopologyY: 0,
      },
      appearance.ambient,
    ),
    calculateDisconnectedAmbientMotion(
      {
        presentationTimeMs: 725,
        seedHash: 5,
        componentId: 10,
        glyphId: 11,
        severity: 1,
        topologyX: 0,
        topologyY: 0,
        centroidTopologyX: 0,
        centroidTopologyY: 0,
      },
      appearance.ambient,
    ),
  )
})

test('starts with one component-wide hit direction and settles through dephased residuals', () => {
  const attackEnd = appearance.hitShake.attackDurationMs
  const firstAttack = calculateDisconnectedHitMotion(
    attackEnd,
    1,
    1,
    0,
    1,
    appearance.hitShake,
  )
  const secondAttack = calculateDisconnectedHitMotion(
    attackEnd,
    2,
    1,
    0,
    1,
    appearance.hitShake,
  )
  assert.deepEqual(firstAttack, secondAttack)
  assert.ok(firstAttack.offsetX > 0)

  const residualAge =
    appearance.hitShake.attackDurationMs +
    appearance.hitShake.holdDurationMs +
    appearance.hitShake.settleDurationMs * 0.35
  const firstResidual = calculateDisconnectedHitMotion(
    residualAge,
    1,
    1,
    0,
    1,
    appearance.hitShake,
  )
  const secondResidual = calculateDisconnectedHitMotion(
    residualAge,
    2,
    1,
    0,
    1,
    appearance.hitShake,
  )
  assert.notDeepEqual(firstResidual, secondResidual)
})
