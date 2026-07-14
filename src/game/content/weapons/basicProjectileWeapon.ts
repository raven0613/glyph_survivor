import { getPrintableAsciiGlyphFrame } from '../../glyph/glyphFrame.ts'
import { DAMAGE_TARGET_MODE } from '../../glyph/localDamage.ts'
import { WEAPON_DEFINITION_ID } from '../../../shared/weaponIds.ts'
import { ASSISTED_PROJECTILE_TRACKING } from './projectileTracking.ts'
import {
  ATTACK_PATTERN,
  DAMAGE_SHAPE,
  DESTRUCTION_PROFILE,
  TARGET_STRATEGY,
  defineWeapon,
  type WeaponDefinition,
} from './weaponDefinition.ts'

export const BASIC_PROJECTILE_WEAPON_ID = WEAPON_DEFINITION_ID.ASSISTED_O

// Temporary content-local default until the first weapon roster is tuned.
const PROTOTYPE_MODULE_SLOT_COUNT = 4

export function prepareBasicProjectileWeaponDefinition(): WeaponDefinition {
  return defineWeapon({
    id: BASIC_PROJECTILE_WEAPON_ID,
    title: 'Assisted o',
    description: 'Fires a small projectile with limited aim correction.',
    identityGlyph: 'o',
    moduleSlotCount: PROTOTYPE_MODULE_SLOT_COUNT,
    baseProfile: {
      fireIntervalMs: 220,
      targetStrategyId: TARGET_STRATEGY.AIM_ASSISTED,
      attackPattern: {
        kind: ATTACK_PATTERN.SINGLE_PROJECTILE,
        muzzleDistance: 22,
        projectileSpeed: 620,
        maximumTravelDistance: 1_116,
      },
      damageShape: {
        kind: DAMAGE_SHAPE.POINT,
        radius: 7,
        targetMode: DAMAGE_TARGET_MODE.SINGLE,
      },
      destructionProfileId: DESTRUCTION_PROFILE.MATERIAL_IMPACT,
      damageAmount: 1,
      trackingProfile: ASSISTED_PROJECTILE_TRACKING,
      projectilePresentation: {
        glyphFrame: getPrintableAsciiGlyphFrame('o'),
        scale: 0.55,
        alpha: 1,
        tint: 0x66ddff,
      },
    },
  })
}
