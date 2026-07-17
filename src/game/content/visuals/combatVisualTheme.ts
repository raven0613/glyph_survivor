import {
  GLYPH_APPEARANCE_PROFILE,
  GLYPH_BRIGHTNESS_TIER,
  PLAYER_ATTACK_VISUAL_ROLE,
  type CombatVisualTheme,
  type CombatVisualThemeAuthoring,
  type GlyphAppearanceProfile,
  type GlyphAppearanceProfileId,
  type GlyphBrightnessTier,
  type GlyphBrightnessTierId,
  type HexColor,
  type PlayerAttackAppearance,
  type PlayerAttackVisualRoleId,
  type VisualColor,
} from './combatVisualThemeTypes.ts'
import {
  preparePlayerSurvivalVisualTheme,
  validateAndFreezePlayerSurvivalVisualTheme,
} from './playerSurvivalVisualTheme.ts'
import {
  prepareOverloadEffectAppearance,
  validateAndFreezeOverloadEffectAppearance,
} from './overloadVisualTheme.ts'
import {
  prepareDisconnectedEffectAppearance,
  validateAndFreezeDisconnectedEffectAppearance,
} from './disconnectedVisualTheme.ts'
import {
  prepareVolatileEffectAppearance,
  validateAndFreezeVolatileEffectAppearance,
} from './volatileVisualTheme.ts'
import { validateAndFreezeRunModifierCompositionAppearance } from './modifierCompositionVisualTheme.ts'

export * from './combatVisualThemeTypes.ts'
export * from './glyphAppearancePresentation.ts'

const ORDINARY_PROFILE_IDS = Object.freeze([
  GLYPH_APPEARANCE_PROFILE.ZOMBIE,
  GLYPH_APPEARANCE_PROFILE.BONE,
  GLYPH_APPEARANCE_PROFILE.BAT,
  GLYPH_APPEARANCE_PROFILE.ROCK,
  GLYPH_APPEARANCE_PROFILE.SNAKE,
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
    playerSurvival: preparePlayerSurvivalVisualTheme(
      input.playerSurvival,
      prepareVisualColor,
    ),
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
      topologyTransfer: {
        ...prepareVisualColor(
          input.effects.topologyTransfer,
          'topology transfer',
        ),
        stepIntervalMs: input.effects.topologyTransfer.stepIntervalMs,
        pulseDurationMs: input.effects.topologyTransfer.pulseDurationMs,
      },
      runModifiers: {
        composition: { ...input.effects.runModifiers.composition },
        volatile: prepareVolatileEffectAppearance(
          input.effects.runModifiers.volatile,
          prepareVisualColor,
        ),
        disconnected: prepareDisconnectedEffectAppearance(
          input.effects.runModifiers.disconnected,
        ),
        overload: prepareOverloadEffectAppearance(
          input.effects.runModifiers.overload,
          prepareVisualColor,
        ),
      },
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
    throw new RangeError(
      'Z, BO, BAT, ROCK, and SNAKE must share the ORDINARY emphasis tier.',
    )
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
  const playerSurvival = validateAndFreezePlayerSurvivalVisualTheme(
    input.playerSurvival,
    {
      validateColor: validateVisualColor,
      positive: requirePositiveFinite,
      range: requireFiniteRange,
    },
  )
  validateVisualColor(input.drops.other, 'other drop')
  validateVisualColor(input.effects.topologyTransfer, 'topology transfer')
  requirePositiveFinite(
    input.effects.topologyTransfer.stepIntervalMs,
    'topology transfer stepIntervalMs',
  )
  const overload = validateAndFreezeOverloadEffectAppearance(
    input.effects.runModifiers.overload,
    {
      validateColor: validateVisualColor,
      positive: requirePositiveFinite,
      range: requireFiniteRange,
    },
  )
  const volatile = validateAndFreezeVolatileEffectAppearance(
    input.effects.runModifiers.volatile,
    {
      validateColor: validateVisualColor,
      positive: requirePositiveFinite,
      range: requireFiniteRange,
    },
  )
  const disconnected = validateAndFreezeDisconnectedEffectAppearance(
    input.effects.runModifiers.disconnected,
    {
      positive: requirePositiveFinite,
      range: requireFiniteRange,
    },
  )
  const composition = validateAndFreezeRunModifierCompositionAppearance(
    input.effects.runModifiers.composition,
    { positive: requirePositiveFinite },
  )
  requirePositiveFinite(
    input.effects.topologyTransfer.pulseDurationMs,
    'topology transfer pulseDurationMs',
  )
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
    playerSurvival,
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
      topologyTransfer: Object.freeze({
        ...input.effects.topologyTransfer,
      }),
      runModifiers: Object.freeze({
        composition,
        volatile,
        disconnected,
        overload,
      }),
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
