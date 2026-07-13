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
import {
  ATTACK_PATTERN,
  DAMAGE_SHAPE,
  DESTRUCTION_PROFILE,
  TARGET_STRATEGY,
  defineWeapon,
} from '../../src/game/content/weapons/weaponDefinition.ts'

test('prepares the assisted o projectile as immutable weapon content', () => {
  const content = prepareGameContent()
  const weapon = getWeaponDefinition(content, BASIC_PROJECTILE_WEAPON_ID)

  assert.deepEqual(
    content.weaponDefinitions.map((definition) => definition.id),
    [BASIC_PROJECTILE_WEAPON_ID],
  )
  assert.equal(content.maximumEquippedWeapons, 3)
  assert.equal(weapon.moduleSlotCount, 3)
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
        },
      }),
    /targetStrategyId/,
  )
})
