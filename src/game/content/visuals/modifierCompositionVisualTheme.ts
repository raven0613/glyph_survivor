import type { RunModifierCompositionAppearance } from './combatVisualThemeTypes.ts'

interface CompositionAppearanceValidators {
  readonly positive: (value: number, name: string) => void
}

export function validateAndFreezeRunModifierCompositionAppearance(
  appearance: Readonly<RunModifierCompositionAppearance>,
  validators: Readonly<CompositionAppearanceValidators>,
): Readonly<RunModifierCompositionAppearance> {
  validators.positive(
    appearance.maximumOffset,
    'Modifier composition maximumOffset',
  )
  validators.positive(
    appearance.maximumRotation,
    'Modifier composition maximumRotation',
  )
  return Object.freeze({ ...appearance })
}
