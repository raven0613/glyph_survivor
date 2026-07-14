import type {
  ConeWeaponCombatProfile,
  OrbitWeaponCombatProfile,
  ProjectileWeaponCombatProfile,
  WeaponDefinition,
} from '../content/weapons/weaponDefinition.ts'
import {
  MODULE_EFFECT_KIND,
  type WeaponModuleDefinition,
} from '../content/upgrades/moduleDefinition.ts'

interface ResolvedImpactProfile {
  readonly impactStrengthMultiplier: number
}

export type ResolvedProjectileWeaponProfile = Readonly<
  ProjectileWeaponCombatProfile & ResolvedImpactProfile
>
export type ResolvedConeWeaponProfile = Readonly<
  ConeWeaponCombatProfile & ResolvedImpactProfile
>
export type ResolvedOrbitWeaponProfile = Readonly<
  OrbitWeaponCombatProfile & ResolvedImpactProfile
>
export type ResolvedWeaponProfile =
  | ResolvedProjectileWeaponProfile
  | ResolvedConeWeaponProfile
  | ResolvedOrbitWeaponProfile

export interface ResolvedModuleSlot {
  readonly moduleDefinitionId: string
  readonly rank: number
}

function getRankMultiplier(
  definition: WeaponModuleDefinition,
  rank: number,
): number {
  const rankDefinition = definition.ranks[rank - 1]
  if (!rankDefinition || rankDefinition.rank !== rank) {
    throw new RangeError(
      `Module ${definition.id} does not define Rank ${rank}.`,
    )
  }
  return rankDefinition.totalMultiplier
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
  let areaMultiplier = 1
  let impactStrengthMultiplier = 1

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
    const multiplier = getRankMultiplier(moduleDefinition, slot.rank)
    switch (moduleDefinition.effectKind) {
      case MODULE_EFFECT_KIND.ATTACK_SPEED:
        attackSpeedMultiplier *= multiplier
        break
      case MODULE_EFFECT_KIND.ATTACK_AREA:
        areaMultiplier *= multiplier
        break
      case MODULE_EFFECT_KIND.KNOCKBACK:
        impactStrengthMultiplier *= multiplier
        break
    }
  }

  const profile = definition.baseProfile
  if (profile.targetStrategyId === 'AIM_ASSISTED') {
    return Object.freeze({
      ...profile,
      fireIntervalMs: profile.fireIntervalMs / attackSpeedMultiplier,
      impactStrengthMultiplier,
      attackPattern: Object.freeze({ ...profile.attackPattern }),
      damageShape: Object.freeze({
        ...profile.damageShape,
        radius: profile.damageShape.radius * areaMultiplier,
      }),
      trackingProfile: Object.freeze({ ...profile.trackingProfile }),
      projectilePresentation: Object.freeze({
        ...profile.projectilePresentation,
      }),
    })
  }

  if (profile.targetStrategyId === 'OWNER_RELATIVE') {
    return Object.freeze({
      ...profile,
      rehitCooldownMs: profile.rehitCooldownMs / attackSpeedMultiplier,
      rootKnockbackDistance:
        profile.rootKnockbackDistance * impactStrengthMultiplier,
      impactStrengthMultiplier,
      attackPattern: Object.freeze({ ...profile.attackPattern }),
      damageShape: Object.freeze({
        ...profile.damageShape,
        radius: profile.damageShape.radius * areaMultiplier,
      }),
      orbitPresentation: Object.freeze({ ...profile.orbitPresentation }),
    })
  }

  return Object.freeze({
    ...profile,
    fireIntervalMs: profile.fireIntervalMs / attackSpeedMultiplier,
    impactStrengthMultiplier,
    attackPattern: Object.freeze({ ...profile.attackPattern }),
    damageShape: Object.freeze({
      ...profile.damageShape,
      fullAngleRadians: Math.min(
        Math.PI * 2,
        profile.damageShape.fullAngleRadians * areaMultiplier,
      ),
    }),
    flamePresentation: Object.freeze({ ...profile.flamePresentation }),
  })
}
