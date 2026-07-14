import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { FLAMETHROWER_WEAPON_ID } from '../../src/game/content/weapons/flamethrowerWeapon.ts'
import { ORBIT_ENERGY_BALL_WEAPON_ID } from '../../src/game/content/weapons/orbitEnergyBallWeapon.ts'
import type { WeaponModuleSlot } from '../../src/game/runtime/weaponLoadout.ts'
import { resolveWeaponProfile } from '../../src/game/systems/resolveWeaponProfile.ts'

function slot(moduleDefinitionId: string, rank: number): WeaponModuleSlot {
  return { moduleDefinitionId, rank }
}

test('compiles Rank totals in slot order without compounding earlier ranks', () => {
  const content = prepareGameContent()
  const definition = content.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID]

  const profile = resolveWeaponProfile(
    definition,
    [slot('module.attack-speed', 2)],
    content.weaponModuleDefinitionsById,
  )
  if (profile.targetStrategyId !== 'AIM_ASSISTED') {
    throw new Error('Expected assisted projectile profile.')
  }

  assert.equal(profile.fireIntervalMs, 220 / 1.3)
  assert.equal(profile.impactStrengthMultiplier, 1)
})

test('maps Attack Area to projectile radius and flamethrower angle only', () => {
  const content = prepareGameContent()
  const modules = [slot('module.attack-area', 1)]
  const projectile = resolveWeaponProfile(
    content.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID],
    modules,
    content.weaponModuleDefinitionsById,
  )
  const cone = resolveWeaponProfile(
    content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
    modules,
    content.weaponModuleDefinitionsById,
  )
  if (
    projectile.targetStrategyId !== 'AIM_ASSISTED' ||
    cone.targetStrategyId !== 'PLAYER_AIM'
  ) {
    throw new Error('Unexpected weapon profile kinds.')
  }

  assert.equal(projectile.damageShape.radius, 7 * 1.15)
  assert.equal(cone.damageShape.fullAngleRadians, (Math.PI / 2) * 1.15)
  assert.equal(cone.damageShape.range, 160)
})

test('compiles Knockback as an explicit impact strength multiplier', () => {
  const content = prepareGameContent()
  const profile = resolveWeaponProfile(
    content.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID],
    [slot('module.knockback', 2)],
    content.weaponModuleDefinitionsById,
  )

  assert.equal(profile.impactStrengthMultiplier, 1.6)
})

test('maps universal Modules to orbit-specific runtime parameters', () => {
  const content = prepareGameContent()
  const definition =
    content.weaponDefinitionsById[ORBIT_ENERGY_BALL_WEAPON_ID]
  const profile = resolveWeaponProfile(
    definition,
    [
      slot('module.attack-speed', 1),
      slot('module.attack-area', 1),
      slot('module.knockback', 1),
    ],
    content.weaponModuleDefinitionsById,
  )
  if (profile.targetStrategyId !== 'OWNER_RELATIVE') {
    throw new Error('Expected owner-relative orbit profile.')
  }

  assert.equal(profile.rehitCooldownMs, 500 / 1.15)
  assert.equal(profile.attackPattern.angularSpeedRevolutionsPerSecond, 0.9)
  assert.equal(profile.attackPattern.orbitRadius, 80)
  assert.equal(profile.damageShape.radius, 14 * 1.15)
  assert.equal(profile.impactStrengthMultiplier, 1.25)
  assert.equal(profile.rootKnockbackDistance, 16 * 1.25)
})
