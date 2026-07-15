import type { GlyphBodySlotRole } from '../../glyph/glyphLayout.ts'
import type { PlayerSurvivalVisualTheme } from './playerSurvivalVisualTheme.ts'

export const GLYPH_APPEARANCE_PROFILE = Object.freeze({
  ZOMBIE: 'ZOMBIE',
  BONE: 'BONE',
  BAT: 'BAT',
  SLIME_BOSS: 'SLIME_BOSS',
} as const)

export type GlyphAppearanceProfileId =
  (typeof GLYPH_APPEARANCE_PROFILE)[keyof typeof GLYPH_APPEARANCE_PROFILE]

export function isGlyphAppearanceProfileId(
  value: unknown,
): value is GlyphAppearanceProfileId {
  return Object.values(GLYPH_APPEARANCE_PROFILE).some(
    (profileId) => profileId === value,
  )
}

export const GLYPH_BRIGHTNESS_TIER = Object.freeze({
  ORDINARY: 'ORDINARY',
  BOSS: 'BOSS',
} as const)

export type GlyphBrightnessTierId =
  (typeof GLYPH_BRIGHTNESS_TIER)[keyof typeof GLYPH_BRIGHTNESS_TIER]

export const PLAYER_ATTACK_VISUAL_ROLE = Object.freeze({
  ASSISTED_PROJECTILE: 'ASSISTED_PROJECTILE',
  FLAMETHROWER: 'FLAMETHROWER',
  ORBIT_ENERGY: 'ORBIT_ENERGY',
} as const)

export type PlayerAttackVisualRoleId =
  (typeof PLAYER_ATTACK_VISUAL_ROLE)[keyof typeof PLAYER_ATTACK_VISUAL_ROLE]

export function isPlayerAttackVisualRoleId(
  value: unknown,
): value is PlayerAttackVisualRoleId {
  return Object.values(PLAYER_ATTACK_VISUAL_ROLE).some(
    (roleId) => roleId === value,
  )
}

export type HexColor = `#${string}`

export interface VisualColor<ColorValue = number> {
  readonly tint: ColorValue
  readonly alpha: number
}

export interface GlyphAppearanceProfile<ColorValue = number> {
  readonly id: GlyphAppearanceProfileId
  readonly brightnessTierId: GlyphBrightnessTierId
  readonly durabilityBaseTints: readonly ColorValue[]
  readonly eyeDurabilityBaseTints: readonly ColorValue[] | null
  readonly impactBaseTint: ColorValue
  readonly huskBaseTint: ColorValue
}

export interface GlyphBrightnessTier {
  readonly id: GlyphBrightnessTierId
  readonly activeGain: number
  readonly damagedGainFloor: number
  readonly impactGain: number
  readonly huskGain: number
  readonly healthyAlpha: number
  readonly damagedAlphaFloor: number
  readonly impactAlphaFloor: number
  readonly huskAlpha: number
}

export interface PlayerAttackAppearance<ColorValue = number> {
  readonly core: VisualColor<ColorValue>
  readonly accent: VisualColor<ColorValue>
}

export interface ExperienceDropAppearance<ColorValue = number> {
  readonly scale: number
  readonly fresh: VisualColor<ColorValue>
  readonly settled: VisualColor<ColorValue>
  readonly flash: VisualColor<ColorValue>
  readonly freshDurationMs: number
  readonly settleTransitionMs: number
  readonly flashIntervalMs: number
  readonly flashDurationMs: number
}

export interface CombatVisualTheme<ColorValue = number> {
  readonly map: {
    readonly canvasBackground: VisualColor<ColorValue>
    readonly backgroundGlyph: VisualColor<ColorValue>
    readonly obstacle: VisualColor<ColorValue>
  }
  readonly glyphAtlas: {
    readonly sourceFillTint: ColorValue
    readonly outlineTint: ColorValue
    readonly outlineWidth: number
  }
  readonly player: VisualColor<ColorValue>
  readonly playerSurvival: PlayerSurvivalVisualTheme<ColorValue>
  readonly playerAttacks: Readonly<
    Record<PlayerAttackVisualRoleId, PlayerAttackAppearance<ColorValue>>
  >
  readonly glyphAppearances: Readonly<
    Record<GlyphAppearanceProfileId, GlyphAppearanceProfile<ColorValue>>
  >
  readonly glyphBrightnessTiers: Readonly<
    Record<GlyphBrightnessTierId, GlyphBrightnessTier>
  >
  readonly drops: {
    readonly experience: ExperienceDropAppearance<ColorValue>
    readonly other: VisualColor<ColorValue>
  }
  readonly effects: {
    readonly spreadFeedbackAlpha: number
    readonly spreadFeedbackScaleBonus: number
    readonly spreadFeedbackDurationMs: number
    readonly transferLink: VisualColor<ColorValue>
  }
}

export type CombatVisualThemeAuthoring = CombatVisualTheme<HexColor>

export interface GlyphPresentation {
  readonly alpha: number
  readonly tint: number
}

export type { GlyphBodySlotRole }
