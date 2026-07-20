interface ModifierChoiceIdentity {
  readonly id: string
}

export function getInitialModifierChoiceId(
  choices: readonly Readonly<ModifierChoiceIdentity>[],
): string | null {
  return choices.length === 1 ? choices[0].id : null
}
