export interface RunModifierConfig {
  readonly enableRunStartModifierOfferForTesting: boolean
}

export function assertValidRunModifierConfig(
  config: Readonly<Record<string, unknown>>,
): asserts config is Readonly<Record<string, unknown>> & RunModifierConfig {
  if (typeof config.enableRunStartModifierOfferForTesting !== 'boolean') {
    throw new TypeError(
      'enableRunStartModifierOfferForTesting must be an explicit Boolean.',
    )
  }
}
