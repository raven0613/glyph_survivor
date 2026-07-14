import type {
  ConeWeaponCombatProfile,
  PersistentOrbitAttackPattern,
  PulsedConeAttackPattern,
  SingleProjectileAttackPattern,
  OrbitWeaponCombatProfile,
  ProjectileWeaponCombatProfile,
  WeaponDefinition,
} from '../content/weapons/weaponDefinition.ts'
import {
  MODULE_EFFECT_KIND,
  type DamageSpreadModuleRankDefinition,
  type MultiplierModuleRankDefinition,
  type ProjectileCountModuleRankDefinition,
  type WeaponModuleDefinition,
} from '../content/upgrades/moduleDefinition.ts'
import type { DamageSpreadProfile } from '../glyph/localDamage.ts'

export type ResolvedDamageSpreadProfile = DamageSpreadProfile

interface ResolvedImpactProfile {
  readonly impactStrengthMultiplier: number
  readonly damageSpreadProfile: Readonly<ResolvedDamageSpreadProfile> | null
}

interface ResolvedProjectileAttackPattern
  extends SingleProjectileAttackPattern {
  readonly emissionCount: number
  readonly emissionAngleSpacingRadians: number
}

interface ResolvedConeAttackPattern extends PulsedConeAttackPattern {
  readonly emissionCount: number
  readonly emissionAngleSpacingRadians: number
}

interface ResolvedOrbitAttackPattern extends PersistentOrbitAttackPattern {
  readonly maximumOrbitRadius: number
}

export type ResolvedProjectileWeaponProfile = Readonly<
  Omit<ProjectileWeaponCombatProfile, 'attackPattern'> &
    ResolvedImpactProfile & {
      readonly attackPattern: Readonly<ResolvedProjectileAttackPattern>
    }
>
export type ResolvedConeWeaponProfile = Readonly<
  Omit<ConeWeaponCombatProfile, 'attackPattern'> &
    ResolvedImpactProfile & {
      readonly attackPattern: Readonly<ResolvedConeAttackPattern>
    }
>
export type ResolvedOrbitWeaponProfile = Readonly<
  Omit<OrbitWeaponCombatProfile, 'attackPattern'> &
    ResolvedImpactProfile & {
      readonly attackPattern: Readonly<ResolvedOrbitAttackPattern>
    }
>
export type ResolvedWeaponProfile =
  | ResolvedProjectileWeaponProfile
  | ResolvedConeWeaponProfile
  | ResolvedOrbitWeaponProfile

export interface ResolvedModuleSlot {
  readonly moduleDefinitionId: string
  readonly rank: number
}

function getMultiplierRank(
  definition: WeaponModuleDefinition,
  rank: number,
): Readonly<MultiplierModuleRankDefinition> {
  const rankDefinition = definition.ranks[rank - 1]
  if (
    !rankDefinition ||
    rankDefinition.rank !== rank ||
    !('totalMultiplier' in rankDefinition)
  ) {
    throw new RangeError(
      `Module ${definition.id} does not define multiplier Rank ${rank}.`,
    )
  }
  return rankDefinition
}

function getDamageSpreadRank(
  definition: WeaponModuleDefinition,
  rank: number,
): Readonly<DamageSpreadModuleRankDefinition> {
  const rankDefinition = definition.ranks[rank - 1]
  if (
    !rankDefinition ||
    rankDefinition.rank !== rank ||
    !('bandDamageRatios' in rankDefinition)
  ) {
    throw new RangeError(
      `Module ${definition.id} does not define Damage Spread Rank ${rank}.`,
    )
  }
  return rankDefinition
}

function getProjectileCountRank(
  definition: WeaponModuleDefinition,
  rank: number,
): Readonly<ProjectileCountModuleRankDefinition> {
  const rankDefinition = definition.ranks[rank - 1]
  if (
    !rankDefinition ||
    rankDefinition.rank !== rank ||
    !('totalCount' in rankDefinition)
  ) {
    throw new RangeError(
      `Module ${definition.id} does not define Projectile Count Rank ${rank}.`,
    )
  }
  return rankDefinition
}

/** Builds the disposable hot-path profile for a newly created Weapon Instance. */
export function resolveWeaponProfile(
  definition: WeaponDefinition,
  moduleSlots: readonly (Readonly<ResolvedModuleSlot> | null)[] = [],
  moduleDefinitionsById: Readonly<
    Record<string, WeaponModuleDefinition>
  > = Object.freeze({}),
): ResolvedWeaponProfile {
  let attackSpeedMultiplier = 1
  let rangeMultiplier = 1
  let impactStrengthMultiplier = 1
  let projectileCountTotal: number | null = null
  let projectileAngleSpacingRadians = 0
  let coneAngleSpacingRadians = 0
  let damageSpreadProfile: Readonly<ResolvedDamageSpreadProfile> | null = null

  for (const slot of moduleSlots) {
    if (!slot) {
      continue
    }
    const moduleDefinition = moduleDefinitionsById[slot.moduleDefinitionId]
    if (!moduleDefinition) {
      throw new Error(
        `Unknown installed module definition ${slot.moduleDefinitionId}.`,
      )
    }
    switch (moduleDefinition.effectKind) {
      case MODULE_EFFECT_KIND.ATTACK_SPEED:
        attackSpeedMultiplier *= getMultiplierRank(
          moduleDefinition,
          slot.rank,
        ).totalMultiplier
        break
      case MODULE_EFFECT_KIND.DAMAGE_SPREAD: {
        const rank = getDamageSpreadRank(moduleDefinition, slot.rank)
        damageSpreadProfile = Object.freeze({
          bandWidth: moduleDefinition.bandWidth,
          bandDamageRatios: Object.freeze([...rank.bandDamageRatios]),
        })
        break
      }
      case MODULE_EFFECT_KIND.PROJECTILE_COUNT:
        projectileCountTotal = getProjectileCountRank(
          moduleDefinition,
          slot.rank,
        ).totalCount
        projectileAngleSpacingRadians =
          moduleDefinition.projectileAngleSpacingRadians
        coneAngleSpacingRadians = moduleDefinition.coneAngleSpacingRadians
        break
      case MODULE_EFFECT_KIND.RANGE:
        rangeMultiplier *= getMultiplierRank(
          moduleDefinition,
          slot.rank,
        ).totalMultiplier
        break
      case MODULE_EFFECT_KIND.KNOCKBACK:
        impactStrengthMultiplier *= getMultiplierRank(
          moduleDefinition,
          slot.rank,
        ).totalMultiplier
        break
    }
  }

  const profile = definition.baseProfile
  if (profile.targetStrategyId === 'AIM_ASSISTED') {
    return Object.freeze({
      ...profile,
      fireIntervalMs: profile.fireIntervalMs / attackSpeedMultiplier,
      impactStrengthMultiplier,
      damageSpreadProfile,
      attackPattern: Object.freeze({
        ...profile.attackPattern,
        maximumTravelDistance:
          profile.attackPattern.maximumTravelDistance * rangeMultiplier,
        emissionCount: projectileCountTotal ?? 1,
        emissionAngleSpacingRadians: projectileAngleSpacingRadians,
      }),
      damageShape: Object.freeze({ ...profile.damageShape }),
      trackingProfile: Object.freeze({
        ...profile.trackingProfile,
        range: profile.trackingProfile.range * rangeMultiplier,
      }),
      projectilePresentation: Object.freeze({
        ...profile.projectilePresentation,
      }),
    })
  }

  if (profile.targetStrategyId === 'OWNER_RELATIVE') {
    return Object.freeze({
      ...profile,
      rehitCooldownMs: profile.rehitCooldownMs,
      rootKnockbackDistance:
        profile.rootKnockbackDistance * impactStrengthMultiplier,
      impactStrengthMultiplier,
      damageSpreadProfile,
      attackPattern: Object.freeze({
        ...profile.attackPattern,
        maximumOrbitRadius:
          profile.attackPattern.orbitRadius * rangeMultiplier,
        ballCount:
          projectileCountTotal ?? profile.attackPattern.ballCount,
        angularSpeedRevolutionsPerSecond:
          profile.attackPattern.angularSpeedRevolutionsPerSecond *
          attackSpeedMultiplier,
      }),
      damageShape: Object.freeze({ ...profile.damageShape }),
      orbitPresentation: Object.freeze({ ...profile.orbitPresentation }),
    })
  }

  return Object.freeze({
    ...profile,
    fireIntervalMs: profile.fireIntervalMs / attackSpeedMultiplier,
    impactStrengthMultiplier,
    damageSpreadProfile,
    attackPattern: Object.freeze({
      ...profile.attackPattern,
      emissionCount: projectileCountTotal ?? 1,
      emissionAngleSpacingRadians: coneAngleSpacingRadians,
    }),
    damageShape: Object.freeze({
      ...profile.damageShape,
      range: profile.damageShape.range * rangeMultiplier,
    }),
    flamePresentation: Object.freeze({ ...profile.flamePresentation }),
  })
}
