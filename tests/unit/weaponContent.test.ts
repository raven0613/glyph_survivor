import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getWeaponDefinition,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import {
  BASIC_PROJECTILE_WEAPON_ID,
  prepareBasicProjectileWeaponDefinition,
} from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import {
  FLAMETHROWER_WEAPON_ID,
  prepareFlamethrowerWeaponDefinition,
} from '../../src/game/content/weapons/flamethrowerWeapon.ts'
import {
  ORBIT_ENERGY_BALL_WEAPON_ID,
  prepareOrbitEnergyBallWeaponDefinition,
} from '../../src/game/content/weapons/orbitEnergyBallWeapon.ts'
import {
  ATTACK_PATTERN,
  DAMAGE_SHAPE,
  DESTRUCTION_PROFILE,
  TARGET_STRATEGY,
  defineWeapon,
  type WeaponCombatProfile,
} from '../../src/game/content/weapons/weaponDefinition.ts'
import { PLAYER_ATTACK_VISUAL_ROLE } from '../../src/game/content/visuals/combatVisualTheme.ts'

test('prepares the assisted o projectile as immutable weapon content', () => {
  const content = prepareGameContent()
  const weapon = getWeaponDefinition(content, BASIC_PROJECTILE_WEAPON_ID)

  assert.deepEqual(weapon, prepareBasicProjectileWeaponDefinition())
  assert.deepEqual(
    content.weaponDefinitions.map((definition) => definition.id),
    [
      BASIC_PROJECTILE_WEAPON_ID,
      FLAMETHROWER_WEAPON_ID,
      ORBIT_ENERGY_BALL_WEAPON_ID,
    ],
  )
  assert.ok(content.maximumEquippedWeapons > 0)
  assert.ok(weapon.moduleSlotCount > 0)
  assert.equal(weapon.identityGlyph, 'o')
  assert.equal(weapon.baseProfile.targetStrategyId, TARGET_STRATEGY.AIM_ASSISTED)
  assert.equal(weapon.baseProfile.attackPattern.kind, ATTACK_PATTERN.SINGLE_PROJECTILE)
  assert.equal(weapon.baseProfile.damageShape.kind, DAMAGE_SHAPE.POINT)
  assert.equal(
    weapon.baseProfile.destructionProfileId,
    DESTRUCTION_PROFILE.MATERIAL_IMPACT,
  )
  assert.equal(
    weapon.baseProfile.projectilePresentation.visualRoleId,
    PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
  )
  assert.equal('projectileLifetimeMs' in weapon.baseProfile.attackPattern, false)
  assert.equal(Object.isFrozen(weapon), true)
  assert.equal(Object.isFrozen(weapon.baseProfile), true)
  assert.equal(Object.isFrozen(weapon.baseProfile.attackPattern), true)
  assert.equal(Object.isFrozen(weapon.baseProfile.damageShape), true)
  assert.equal(Object.isFrozen(weapon.baseProfile.projectilePresentation), true)
})

test('prepares the persistent orbiting O as owner-relative weapon content', () => {
  const content = prepareGameContent()
  const weapon = getWeaponDefinition(content, ORBIT_ENERGY_BALL_WEAPON_ID)
  const profile = weapon.baseProfile

  assert.deepEqual(weapon, prepareOrbitEnergyBallWeaponDefinition())
  assert.equal(weapon.identityGlyph, 'O')
  assert.equal(profile.targetStrategyId, TARGET_STRATEGY.OWNER_RELATIVE)
  assert.equal(profile.attackPattern.kind, ATTACK_PATTERN.PERSISTENT_ORBIT)
  assert.equal(profile.damageShape.kind, DAMAGE_SHAPE.CIRCLE)
  assert.equal(
    profile.destructionProfileId,
    DESTRUCTION_PROFILE.KNOCKBACK_CONTACT,
  )
  assert.equal(
    profile.orbitPresentation.visualRoleId,
    PLAYER_ATTACK_VISUAL_ROLE.ORBIT_ENERGY,
  )
  assert.equal(Object.isFrozen(profile.orbitPresentation), true)
})

test('prepares the short-range aimed pulsed-cone flamethrower', () => {
  const content = prepareGameContent()
  const weapon = getWeaponDefinition(content, FLAMETHROWER_WEAPON_ID)

  assert.deepEqual(weapon, prepareFlamethrowerWeaponDefinition())
  assert.ok(weapon.moduleSlotCount > 0)
  assert.equal(weapon.baseProfile.targetStrategyId, TARGET_STRATEGY.PLAYER_AIM)
  assert.equal(weapon.baseProfile.attackPattern.kind, ATTACK_PATTERN.PULSED_CONE)
  assert.equal(weapon.baseProfile.damageShape.kind, DAMAGE_SHAPE.CONE)
  assert.equal(Object.isFrozen(weapon.baseProfile.flamePresentation), true)
  assert.equal(
    weapon.baseProfile.flamePresentation.visualRoleId,
    PLAYER_ATTACK_VISUAL_ROLE.FLAMETHROWER,
  )
})

test('rejects invalid weapon content before a run starts', () => {
  const content = prepareGameContent()
  const weapon = getWeaponDefinition(content, BASIC_PROJECTILE_WEAPON_ID)

  assert.throws(
    () =>
      defineWeapon({
        ...weapon,
        id: 'weapon.invalid-slots',
        moduleSlotCount: -1,
      }),
    /moduleSlotCount/,
  )
  assert.throws(
    () => getWeaponDefinition(content, 'weapon.unknown'),
    /Unknown weapon definition/,
  )
  assert.throws(
    () =>
      defineWeapon({
        ...weapon,
        id: 'weapon.invalid-strategy',
        baseProfile: {
          ...weapon.baseProfile,
          targetStrategyId: 'UNKNOWN' as typeof weapon.baseProfile.targetStrategyId,
        } as unknown as WeaponCombatProfile,
      }),
    /targetStrategyId/,
  )
})
