import {
  MODULE_EFFECT_KIND,
  defineWeaponModule,
  type ModuleEffectKind,
  type WeaponModuleDefinition,
} from './moduleDefinition.ts'

function createMultiplierModule(
  id: string,
  title: string,
  description: string,
  effectKind: ModuleEffectKind,
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

export function preparePrototypeWeaponModules(): readonly WeaponModuleDefinition[] {
  return Object.freeze([
    createMultiplierModule(
      'module.attack-speed',
      'Attack Speed',
      'Fire more frequently.',
      MODULE_EFFECT_KIND.ATTACK_SPEED,
      [1.15, 1.3, 1.5],
    ),
    createMultiplierModule(
      'module.attack-area',
      'Attack Area',
      'Increase the attack shape.',
      MODULE_EFFECT_KIND.ATTACK_AREA,
      [1.15, 1.3, 1.5],
    ),
    createMultiplierModule(
      'module.knockback',
      'Knockback',
      'Increase impact displacement.',
      MODULE_EFFECT_KIND.KNOCKBACK,
      [1.25, 1.6, 2],
    ),
  ])
}
