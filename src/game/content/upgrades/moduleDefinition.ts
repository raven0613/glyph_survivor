export const MODULE_EFFECT_KIND = Object.freeze({
  ATTACK_SPEED: 'ATTACK_SPEED',
  ATTACK_AREA: 'ATTACK_AREA',
  KNOCKBACK: 'KNOCKBACK',
} as const)

export type ModuleEffectKind =
  (typeof MODULE_EFFECT_KIND)[keyof typeof MODULE_EFFECT_KIND]

export interface ModuleRankDefinition {
  readonly rank: number
  readonly totalMultiplier: number
}

export interface WeaponModuleDefinitionInput {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly effectKind: ModuleEffectKind
  readonly ranks: readonly ModuleRankDefinition[]
}

export type WeaponModuleDefinition = Readonly<WeaponModuleDefinitionInput>

export function defineWeaponModule(
  input: WeaponModuleDefinitionInput,
): WeaponModuleDefinition {
  if (!input.id.trim() || !input.title.trim() || !input.description.trim()) {
    throw new TypeError('Module id, title, and description must not be empty.')
  }
  if (input.ranks.length === 0) {
    throw new RangeError('A module must define at least one rank.')
  }
  if (!Object.values(MODULE_EFFECT_KIND).includes(input.effectKind)) {
    throw new TypeError('Unknown module effectKind.')
  }
  const ranks = input.ranks.map((rank, index) => {
    if (rank.rank !== index + 1) {
      throw new RangeError('Module ranks must be contiguous and one-based.')
    }
    if (!Number.isFinite(rank.totalMultiplier) || rank.totalMultiplier <= 0) {
      throw new RangeError('Module multiplier must be finite and positive.')
    }
    return Object.freeze({ ...rank })
  })
  return Object.freeze({ ...input, ranks: Object.freeze(ranks) })
}
