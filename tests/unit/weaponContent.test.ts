import assert from 'node:assert/strict'
import test from 'node:test'
import { getPrintableAsciiGlyphFrame } from '../../src/game/glyph/glyphFrame.ts'
import {
  getWeaponDefinition,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import {
  BASIC_PROJECTILE_WEAPON_ID,
} from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { FLAMETHROWER_WEAPON_ID } from '../../src/game/content/weapons/flamethrowerWeapon.ts'
import { ORBIT_ENERGY_BALL_WEAPON_ID } from '../../src/game/content/weapons/orbitEnergyBallWeapon.ts'
import {
  ATTACK_PATTERN,
  DAMAGE_SHAPE,
  DESTRUCTION_PROFILE,
  TARGET_STRATEGY,
  defineWeapon,
  type WeaponCombatProfile,
} from '../../src/game/content/weapons/weaponDefinition.ts'

test('prepares the assisted o projectile as immutable weapon content', () => {
  const content = prepareGameContent()
  const weapon = getWeaponDefinition(content, BASIC_PROJECTILE_WEAPON_ID)

  assert.deepEqual(
    content.weaponDefinitions.map((definition) => definition.id),
    [
      BASIC_PROJECTILE_WEAPON_ID,
      FLAMETHROWER_WEAPON_ID,
      ORBIT_ENERGY_BALL_WEAPON_ID,
    ],
  )
  assert.equal(content.maximumEquippedWeapons, 3)
  assert.equal(weapon.moduleSlotCount, 4)
  assert.equal(weapon.identityGlyph, 'o')
  assert.equal(weapon.baseProfile.targetStrategyId, TARGET_STRATEGY.AIM_ASSISTED)
  assert.equal(weapon.baseProfile.attackPattern.kind, ATTACK_PATTERN.SINGLE_PROJECTILE)
  assert.equal(weapon.baseProfile.damageShape.kind, DAMAGE_SHAPE.POINT)
  assert.equal(
    weapon.baseProfile.destructionProfileId,
    DESTRUCTION_PROFILE.MATERIAL_IMPACT,
  )
  assert.deepEqual(
    {
      fireIntervalMs: weapon.baseProfile.fireIntervalMs,
      muzzleDistance: weapon.baseProfile.attackPattern.muzzleDistance,
      projectileSpeed: weapon.baseProfile.attackPattern.projectileSpeed,
      projectileLifetimeMs:
        weapon.baseProfile.attackPattern.projectileLifetimeMs,
      damageRadius: weapon.baseProfile.damageShape.radius,
      damageAmount: weapon.baseProfile.damageAmount,
      glyphFrame: weapon.baseProfile.projectilePresentation.glyphFrame,
      scale: weapon.baseProfile.projectilePresentation.scale,
      alpha: weapon.baseProfile.projectilePresentation.alpha,
      tint: weapon.baseProfile.projectilePresentation.tint,
    },
    {
      fireIntervalMs: 220,
      muzzleDistance: 22,
      projectileSpeed: 620,
      projectileLifetimeMs: 1_800,
      damageRadius: 7,
      damageAmount: 1,
      glyphFrame: getPrintableAsciiGlyphFrame('o'),
      scale: 0.55,
      alpha: 1,
      tint: 0x66ddff,
    },
  )
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

  assert.equal(weapon.identityGlyph, 'O')
  assert.equal(profile.targetStrategyId, TARGET_STRATEGY.OWNER_RELATIVE)
  assert.equal(profile.attackPattern.kind, ATTACK_PATTERN.PERSISTENT_ORBIT)
  assert.equal(profile.damageShape.kind, DAMAGE_SHAPE.CIRCLE)
  assert.equal(
    profile.destructionProfileId,
    DESTRUCTION_PROFILE.KNOCKBACK_CONTACT,
  )
  assert.deepEqual(
    {
      ballCount: profile.attackPattern.ballCount,
      orbitRadius: profile.attackPattern.orbitRadius,
      angularSpeed: profile.attackPattern.angularSpeedRevolutionsPerSecond,
      damageRadius: profile.damageShape.radius,
      damage: profile.damageAmount,
      rehitCooldownMs: profile.rehitCooldownMs,
      rootKnockbackDistance: profile.rootKnockbackDistance,
      glyphFrame: profile.orbitPresentation.glyphFrame,
    },
    {
      ballCount: 1,
      orbitRadius: 80,
      angularSpeed: 0.9,
      damageRadius: 14,
      damage: 0.6,
      rehitCooldownMs: 500,
      rootKnockbackDistance: 16,
      glyphFrame: getPrintableAsciiGlyphFrame('O'),
    },
  )
  assert.equal(Object.isFrozen(profile.orbitPresentation), true)
})

test('prepares a short-range 90 degree pulsed cone flamethrower', () => {
  const content = prepareGameContent()
  const weapon = getWeaponDefinition(content, FLAMETHROWER_WEAPON_ID)

  assert.equal(weapon.moduleSlotCount, 4)
  assert.equal(weapon.baseProfile.targetStrategyId, TARGET_STRATEGY.PLAYER_AIM)
  assert.equal(weapon.baseProfile.attackPattern.kind, ATTACK_PATTERN.PULSED_CONE)
  assert.equal(weapon.baseProfile.damageShape.kind, DAMAGE_SHAPE.CONE)
  assert.deepEqual(
    {
      interval: weapon.baseProfile.fireIntervalMs,
      muzzle: weapon.baseProfile.attackPattern.muzzleDistance,
      range: weapon.baseProfile.damageShape.range,
      angle: weapon.baseProfile.damageShape.fullAngleRadians,
      damage: weapon.baseProfile.damageAmount,
    },
    {
      interval: 250,
      muzzle: 20,
      range: 160,
      angle: Math.PI / 2,
      damage: 0.25,
    },
  )
  assert.equal(Object.isFrozen(weapon.baseProfile.flamePresentation), true)
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
