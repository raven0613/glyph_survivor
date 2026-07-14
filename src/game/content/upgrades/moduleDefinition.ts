export const MODULE_EFFECT_KIND = Object.freeze({
  ATTACK_SPEED: 'ATTACK_SPEED',
  PROJECTILE_COUNT: 'PROJECTILE_COUNT',
  DAMAGE_SPREAD: 'DAMAGE_SPREAD',
  RANGE: 'RANGE',
  KNOCKBACK: 'KNOCKBACK',
} as const)

export type ModuleEffectKind =
  (typeof MODULE_EFFECT_KIND)[keyof typeof MODULE_EFFECT_KIND]

export interface MultiplierModuleRankDefinition {
  readonly rank: number
  readonly totalMultiplier: number
}

export interface DamageSpreadModuleRankDefinition {
  readonly rank: number
  readonly bandDamageRatios: readonly number[]
}

export interface ProjectileCountModuleRankDefinition {
  readonly rank: number
  readonly totalCount: number
}

export type ModuleRankDefinition =
  | MultiplierModuleRankDefinition
  | ProjectileCountModuleRankDefinition
  | DamageSpreadModuleRankDefinition

interface BaseWeaponModuleDefinitionInput {
  readonly id: string
  readonly title: string
  readonly description: string
}

export interface MultiplierWeaponModuleDefinitionInput
  extends BaseWeaponModuleDefinitionInput {
  readonly effectKind:
    | typeof MODULE_EFFECT_KIND.ATTACK_SPEED
    | typeof MODULE_EFFECT_KIND.KNOCKBACK
  readonly ranks: readonly MultiplierModuleRankDefinition[]
}

export interface RangeWeaponModuleDefinitionInput
  extends BaseWeaponModuleDefinitionInput {
  readonly effectKind: typeof MODULE_EFFECT_KIND.RANGE
  readonly ranks: readonly MultiplierModuleRankDefinition[]
}

export interface DamageSpreadWeaponModuleDefinitionInput
  extends BaseWeaponModuleDefinitionInput {
  readonly effectKind: typeof MODULE_EFFECT_KIND.DAMAGE_SPREAD
  readonly bandWidth: number
  readonly ranks: readonly DamageSpreadModuleRankDefinition[]
}

export interface ProjectileCountWeaponModuleDefinitionInput
  extends BaseWeaponModuleDefinitionInput {
  readonly effectKind: typeof MODULE_EFFECT_KIND.PROJECTILE_COUNT
  readonly projectileAngleSpacingRadians: number
  readonly coneAngleSpacingRadians: number
  readonly ranks: readonly ProjectileCountModuleRankDefinition[]
}

export type WeaponModuleDefinitionInput =
  | MultiplierWeaponModuleDefinitionInput
  | RangeWeaponModuleDefinitionInput
  | ProjectileCountWeaponModuleDefinitionInput
  | DamageSpreadWeaponModuleDefinitionInput

export type MultiplierWeaponModuleDefinition = Readonly<
  Omit<MultiplierWeaponModuleDefinitionInput, 'ranks'> & {
    readonly ranks: readonly Readonly<MultiplierModuleRankDefinition>[]
  }
>

export type RangeWeaponModuleDefinition = Readonly<
  Omit<RangeWeaponModuleDefinitionInput, 'ranks'> & {
    readonly ranks: readonly Readonly<MultiplierModuleRankDefinition>[]
  }
>

export type DamageSpreadWeaponModuleDefinition = Readonly<
  Omit<DamageSpreadWeaponModuleDefinitionInput, 'ranks'> & {
    readonly ranks: readonly Readonly<DamageSpreadModuleRankDefinition>[]
  }
>

export type ProjectileCountWeaponModuleDefinition = Readonly<
  Omit<ProjectileCountWeaponModuleDefinitionInput, 'ranks'> & {
    readonly ranks: readonly Readonly<ProjectileCountModuleRankDefinition>[]
  }
>

export type WeaponModuleDefinition =
  | MultiplierWeaponModuleDefinition
  | RangeWeaponModuleDefinition
  | ProjectileCountWeaponModuleDefinition
  | DamageSpreadWeaponModuleDefinition

function validateBaseDefinition(input: BaseWeaponModuleDefinitionInput): void {
  if (!input.id.trim() || !input.title.trim() || !input.description.trim()) {
    throw new TypeError('Module id, title, and description must not be empty.')
  }
}

function validateRankSequence(ranks: readonly ModuleRankDefinition[]): void {
  if (ranks.length === 0) {
    throw new RangeError('A module must define at least one rank.')
  }
  for (let index = 0; index < ranks.length; index += 1) {
    if (ranks[index].rank !== index + 1) {
      throw new RangeError('Module ranks must be contiguous and one-based.')
    }
  }
}

function prepareMultiplierDefinition(
  input: MultiplierWeaponModuleDefinitionInput,
): MultiplierWeaponModuleDefinition {
  const ranks = input.ranks.map((rank) => {
    if (!Number.isFinite(rank.totalMultiplier) || rank.totalMultiplier <= 0) {
      throw new RangeError('Module multiplier must be finite and positive.')
    }
    return Object.freeze({ ...rank })
  })
  return Object.freeze({ ...input, ranks: Object.freeze(ranks) })
}

function prepareRangeDefinition(
  input: RangeWeaponModuleDefinitionInput,
): RangeWeaponModuleDefinition {
  let previousMultiplier = 1
  const ranks = input.ranks.map((rank) => {
    if (
      !Number.isFinite(rank.totalMultiplier) ||
      rank.totalMultiplier <= previousMultiplier
    ) {
      throw new RangeError(
        'Range Rank multipliers must be finite and strictly increase from base reach.',
      )
    }
    previousMultiplier = rank.totalMultiplier
    return Object.freeze({ ...rank })
  })
  return Object.freeze({ ...input, ranks: Object.freeze(ranks) })
}

function prepareDamageSpreadDefinition(
  input: DamageSpreadWeaponModuleDefinitionInput,
): DamageSpreadWeaponModuleDefinition {
  if (!Number.isFinite(input.bandWidth) || input.bandWidth <= 0) {
    throw new RangeError('Damage Spread bandWidth must be finite and positive.')
  }
  const ranks = input.ranks.map((rank) => {
    if (rank.bandDamageRatios.length !== rank.rank) {
      throw new RangeError(
        'Damage Spread band damage ratios must define one band per Rank.',
      )
    }
    let previousRatio = Number.POSITIVE_INFINITY
    const bandDamageRatios = rank.bandDamageRatios.map((ratio) => {
      if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
        throw new RangeError(
          'Damage Spread band damage ratios must be finite values in (0, 1].',
        )
      }
      if (ratio > previousRatio) {
        throw new RangeError(
          'Damage Spread band damage ratios must not increase outward.',
        )
      }
      previousRatio = ratio
      return ratio
    })
    return Object.freeze({
      rank: rank.rank,
      bandDamageRatios: Object.freeze(bandDamageRatios),
    })
  })
  return Object.freeze({ ...input, ranks: Object.freeze(ranks) })
}

function validateAngleSpacing(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0 || value > Math.PI * 2) {
    throw new RangeError(
      `${name} must be finite, positive, and at most one full rotation.`,
    )
  }
}

function prepareProjectileCountDefinition(
  input: ProjectileCountWeaponModuleDefinitionInput,
): ProjectileCountWeaponModuleDefinition {
  validateAngleSpacing(
    input.projectileAngleSpacingRadians,
    'Projectile Count projectile angle spacing',
  )
  validateAngleSpacing(
    input.coneAngleSpacingRadians,
    'Projectile Count Cone angle spacing',
  )
  let previousTotalCount = 1
  const ranks = input.ranks.map((rank) => {
    if (
      !Number.isSafeInteger(rank.totalCount) ||
      rank.totalCount <= previousTotalCount
    ) {
      throw new RangeError(
        'Projectile Count Rank totals must be safe integers that strictly increase from the base count.',
      )
    }
    previousTotalCount = rank.totalCount
    return Object.freeze({ ...rank })
  })
  return Object.freeze({ ...input, ranks: Object.freeze(ranks) })
}

export function defineWeaponModule(
  input: DamageSpreadWeaponModuleDefinitionInput,
): DamageSpreadWeaponModuleDefinition
export function defineWeaponModule(
  input: ProjectileCountWeaponModuleDefinitionInput,
): ProjectileCountWeaponModuleDefinition
export function defineWeaponModule(
  input: RangeWeaponModuleDefinitionInput,
): RangeWeaponModuleDefinition
export function defineWeaponModule(
  input: MultiplierWeaponModuleDefinitionInput,
): MultiplierWeaponModuleDefinition
export function defineWeaponModule(
  input: WeaponModuleDefinitionInput,
): WeaponModuleDefinition
export function defineWeaponModule(
  input: WeaponModuleDefinitionInput,
): WeaponModuleDefinition {
  validateBaseDefinition(input)
  validateRankSequence(input.ranks)
  if (!Object.values(MODULE_EFFECT_KIND).includes(input.effectKind)) {
    throw new TypeError('Unknown module effectKind.')
  }
  if (input.effectKind === MODULE_EFFECT_KIND.DAMAGE_SPREAD) {
    return prepareDamageSpreadDefinition(input)
  }
  if (input.effectKind === MODULE_EFFECT_KIND.PROJECTILE_COUNT) {
    return prepareProjectileCountDefinition(input)
  }
  if (input.effectKind === MODULE_EFFECT_KIND.RANGE) {
    return prepareRangeDefinition(input)
  }
  return prepareMultiplierDefinition(input)
}
