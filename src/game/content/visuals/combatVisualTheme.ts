import type { GlyphBodySlotRole } from '../../glyph/glyphLayout.ts'

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

const ORDINARY_PROFILE_IDS = Object.freeze([
  GLYPH_APPEARANCE_PROFILE.ZOMBIE,
  GLYPH_APPEARANCE_PROFILE.BONE,
  GLYPH_APPEARANCE_PROFILE.BAT,
] as const)
const MAXIMUM_XP_FLASH_DUTY_CYCLE = 0.2
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

function parseHexColor(value: HexColor, name: string): number {
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
    throw new TypeError(`${name} must use #RRGGBB format.`)
  }
  return Number.parseInt(value.slice(1), 16)
}

function prepareVisualColor(
  color: VisualColor<HexColor>,
  name: string,
): VisualColor {
  return {
    tint: parseHexColor(color.tint, `${name} tint`),
    alpha: color.alpha,
  }
}

function prepareCombatVisualTheme(
  input: CombatVisualThemeAuthoring,
): CombatVisualTheme {
  const playerAttacks = {} as Record<
    PlayerAttackVisualRoleId,
    PlayerAttackAppearance
  >
  for (const roleId of Object.values(PLAYER_ATTACK_VISUAL_ROLE)) {
    const appearance = input.playerAttacks[roleId]
    playerAttacks[roleId] = {
      core: prepareVisualColor(appearance.core, `${roleId} core`),
      accent: prepareVisualColor(appearance.accent, `${roleId} accent`),
    }
  }

  const glyphAppearances = {} as Record<
    GlyphAppearanceProfileId,
    GlyphAppearanceProfile
  >
  for (const profileId of Object.values(GLYPH_APPEARANCE_PROFILE)) {
    const appearance = input.glyphAppearances[profileId]
    glyphAppearances[profileId] = {
      ...appearance,
      durabilityBaseTints: appearance.durabilityBaseTints.map((tint, index) =>
        parseHexColor(tint, `${profileId} durabilityBaseTints[${index}]`),
      ),
      eyeDurabilityBaseTints: appearance.eyeDurabilityBaseTints?.map(
        (tint, index) =>
          parseHexColor(tint, `${profileId} eyeDurabilityBaseTints[${index}]`),
      ) ?? null,
      impactBaseTint: parseHexColor(
        appearance.impactBaseTint,
        `${profileId} impactBaseTint`,
      ),
      huskBaseTint: parseHexColor(
        appearance.huskBaseTint,
        `${profileId} huskBaseTint`,
      ),
    }
  }

  const experience = input.drops.experience
  return {
    map: {
      canvasBackground: prepareVisualColor(
        input.map.canvasBackground,
        'map canvas background',
      ),
      backgroundGlyph: prepareVisualColor(
        input.map.backgroundGlyph,
        'map background glyph',
      ),
      obstacle: prepareVisualColor(input.map.obstacle, 'map obstacle'),
    },
    glyphAtlas: {
      sourceFillTint: parseHexColor(
        input.glyphAtlas.sourceFillTint,
        'glyph atlas source fill',
      ),
      outlineTint: parseHexColor(
        input.glyphAtlas.outlineTint,
        'glyph atlas outline',
      ),
      outlineWidth: input.glyphAtlas.outlineWidth,
    },
    player: prepareVisualColor(input.player, 'player'),
    playerAttacks,
    glyphAppearances,
    glyphBrightnessTiers: input.glyphBrightnessTiers,
    drops: {
      experience: {
        ...experience,
        fresh: prepareVisualColor(experience.fresh, 'experience fresh'),
        settled: prepareVisualColor(experience.settled, 'experience settled'),
        flash: prepareVisualColor(experience.flash, 'experience flash'),
      },
      other: prepareVisualColor(input.drops.other, 'other drop'),
    },
    effects: {
      spreadFeedbackAlpha: input.effects.spreadFeedbackAlpha,
      spreadFeedbackScaleBonus: input.effects.spreadFeedbackScaleBonus,
      spreadFeedbackDurationMs: input.effects.spreadFeedbackDurationMs,
      transferLink: prepareVisualColor(
        input.effects.transferLink,
        'transfer link',
      ),
    },
  }
}

function requireFiniteRange(
  value: number,
  minimum: number,
  maximum: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${name} must be finite and between ${minimum} and ${maximum}.`,
    )
  }
}

function requirePositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and greater than zero.`)
  }
}

function requireTint(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffff) {
    throw new RangeError(`${name} must be a 24-bit color.`)
  }
}

function validateVisualColor(color: VisualColor, name: string): void {
  requireTint(color.tint, `${name} tint`)
  requireFiniteRange(color.alpha, 0, 1, `${name} alpha`)
}

function freezeVisualColor(color: VisualColor): VisualColor {
  return Object.freeze({ ...color })
}

function applyGainToChannel(channel: number, gain: number): number {
  return Math.min(255, Math.round(channel * gain))
}

/** Applies render brightness without changing the configured base-palette role. */
export function applyGlyphBrightnessGain(tint: number, gain: number): number {
  requireTint(tint, 'brightness source tint')
  requirePositiveFinite(gain, 'brightness gain')
  const red = applyGainToChannel((tint >> 16) & 0xff, gain)
  const green = applyGainToChannel((tint >> 8) & 0xff, gain)
  const blue = applyGainToChannel(tint & 0xff, gain)
  return (red << 16) | (green << 8) | blue
}

function validateGlyphBrightnessTier(
  tier: GlyphBrightnessTier,
  expectedId: GlyphBrightnessTierId,
): void {
  if (tier.id !== expectedId) {
    throw new Error(`Glyph brightness tier ${expectedId} must preserve its id.`)
  }
  requirePositiveFinite(tier.activeGain, `${expectedId} activeGain`)
  requirePositiveFinite(
    tier.damagedGainFloor,
    `${expectedId} damagedGainFloor`,
  )
  requirePositiveFinite(tier.impactGain, `${expectedId} impactGain`)
  requirePositiveFinite(tier.huskGain, `${expectedId} huskGain`)
  if (
    !(
      tier.impactGain > tier.activeGain &&
      tier.activeGain > tier.damagedGainFloor &&
      tier.damagedGainFloor > tier.huskGain
    )
  ) {
    throw new RangeError(
      `${expectedId} gains must preserve impact > active > damaged > HUSK.`,
    )
  }
  requireFiniteRange(tier.healthyAlpha, 0, 1, `${expectedId} healthyAlpha`)
  requireFiniteRange(
    tier.damagedAlphaFloor,
    0,
    tier.healthyAlpha,
    `${expectedId} damagedAlphaFloor`,
  )
  requireFiniteRange(
    tier.impactAlphaFloor,
    0,
    1,
    `${expectedId} impactAlphaFloor`,
  )
  requireFiniteRange(tier.huskAlpha, 0, 1, `${expectedId} huskAlpha`)
}

function validateGlyphAppearance(
  appearance: GlyphAppearanceProfile,
  expectedId: GlyphAppearanceProfileId,
): void {
  if (appearance.id !== expectedId) {
    throw new Error(`Glyph appearance ${expectedId} must preserve its id.`)
  }
  if (
    !Object.values(GLYPH_BRIGHTNESS_TIER).some(
      (tierId) => tierId === appearance.brightnessTierId,
    )
  ) {
    throw new RangeError(`${expectedId} has an unknown brightness tier.`)
  }
  if (appearance.durabilityBaseTints.length === 0) {
    throw new RangeError(
      `${expectedId} durabilityBaseTints must not be empty.`,
    )
  }
  const paletteTints = [
    ...appearance.durabilityBaseTints,
    ...(appearance.eyeDurabilityBaseTints ?? []),
    appearance.impactBaseTint,
    appearance.huskBaseTint,
  ]
  paletteTints.forEach((tint, index) => {
    requireTint(tint, `${expectedId} base palette[${index}]`)
  })
}

function freezeGlyphAppearance(
  appearance: GlyphAppearanceProfile,
): GlyphAppearanceProfile {
  return Object.freeze({
    ...appearance,
    durabilityBaseTints: Object.freeze([...appearance.durabilityBaseTints]),
    eyeDurabilityBaseTints: appearance.eyeDurabilityBaseTints
      ? Object.freeze([...appearance.eyeDurabilityBaseTints])
      : null,
  })
}

function validateTierAssignments(theme: CombatVisualTheme): void {
  if (
    ORDINARY_PROFILE_IDS.some(
      (profileId) =>
        theme.glyphAppearances[profileId].brightnessTierId !==
        GLYPH_BRIGHTNESS_TIER.ORDINARY,
    )
  ) {
    throw new RangeError('Z, BO, and BAT must share the ORDINARY emphasis tier.')
  }
  const slimeAppearance =
    theme.glyphAppearances[GLYPH_APPEARANCE_PROFILE.SLIME_BOSS]
  if (slimeAppearance.brightnessTierId !== GLYPH_BRIGHTNESS_TIER.BOSS) {
    throw new RangeError('SLIME must use the BOSS emphasis tier.')
  }
  const ordinaryTier =
    theme.glyphBrightnessTiers[GLYPH_BRIGHTNESS_TIER.ORDINARY]
  const bossTier = theme.glyphBrightnessTiers[GLYPH_BRIGHTNESS_TIER.BOSS]
  for (const property of [
    'activeGain',
    'damagedGainFloor',
    'impactGain',
    'huskGain',
  ] as const) {
    if (bossTier[property] <= ordinaryTier[property]) {
      throw new RangeError(
        `BOSS ${property} must emphasize more strongly than ORDINARY.`,
      )
    }
  }
}

function validateAndFreezeCombatVisualTheme(
  input: CombatVisualTheme,
): CombatVisualTheme {
  validateVisualColor(input.map.canvasBackground, 'map canvas background')
  validateVisualColor(input.map.backgroundGlyph, 'map background glyph')
  validateVisualColor(input.map.obstacle, 'map obstacle')
  requireTint(input.glyphAtlas.sourceFillTint, 'glyph atlas source fill')
  requireTint(input.glyphAtlas.outlineTint, 'glyph atlas outline')
  requirePositiveFinite(input.glyphAtlas.outlineWidth, 'glyph atlas outlineWidth')
  validateVisualColor(input.player, 'player')
  validateVisualColor(input.drops.other, 'other drop')
  validateVisualColor(input.effects.transferLink, 'transfer link')
  requireFiniteRange(
    input.effects.spreadFeedbackAlpha,
    0,
    1,
    'spread feedback alpha',
  )
  requireFiniteRange(
    input.effects.spreadFeedbackScaleBonus,
    0,
    1,
    'spread feedback scale bonus',
  )
  requirePositiveFinite(
    input.effects.spreadFeedbackDurationMs,
    'spread feedback durationMs',
  )

  const playerAttacks = {} as Record<
    PlayerAttackVisualRoleId,
    PlayerAttackAppearance
  >
  for (const roleId of Object.values(PLAYER_ATTACK_VISUAL_ROLE)) {
    const appearance = input.playerAttacks[roleId]
    validateVisualColor(appearance.core, `${roleId} core`)
    validateVisualColor(appearance.accent, `${roleId} accent`)
    playerAttacks[roleId] = Object.freeze({
      core: freezeVisualColor(appearance.core),
      accent: freezeVisualColor(appearance.accent),
    })
  }

  const glyphBrightnessTiers = {} as Record<
    GlyphBrightnessTierId,
    GlyphBrightnessTier
  >
  for (const tierId of Object.values(GLYPH_BRIGHTNESS_TIER)) {
    const tier = input.glyphBrightnessTiers[tierId]
    validateGlyphBrightnessTier(tier, tierId)
    glyphBrightnessTiers[tierId] = Object.freeze({ ...tier })
  }

  const glyphAppearances = {} as Record<
    GlyphAppearanceProfileId,
    GlyphAppearanceProfile
  >
  for (const profileId of Object.values(GLYPH_APPEARANCE_PROFILE)) {
    const appearance = input.glyphAppearances[profileId]
    validateGlyphAppearance(appearance, profileId)
    glyphAppearances[profileId] = freezeGlyphAppearance(appearance)
  }

  const experience = input.drops.experience
  validateVisualColor(experience.fresh, 'experience fresh')
  validateVisualColor(experience.settled, 'experience settled')
  validateVisualColor(experience.flash, 'experience flash')
  requirePositiveFinite(experience.scale, 'experience scale')
  requirePositiveFinite(experience.freshDurationMs, 'experience freshDurationMs')
  requirePositiveFinite(
    experience.settleTransitionMs,
    'experience settleTransitionMs',
  )
  requirePositiveFinite(experience.flashIntervalMs, 'experience flashIntervalMs')
  requirePositiveFinite(experience.flashDurationMs, 'experience flashDurationMs')
  if (experience.flashDurationMs >= experience.flashIntervalMs) {
    throw new RangeError('XP flash duration must be shorter than its interval.')
  }
  if (
    experience.flashDurationMs / experience.flashIntervalMs >
    MAXIMUM_XP_FLASH_DUTY_CYCLE
  ) {
    throw new RangeError('XP flash duty cycle must remain occasional and brief.')
  }

  const theme: CombatVisualTheme = Object.freeze({
    map: Object.freeze({
      canvasBackground: freezeVisualColor(input.map.canvasBackground),
      backgroundGlyph: freezeVisualColor(input.map.backgroundGlyph),
      obstacle: freezeVisualColor(input.map.obstacle),
    }),
    glyphAtlas: Object.freeze({ ...input.glyphAtlas }),
    player: freezeVisualColor(input.player),
    playerAttacks: Object.freeze(playerAttacks),
    glyphBrightnessTiers: Object.freeze(glyphBrightnessTiers),
    glyphAppearances: Object.freeze(glyphAppearances),
    drops: Object.freeze({
      experience: Object.freeze({
        ...experience,
        fresh: freezeVisualColor(experience.fresh),
        settled: freezeVisualColor(experience.settled),
        flash: freezeVisualColor(experience.flash),
      }),
      other: freezeVisualColor(input.drops.other),
    }),
    effects: Object.freeze({
      spreadFeedbackAlpha: input.effects.spreadFeedbackAlpha,
      spreadFeedbackScaleBonus: input.effects.spreadFeedbackScaleBonus,
      spreadFeedbackDurationMs: input.effects.spreadFeedbackDurationMs,
      transferLink: freezeVisualColor(input.effects.transferLink),
    }),
  })
  validateTierAssignments(theme)
  return theme
}

/** Converts authoring colors once, validates them, and freezes the runtime theme. */
export function defineCombatVisualTheme(
  input: CombatVisualThemeAuthoring,
): CombatVisualTheme {
  return validateAndFreezeCombatVisualTheme(prepareCombatVisualTheme(input))
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
      tint: applyGlyphBrightnessGain(
        appearance.huskBaseTint,
        tier.huskGain,
      ),
    }
  }
  const durabilityRatio = Math.min(1, currentDurability / maxDurability)
  const gain =
    tier.damagedGainFloor +
    (tier.activeGain - tier.damagedGainFloor) * durabilityRatio
  const alpha =
    tier.damagedAlphaFloor +
    (tier.healthyAlpha - tier.damagedAlphaFloor) *
      durabilityRatio
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
    tint: applyGlyphBrightnessGain(
      appearance.impactBaseTint,
      tier.impactGain,
    ),
  }
}
