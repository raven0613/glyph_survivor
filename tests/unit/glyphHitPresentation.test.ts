import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateGlyphHitPresentation } from '../../src/game/bridge/glyphHitPresentation.ts'

test('keeps the base presentation when no hit flash is active', () => {
  const presentation = calculateGlyphHitPresentation({
    baseAlpha: 0.12,
    baseScale: 0.6,
    baseTint: 0x4c956c,
    hitTint: 0xb7e4c7,
    hitFlashRemainingMs: 0,
    hitFlashDurationMs: 140,
    hitPulseScale: 1.16,
    hitAlphaFloor: 0.5,
  })

  assert.deepEqual(presentation, {
    alpha: 0.12,
    scale: 0.6,
    tint: 0x4c956c,
    intensity: 0,
  })
})

test('temporarily brightens and enlarges a dim husk at impact', () => {
  const presentation = calculateGlyphHitPresentation({
    baseAlpha: 0.12,
    baseScale: 0.6,
    baseTint: 0x4c956c,
    hitTint: 0xb7e4c7,
    hitFlashRemainingMs: 140,
    hitFlashDurationMs: 140,
    hitPulseScale: 1.16,
    hitAlphaFloor: 0.5,
  })

  assert.equal(presentation.alpha, 0.5)
  assert.equal(presentation.scale, 0.696)
  assert.equal(presentation.tint, 0xb7e4c7)
  assert.equal(presentation.intensity, 1)
})

test('eases the hit presentation back toward the base values', () => {
  const presentation = calculateGlyphHitPresentation({
    baseAlpha: 0.12,
    baseScale: 0.6,
    baseTint: 0x000000,
    hitTint: 0xffffff,
    hitFlashRemainingMs: 35,
    hitFlashDurationMs: 140,
    hitPulseScale: 1.16,
    hitAlphaFloor: 0.5,
  })

  assert.ok(presentation.intensity > 0 && presentation.intensity < 1)
  assert.ok(presentation.alpha > 0.12 && presentation.alpha < 0.5)
  assert.ok(presentation.scale > 0.6 && presentation.scale < 0.696)
  assert.ok(presentation.tint > 0x000000 && presentation.tint < 0xffffff)
})
