import type {
  WeaponCombatProfile,
  WeaponDefinition,
} from '../content/weapons/weaponDefinition.ts'

export type ResolvedWeaponProfile = Readonly<WeaponCombatProfile>

/** Builds the disposable hot-path profile for a newly created Weapon Instance. */
export function resolveWeaponProfile(
  definition: WeaponDefinition,
): ResolvedWeaponProfile {
  const profile = definition.baseProfile

  return Object.freeze({
    ...profile,
    attackPattern: Object.freeze({ ...profile.attackPattern }),
    damageShape: Object.freeze({ ...profile.damageShape }),
    trackingProfile: Object.freeze({ ...profile.trackingProfile }),
    projectilePresentation: Object.freeze({
      ...profile.projectilePresentation,
    }),
  })
}
