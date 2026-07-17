export const RUN_MODIFIER_EFFECT_STRATEGY = Object.freeze({
  VOLATILE: 'VOLATILE',
  DISCONNECTED: 'DISCONNECTED',
  OVERLOAD: 'OVERLOAD',
} as const)

export type RunModifierEffectStrategyId =
  (typeof RUN_MODIFIER_EFFECT_STRATEGY)[keyof typeof RUN_MODIFIER_EFFECT_STRATEGY]

interface BaseRunModifierDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly identityGlyph: string
  readonly effectStrategyId: RunModifierEffectStrategyId
}

export interface VolatileModifierParameters {
  readonly sourceMaxDurabilityRatio: number
  readonly maximumExplosionDamage: number
  readonly intraOwnerTopologyDepth: number
  readonly maxExplosionResolutionsPerFixedStep: number
  readonly waveIntervalMs: number
}

export interface DisconnectedModifierParameters {
  readonly protectedComponentRatio: number
  readonly isolationBonusScale: number
  readonly maximumDamageMultiplier: number
}

export interface OverloadModifierParameters {
  readonly overloadThresholdRatio: number
  readonly crackDamageMultiplier: number
}

export type RunModifierDefinition =
  | (BaseRunModifierDefinition & {
      readonly effectStrategyId: typeof RUN_MODIFIER_EFFECT_STRATEGY.VOLATILE
      readonly volatile: Readonly<VolatileModifierParameters>
    })
  | (BaseRunModifierDefinition & {
      readonly effectStrategyId: typeof RUN_MODIFIER_EFFECT_STRATEGY.DISCONNECTED
      readonly disconnected: Readonly<DisconnectedModifierParameters>
    })
  | (BaseRunModifierDefinition & {
      readonly effectStrategyId: typeof RUN_MODIFIER_EFFECT_STRATEGY.OVERLOAD
      readonly overload: Readonly<OverloadModifierParameters>
    })

function requireFiniteRatio(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new RangeError(`${name} must be finite and in (0, 1].`)
  }
}

function validateParameters(definition: RunModifierDefinition): void {
  switch (definition.effectStrategyId) {
    case RUN_MODIFIER_EFFECT_STRATEGY.VOLATILE:
      requireFiniteRatio(
        definition.volatile.sourceMaxDurabilityRatio,
        'Volatile sourceMaxDurabilityRatio',
      )
      if (
        !Number.isFinite(definition.volatile.waveIntervalMs) ||
        definition.volatile.waveIntervalMs < 0
      ) {
        throw new RangeError(
          'Volatile waveIntervalMs must be finite and non-negative.',
        )
      }
      if (
        !Number.isFinite(definition.volatile.maximumExplosionDamage) ||
        definition.volatile.maximumExplosionDamage <= 0 ||
        definition.volatile.intraOwnerTopologyDepth !== 1 ||
        !Number.isSafeInteger(
          definition.volatile.maxExplosionResolutionsPerFixedStep,
        ) ||
        definition.volatile.maxExplosionResolutionsPerFixedStep <= 0
      ) {
        throw new RangeError(
          'Volatile parameters must be positive and use first-pass topology depth one.',
        )
      }
      return
    case RUN_MODIFIER_EFFECT_STRATEGY.DISCONNECTED:
      requireFiniteRatio(
        definition.disconnected.protectedComponentRatio,
        'Disconnected protectedComponentRatio',
      )
      if (
        !Number.isFinite(definition.disconnected.isolationBonusScale) ||
        definition.disconnected.isolationBonusScale <= 0 ||
        !Number.isFinite(definition.disconnected.maximumDamageMultiplier) ||
        definition.disconnected.maximumDamageMultiplier < 1
      ) {
        throw new RangeError(
          'Disconnected damage parameters must be finite and positive.',
        )
      }
      return
    case RUN_MODIFIER_EFFECT_STRATEGY.OVERLOAD:
      requireFiniteRatio(
        definition.overload.overloadThresholdRatio,
        'Overload overloadThresholdRatio',
      )
      if (
        !Number.isFinite(definition.overload.crackDamageMultiplier) ||
        definition.overload.crackDamageMultiplier <= 1
      ) {
        throw new RangeError(
          'Overload crackDamageMultiplier must be finite and greater than one.',
        )
      }
  }
}

export function defineRunModifier(
  definition: RunModifierDefinition,
): Readonly<RunModifierDefinition> {
  if (
    !definition.id.trim() ||
    !definition.title.trim() ||
    !definition.description.trim() ||
    !definition.identityGlyph.trim()
  ) {
    throw new Error('Run Modifier text fields must be non-empty.')
  }
  validateParameters(definition)

  switch (definition.effectStrategyId) {
    case RUN_MODIFIER_EFFECT_STRATEGY.VOLATILE:
      return Object.freeze({
        ...definition,
        volatile: Object.freeze({ ...definition.volatile }),
      })
    case RUN_MODIFIER_EFFECT_STRATEGY.DISCONNECTED:
      return Object.freeze({
        ...definition,
        disconnected: Object.freeze({ ...definition.disconnected }),
      })
    case RUN_MODIFIER_EFFECT_STRATEGY.OVERLOAD:
      return Object.freeze({
        ...definition,
        overload: Object.freeze({ ...definition.overload }),
      })
  }
}
