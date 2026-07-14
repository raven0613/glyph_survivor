import { DAMAGE_TARGET_MODE } from '../../glyph/localDamage.ts'
import { WEAPON_DEFINITION_ID } from '../../../shared/weaponIds.ts'
import {
  ATTACK_PATTERN,
  DAMAGE_SHAPE,
  DESTRUCTION_PROFILE,
  TARGET_STRATEGY,
  defineWeapon,
  type WeaponDefinition,
} from './weaponDefinition.ts'

export const FLAMETHROWER_WEAPON_ID = WEAPON_DEFINITION_ID.FLAMETHROWER

export function prepareFlamethrowerWeaponDefinition(): WeaponDefinition {
  return defineWeapon({
    id: FLAMETHROWER_WEAPON_ID,
    title: 'Flamethrower',
    description: 'Scatters short pulses of flame through a wide cone.',
    identityGlyph: '*',
    moduleSlotCount: 4,
    baseProfile: {
      fireIntervalMs: 250,
      targetStrategyId: TARGET_STRATEGY.PLAYER_AIM,
      attackPattern: {
        kind: ATTACK_PATTERN.PULSED_CONE,
        muzzleDistance: 20,
      },
      damageShape: {
        kind: DAMAGE_SHAPE.CONE,
        range: 160,
        fullAngleRadians: Math.PI / 2,
        targetMode: DAMAGE_TARGET_MODE.AREA,
      },
      destructionProfileId: DESTRUCTION_PROFILE.MATERIAL_IMPACT,
      damageAmount: 0.125,
      flamePresentation: {
        durationMs: 320,
        particleCount: 12,
        innerTint: 0xffdd33,
        outerTint: 0xff7a18,
      },
    },
  })
}
