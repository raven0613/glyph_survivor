import type { RenderPlayerSurvivalPresentation } from '../bridge/playerRenderSnapshot.ts'
import type { CombatVisualTheme } from '../content/visuals/combatVisualTheme.ts'
import { PLAYER_SURVIVAL_PRESENTATION_EVENT } from '../runtime/playerSurvivalPresentation.ts'

export interface PlayerDamageFragmentFrame {
  x: number
  y: number
  scale: number
  alpha: number
}

export interface PlayerSurvivalPresentationFrame {
  playerOffsetX: number
  playerOffsetY: number
  playerTint: number
  playerAlpha: number
  playerRotation: number
  shieldVisible: boolean
  shieldLeftX: number
  shieldRightX: number
  shieldLeftY: number
  shieldRightY: number
  shieldAlpha: number
  shieldGlowAlpha: number
  readonly fragments: PlayerDamageFragmentFrame[]
  fragmentCount: number
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function easeOutCubic(value: number): number {
  const inverse = 1 - value
  return 1 - inverse * inverse * inverse
}

function easeOutBack(value: number, overshoot: number): number {
  if (value === 0 || value === 1) {
    return value
  }
  const shifted = value - 1
  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2
}

function mixTint(from: number, to: number, amount: number): number {
  const fromRed = (from >> 16) & 0xff
  const fromGreen = (from >> 8) & 0xff
  const fromBlue = from & 0xff
  const red = Math.round(fromRed + (((to >> 16) & 0xff) - fromRed) * amount)
  const green = Math.round(
    fromGreen + (((to >> 8) & 0xff) - fromGreen) * amount,
  )
  const blue = Math.round(fromBlue + ((to & 0xff) - fromBlue) * amount)
  return (red << 16) | (green << 8) | blue
}

function seededUnit(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000
}

export function createPlayerSurvivalPresentationFrame(
  fragmentCapacity: number,
): PlayerSurvivalPresentationFrame {
  return {
    playerOffsetX: 0,
    playerOffsetY: 0,
    playerTint: 0,
    playerAlpha: 0,
    playerRotation: 0,
    shieldVisible: false,
    shieldLeftX: 0,
    shieldRightX: 0,
    shieldLeftY: 0,
    shieldRightY: 0,
    shieldAlpha: 0,
    shieldGlowAlpha: 0,
    fragments: Array.from({ length: fragmentCapacity }, () => ({
      x: 0,
      y: 0,
      scale: 0,
      alpha: 0,
    })),
    fragmentCount: 0,
  }
}

function writeSteadyShield(
  frame: PlayerSurvivalPresentationFrame,
  theme: CombatVisualTheme,
): void {
  const shield = theme.playerSurvival.shield
  frame.shieldVisible = true
  frame.shieldLeftX = -shield.glyphOffsetX
  frame.shieldRightX = shield.glyphOffsetX
  frame.shieldLeftY = 0
  frame.shieldRightY = 0
  frame.shieldAlpha = shield.base.alpha
  frame.shieldGlowAlpha = shield.glow.alpha
}

function writeShieldHit(
  frame: PlayerSurvivalPresentationFrame,
  theme: CombatVisualTheme,
  elapsedMs: number,
): void {
  const shield = theme.playerSurvival.shield
  writeSteadyShield(frame, theme)
  const progress = clampUnit(elapsedMs / shield.hitShakeDurationMs)
  const envelope = (1 - progress) ** 2
  const wave =
    Math.sin(progress * shield.hitShakeCycles * Math.PI * 2) * envelope
  const displacement = wave * shield.hitShakeDistance
  const vertical = displacement * shield.hitShakeVerticalRatio
  frame.shieldLeftX += displacement
  frame.shieldRightX -= displacement
  frame.shieldLeftY = vertical
  frame.shieldRightY = -vertical
}

function writeShield(
  frame: PlayerSurvivalPresentationFrame,
  snapshot: Readonly<RenderPlayerSurvivalPresentation>,
  theme: CombatVisualTheme,
): void {
  const shield = theme.playerSurvival.shield
  const kind = snapshot.eventKind
  if (kind === PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_DEPLETED) {
    const shakeDuration = shield.hitShakeDurationMs
    if (snapshot.eventElapsedMs < shakeDuration) {
      writeShieldHit(frame, theme, snapshot.eventElapsedMs)
      return
    }
    const fadeProgress = clampUnit(
      (snapshot.eventElapsedMs - shakeDuration) /
        shield.depletionFadeDurationMs,
    )
    if (fadeProgress >= 1) {
      return
    }
    writeSteadyShield(frame, theme)
    const outward =
      easeOutCubic(fadeProgress) * shield.depletionOffsetDistance
    const fade = (1 - fadeProgress) ** 2
    frame.shieldLeftX -= outward
    frame.shieldRightX += outward
    frame.shieldAlpha *= fade
    frame.shieldGlowAlpha *= fade
    return
  }
  if (snapshot.currentShieldLayers <= 0) {
    return
  }
  if (kind === PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_HIT) {
    writeShieldHit(frame, theme, snapshot.eventElapsedMs)
    return
  }
  writeSteadyShield(frame, theme)
  if (kind === PLAYER_SURVIVAL_PRESENTATION_EVENT.SHIELD_RESTORED) {
    const progress = clampUnit(
      snapshot.eventElapsedMs / shield.restoreDurationMs,
    )
    if (progress === 0) {
      frame.shieldLeftX = 0
      frame.shieldRightX = 0
      frame.shieldAlpha = 0
      frame.shieldGlowAlpha = 0
      return
    }
    const distanceProgress = easeOutBack(progress, shield.restoreOvershoot)
    frame.shieldLeftX *= distanceProgress
    frame.shieldRightX *= distanceProgress
    frame.shieldAlpha *= progress
    frame.shieldGlowAlpha *= progress
  }
}

function writeHealthDamage(
  frame: PlayerSurvivalPresentationFrame,
  snapshot: Readonly<RenderPlayerSurvivalPresentation>,
  theme: CombatVisualTheme,
): void {
  const health = theme.playerSurvival.healthDamage
  const progress = clampUnit(snapshot.eventElapsedMs / health.durationMs)
  if (progress < 1) {
    const envelope = 1 - progress
    const wave = Math.sin(progress * health.shakeCycles * Math.PI * 2)
    const flashWave = Math.sin(progress * health.pulseCount * Math.PI) ** 2
    frame.playerOffsetX = wave * envelope * health.shakeDistance
    frame.playerOffsetY =
      Math.cos(progress * health.shakeCycles * Math.PI * 2) *
      envelope *
      health.shakeDistance *
      health.shakeVerticalRatio
    frame.playerTint = mixTint(
      theme.player.tint,
      health.flash.tint,
      flashWave * envelope,
    )
  }

  const maximumCount = Math.min(health.fragmentCount, frame.fragments.length)
  for (let index = 0; index < maximumCount; index += 1) {
    const localElapsed = snapshot.eventElapsedMs - index * health.fragmentStaggerMs
    if (localElapsed < 0 || localElapsed >= health.fragmentDurationMs) {
      continue
    }
    const localProgress = localElapsed / health.fragmentDurationMs
    const angle = seededUnit(snapshot.eventSeed, index * 2) * Math.PI * 2
    const distanceTarget =
      health.fragmentMinimumDistance +
      seededUnit(snapshot.eventSeed, index * 2 + 1) *
        (health.fragmentMaximumDistance - health.fragmentMinimumDistance)
    const distance = easeOutCubic(localProgress) * distanceTarget
    const fragment = frame.fragments[frame.fragmentCount]
    fragment.x = Math.cos(angle) * distance
    fragment.y = Math.sin(angle) * distance
    fragment.scale = health.fragmentScale
    fragment.alpha = health.fragment.alpha * (1 - localProgress) ** 2
    frame.fragmentCount += 1
  }
}

export function writePlayerSurvivalPresentationFrame(
  snapshot: Readonly<RenderPlayerSurvivalPresentation>,
  theme: CombatVisualTheme,
  frame: PlayerSurvivalPresentationFrame,
): void {
  frame.playerOffsetX = 0
  frame.playerOffsetY = 0
  frame.playerTint = theme.player.tint
  frame.playerAlpha = theme.player.alpha
  frame.playerRotation = snapshot.deathActive
    ? easeOutCubic(clampUnit(snapshot.deathFallProgress)) * (Math.PI / 2)
    : 0
  frame.shieldVisible = false
  frame.shieldAlpha = 0
  frame.shieldGlowAlpha = 0
  frame.fragmentCount = 0
  writeShield(frame, snapshot, theme)
  if (
    snapshot.eventKind ===
    PLAYER_SURVIVAL_PRESENTATION_EVENT.HEALTH_DAMAGED
  ) {
    writeHealthDamage(frame, snapshot, theme)
  }
}
