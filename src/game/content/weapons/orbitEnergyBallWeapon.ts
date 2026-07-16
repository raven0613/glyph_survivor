import { WEAPON_DEFINITION_ID } from '../../../shared/weaponIds.ts'
import { getPrintableAsciiGlyphFrame } from '../../glyph/glyphFrame.ts'
import { DAMAGE_TARGET_MODE } from '../../glyph/localDamage.ts'
import { PLAYER_ATTACK_VISUAL_ROLE } from '../visuals/combatVisualTheme.ts'
import {
  ATTACK_PATTERN,
  DAMAGE_SHAPE,
  DESTRUCTION_PROFILE,
  TARGET_STRATEGY,
  defineWeapon,
  type WeaponDefinition,
} from './weaponDefinition.ts'

export const ORBIT_ENERGY_BALL_WEAPON_ID =
  WEAPON_DEFINITION_ID.ORBIT_ENERGY_BALL

export function prepareOrbitEnergyBallWeaponDefinition(): WeaponDefinition {
  return defineWeapon({
    id: ORBIT_ENERGY_BALL_WEAPON_ID,
    title: 'ORB',
    description: 'Rotates around you, dealing damage and knocking back enemies.',
    identityGlyph: 'O',
    moduleSlotCount: 4,
    baseProfile: {
      targetStrategyId: TARGET_STRATEGY.OWNER_RELATIVE,
      attackPattern: {
        kind: ATTACK_PATTERN.PERSISTENT_ORBIT,
        ballCount: 1,
        orbitRadius: 80,
        angularSpeedRevolutionsPerSecond: 0.9,
      },
      damageShape: {
        kind: DAMAGE_SHAPE.CIRCLE,
        radius: 16,
        targetMode: DAMAGE_TARGET_MODE.AREA,
      },
      destructionProfileId: DESTRUCTION_PROFILE.KNOCKBACK_CONTACT,
      damageAmount: 0.8,
      rehitCooldownMs: 200,
      rootKnockbackDistance: 20,
      orbitPresentation: {
        glyphFrame: getPrintableAsciiGlyphFrame('O'),
        scale: 0.82,
        visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.ORBIT_ENERGY,
      },
    },
  })
}
