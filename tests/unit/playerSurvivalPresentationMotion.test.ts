import assert from 'node:assert/strict'
import test from 'node:test'
import { PROTOTYPE_COMBAT_VISUAL_THEME } from '../../src/game/content/visuals/prototypeCombatVisualTheme.ts'
import {
  createPlayerSurvivalPresentationFrame,
  writePlayerSurvivalPresentationFrame,
} from '../../src/game/rendering/playerSurvivalPresentationMotion.ts'
import { PLAYER_SURVIVAL_PRESENTATION_EVENT } from '../../src/game/runtime/playerSurvivalPresentation.ts'

const theme = PROTOTYPE_COMBAT_VISUAL_THEME

function presentation(
  eventKind: keyof typeof PLAYER_SURVIVAL_PRESENTATION_EVENT | null,
  eventElapsedMs: number,
  currentShieldLayers: number,
) {
  return {
    currentShieldLayers,
    eventRevision: 1,
    eventKind: eventKind
      ? PLAYER_SURVIVAL_PRESENTATION_EVENT[eventKind]
      : null,
    eventElapsedMs,
    eventSeed: 17,
  }
}

test('renders one steady shield pair regardless of layer count', () => {
  const frame = createPlayerSurvivalPresentationFrame(6)
  writePlayerSurvivalPresentationFrame(
    presentation(null, 0, 4),
    theme,
    frame,
  )

  assert.equal(frame.shieldVisible, true)
  assert.equal(frame.shieldLeftX, -theme.playerSurvival.shield.glyphOffsetX)
  assert.equal(frame.shieldRightX, theme.playerSurvival.shield.glyphOffsetX)
  assert.equal(frame.shieldAlpha, theme.playerSurvival.shield.base.alpha)
})

test('shield hit settles without fading while depletion exits outward', () => {
  const frame = createPlayerSurvivalPresentationFrame(6)
  const shield = theme.playerSurvival.shield
  writePlayerSurvivalPresentationFrame(
    presentation('SHIELD_HIT', shield.hitShakeDurationMs / 4, 2),
    theme,
    frame,
  )
  assert.notEqual(frame.shieldLeftX, -shield.glyphOffsetX)
  assert.equal(frame.shieldAlpha, shield.base.alpha)

  writePlayerSurvivalPresentationFrame(
    presentation(
      'SHIELD_DEPLETED',
      shield.hitShakeDurationMs + shield.depletionFadeDurationMs / 2,
      0,
    ),
    theme,
    frame,
  )
  assert.ok(frame.shieldLeftX < -shield.glyphOffsetX)
  assert.ok(frame.shieldRightX > shield.glyphOffsetX)
  assert.ok(frame.shieldAlpha > 0 && frame.shieldAlpha < shield.base.alpha)

  writePlayerSurvivalPresentationFrame(
    presentation(
      'SHIELD_DEPLETED',
      shield.hitShakeDurationMs + shield.depletionFadeDurationMs,
      0,
    ),
    theme,
    frame,
  )
  assert.equal(frame.shieldVisible, false)
})

test('shield restoration grows from the player center to its steady position', () => {
  const frame = createPlayerSurvivalPresentationFrame(6)
  const shield = theme.playerSurvival.shield
  writePlayerSurvivalPresentationFrame(
    presentation('SHIELD_RESTORED', 0, 1),
    theme,
    frame,
  )
  assert.equal(frame.shieldLeftX, 0)
  assert.equal(frame.shieldRightX, 0)
  assert.equal(frame.shieldAlpha, 0)

  writePlayerSurvivalPresentationFrame(
    presentation('SHIELD_RESTORED', shield.restoreDurationMs, 1),
    theme,
    frame,
  )
  assert.equal(frame.shieldLeftX, -shield.glyphOffsetX)
  assert.equal(frame.shieldRightX, shield.glyphOffsetX)
  assert.equal(frame.shieldAlpha, shield.base.alpha)
})

test('health damage produces deterministic local shake, flash, and dot fragments', () => {
  const first = createPlayerSurvivalPresentationFrame(6)
  const second = createPlayerSurvivalPresentationFrame(6)
  const snapshot = presentation('HEALTH_DAMAGED', 30, 2)
  writePlayerSurvivalPresentationFrame(snapshot, theme, first)
  writePlayerSurvivalPresentationFrame(snapshot, theme, second)

  assert.notEqual(first.playerTint, theme.player.tint)
  assert.notEqual(first.playerOffsetX, 0)
  assert.ok(first.fragmentCount > 0)
  assert.deepEqual(first, second)

  writePlayerSurvivalPresentationFrame(
    presentation('HEALTH_DAMAGED', 400, 2),
    theme,
    first,
  )
  assert.equal(first.playerTint, theme.player.tint)
  assert.equal(first.playerOffsetX, 0)
  assert.equal(first.fragmentCount, 0)
})
