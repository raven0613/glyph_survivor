import {
  MODULE_EFFECT_KIND,
  defineWeaponModule,
  type MultiplierWeaponModuleDefinitionInput,
  type RangeWeaponModuleDefinition,
  type WeaponModuleDefinition,
} from './moduleDefinition.ts'

export const PROTOTYPE_WEAPON_MODULE_ID = Object.freeze({
  ATTACK_SPEED: 'module.attack-speed',
  PROJECTILE_COUNT: 'module.projectile-count',
  DAMAGE_SPREAD: 'module.damage-spread',
  RANGE: 'module.range',
  KNOCKBACK: 'module.knockback',
} as const)

const PROTOTYPE_DAMAGE_SPREAD_BAND_WIDTH = 24
const DEGREES_TO_RADIANS = Math.PI / 180
const PROTOTYPE_PROJECTILE_ANGLE_SPACING_RADIANS = 8 * DEGREES_TO_RADIANS
const PROTOTYPE_CONE_ANGLE_SPACING_RADIANS = 10 * DEGREES_TO_RADIANS

function createMultiplierModule(
  id: string,
  title: string,
  description: string,
  effectKind: MultiplierWeaponModuleDefinitionInput['effectKind'],
  multipliers: readonly number[],
): WeaponModuleDefinition {
  return defineWeaponModule({
    id,
    title,
    description,
    effectKind,
    ranks: multipliers.map((totalMultiplier, index) => ({
      rank: index + 1,
      totalMultiplier,
    })),
  })
}

export function preparePrototypeRangeModule(): RangeWeaponModuleDefinition {
  return defineWeaponModule({
    id: PROTOTYPE_WEAPON_MODULE_ID.RANGE,
    title: 'Range',
    description: 'Increase this weapon\'s pattern-specific reach.',
    effectKind: MODULE_EFFECT_KIND.RANGE,
    ranks: [
      { rank: 1, totalMultiplier: 1.15 },
      { rank: 2, totalMultiplier: 1.3 },
      { rank: 3, totalMultiplier: 1.5 },
    ],
  })
}

export function preparePrototypeWeaponModules(): readonly WeaponModuleDefinition[] {
  return Object.freeze([
    createMultiplierModule(
      PROTOTYPE_WEAPON_MODULE_ID.ATTACK_SPEED,
      'Attack Speed',
      'Fire or rotate more frequently.',
      MODULE_EFFECT_KIND.ATTACK_SPEED,
      [1.15, 1.3, 1.5],
    ),
    defineWeaponModule({
      id: PROTOTYPE_WEAPON_MODULE_ID.PROJECTILE_COUNT,
      title: 'Projectile Count',
      description: 'Emit more projectiles, Cone streams, or orbiting balls.',
      effectKind: MODULE_EFFECT_KIND.PROJECTILE_COUNT,
      projectileAngleSpacingRadians:
        PROTOTYPE_PROJECTILE_ANGLE_SPACING_RADIANS,
      coneAngleSpacingRadians: PROTOTYPE_CONE_ANGLE_SPACING_RADIANS,
      ranks: [
        { rank: 1, totalCount: 2 },
        { rank: 2, totalCount: 3 },
        { rank: 3, totalCount: 4 },
      ],
    }),
    defineWeaponModule({
      id: PROTOTYPE_WEAPON_MODULE_ID.DAMAGE_SPREAD,
      title: 'Damage Spread',
      description: 'Damage living Glyphs beyond the primary attack shape.',
      effectKind: MODULE_EFFECT_KIND.DAMAGE_SPREAD,
      bandWidth: PROTOTYPE_DAMAGE_SPREAD_BAND_WIDTH,
      ranks: [
        { rank: 1, bandDamageRatios: [0.2] },
        { rank: 2, bandDamageRatios: [0.2, 0.1] },
        { rank: 3, bandDamageRatios: [0.2, 0.1, 0.05] },
      ],
    }),
    preparePrototypeRangeModule(),
    createMultiplierModule(
      PROTOTYPE_WEAPON_MODULE_ID.KNOCKBACK,
      'Knockback',
      'Increase impact displacement.',
      MODULE_EFFECT_KIND.KNOCKBACK,
      [1.25, 1.6, 2],
    ),
  ])
}
