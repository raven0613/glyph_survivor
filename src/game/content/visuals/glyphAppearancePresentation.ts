import type { GlyphBodySlotRole } from '../../glyph/glyphLayout.ts'
import type {
  CombatVisualTheme,
  GlyphAppearanceProfile,
  GlyphAppearanceProfileId,
  GlyphPresentation,
  PlayerAttackAppearance,
  PlayerAttackVisualRoleId,
} from './combatVisualThemeTypes.ts'

function requireTint(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffff) {
    throw new RangeError(`${name} must be a 24-bit color.`)
  }
}

function applyGainToChannel(channel: number, gain: number): number {
  return Math.min(255, Math.round(channel * gain))
}

/** Applies render brightness without changing the configured base-palette role. */
export function applyGlyphBrightnessGain(tint: number, gain: number): number {
  requireTint(tint, 'brightness source tint')
  if (!Number.isFinite(gain) || gain <= 0) {
    throw new RangeError('brightness gain must be finite and greater than zero.')
  }
  const red = applyGainToChannel((tint >> 16) & 0xff, gain)
  const green = applyGainToChannel((tint >> 8) & 0xff, gain)
  const blue = applyGainToChannel(tint & 0xff, gain)
  return (red << 16) | (green << 8) | blue
}

export function getGlyphAppearance(
  theme: CombatVisualTheme,
  profileId: GlyphAppearanceProfileId,
): GlyphAppearanceProfile {
  return theme.glyphAppearances[profileId]
}

export function getPlayerAttackAppearance(
  theme: CombatVisualTheme,
  roleId: PlayerAttackVisualRoleId,
): PlayerAttackAppearance {
  return theme.playerAttacks[roleId]
}

function resolveGlyphPaletteTint(
  appearance: GlyphAppearanceProfile,
  currentDurability: number,
  role: GlyphBodySlotRole,
): number {
  const durabilityBaseTints =
    role === 'EYE' && appearance.eyeDurabilityBaseTints
      ? appearance.eyeDurabilityBaseTints
      : appearance.durabilityBaseTints
  const durabilityTier = Math.max(1, Math.ceil(currentDurability))
  return durabilityBaseTints[
    Math.min(durabilityTier - 1, durabilityBaseTints.length - 1)
  ]
}

export function resolveGlyphBasePresentation(
  theme: CombatVisualTheme,
  profileId: GlyphAppearanceProfileId,
  currentDurability: number,
  maxDurability: number,
  role: GlyphBodySlotRole = 'BODY',
): GlyphPresentation {
  const appearance = getGlyphAppearance(theme, profileId)
  const tier = theme.glyphBrightnessTiers[appearance.brightnessTierId]
  const paletteTint = resolveGlyphPaletteTint(
    appearance,
    currentDurability,
    role,
  )
  if (currentDurability <= 0) {
    return {
      alpha: tier.huskAlpha,
      tint: applyGlyphBrightnessGain(appearance.huskBaseTint, tier.huskGain),
    }
  }
  const durabilityRatio = Math.min(1, currentDurability / maxDurability)
  const gain =
    tier.damagedGainFloor +
    (tier.activeGain - tier.damagedGainFloor) * durabilityRatio
  const alpha =
    tier.damagedAlphaFloor +
    (tier.healthyAlpha - tier.damagedAlphaFloor) * durabilityRatio
  return {
    alpha,
    tint: applyGlyphBrightnessGain(paletteTint, gain),
  }
}

export function resolveGlyphImpactPresentation(
  theme: CombatVisualTheme,
  profileId: GlyphAppearanceProfileId,
): GlyphPresentation {
  const appearance = getGlyphAppearance(theme, profileId)
  const tier = theme.glyphBrightnessTiers[appearance.brightnessTierId]
  return {
    alpha: tier.impactAlphaFloor,
    tint: applyGlyphBrightnessGain(appearance.impactBaseTint, tier.impactGain),
  }
}
