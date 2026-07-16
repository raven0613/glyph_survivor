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

export interface TopologyTransferAppearance<ColorValue = number>
  extends VisualColor<ColorValue> {
  readonly stepIntervalMs: number
  readonly pulseDurationMs: number
}

export interface EffectBeatTiming {
  readonly attackDurationMs: number
  readonly holdDurationMs: number
  readonly settleDurationMs: number
}

export interface VolatileSourceClampAppearance extends EffectBeatTiming {
  readonly minimumScale: number
}

export interface VolatileReleaseAppearance<ColorValue = number>
  extends VisualColor<ColorValue>, EffectBeatTiming {
  readonly delayMs: number
  readonly startDistance: number
  readonly endDistance: number
  readonly glyphScale: number
  readonly characters: readonly string[]
}

export interface VolatileNeighborJoltAppearance extends EffectBeatTiming {
  readonly delayMs: number
  readonly maximumOffset: number
  readonly maximumRotation: number
}

export interface VolatileEffectAppearance<ColorValue = number> {
  readonly sourceClamp: VolatileSourceClampAppearance
  readonly release: VolatileReleaseAppearance<ColorValue>
  readonly neighborJolt: VolatileNeighborJoltAppearance
}

export interface OverloadCompressionAppearance extends EffectBeatTiming {
  readonly parallelScale: number
  readonly perpendicularScale: number
}

export interface OverloadShockwaveAppearance<ColorValue = number>
  extends VisualColor<ColorValue>, EffectBeatTiming {
  readonly startRadius: number
  readonly endRadius: number
  readonly particleCount: number
  readonly glyphScale: number
  readonly characters: readonly string[]
}

export interface CrackedSurfaceAppearance {
  readonly alphaMultiplier: number
  readonly maximumFragmentOffset: number
  readonly maximumFragmentRotation: number
  readonly fragmentBrightnessGains: readonly number[]
}

export interface OverloadEffectAppearance<ColorValue = number> {
  readonly compression: OverloadCompressionAppearance
  readonly shockwave: OverloadShockwaveAppearance<ColorValue>
  readonly crackedSurface: CrackedSurfaceAppearance
}

export interface DisconnectedAmbientAppearance extends EffectBeatTiming {
  readonly intervalMs: number
  readonly maximumSpacingOffset: number
  readonly maximumJitterOffset: number
  readonly maximumRotation: number
}

export interface DisconnectedHitShakeAppearance extends EffectBeatTiming {
  readonly maximumOffset: number
  readonly residualOffsetRatio: number
  readonly maximumRotation: number
}

export interface DisconnectedEffectAppearance {
  readonly ambient: DisconnectedAmbientAppearance
  readonly hitShake: DisconnectedHitShakeAppearance
}

export interface RunModifierCompositionAppearance {
  readonly maximumOffset: number
  readonly maximumRotation: number
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
    readonly topologyTransfer: TopologyTransferAppearance<ColorValue>
    readonly runModifiers: {
      readonly composition: RunModifierCompositionAppearance
      readonly volatile: VolatileEffectAppearance<ColorValue>
      readonly disconnected: DisconnectedEffectAppearance
      readonly overload: OverloadEffectAppearance<ColorValue>
    }
  }
}

export type CombatVisualThemeAuthoring = CombatVisualTheme<HexColor>

export interface GlyphPresentation {
  readonly alpha: number
  readonly tint: number
}

export type { GlyphBodySlotRole }
