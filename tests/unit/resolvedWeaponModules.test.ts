import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { preparePrototypeRangeModule } from '../../src/game/content/upgrades/prototypeWeaponModules.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { FLAMETHROWER_WEAPON_ID } from '../../src/game/content/weapons/flamethrowerWeapon.ts'
import { ORBIT_ENERGY_BALL_WEAPON_ID } from '../../src/game/content/weapons/orbitEnergyBallWeapon.ts'
import type { WeaponModuleSlot } from '../../src/game/runtime/weaponLoadout.ts'
import { resolveWeaponProfile } from '../../src/game/systems/resolveWeaponProfile.ts'

function slot(moduleDefinitionId: string, rank: number): WeaponModuleSlot {
  return { moduleDefinitionId, rank }
}

function assertApproximatelyEqual(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `Expected ${actual} to approximately equal ${expected}.`,
  )
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

test('compiles Damage Spread without enlarging the primary damage shapes', () => {
  const content = prepareGameContent()
  const modules = [slot('module.damage-spread', 2)]
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

  assert.equal(projectile.damageShape.radius, 7)
  assert.equal(cone.damageShape.fullAngleRadians, Math.PI / 2)
  assert.equal(cone.damageShape.range, 160)
  assert.deepEqual(projectile.damageSpreadProfile, {
    bandWidth: 24,
    bandDamageRatios: [0.2, 0.1],
  })
  assert.deepEqual(cone.damageSpreadProfile, projectile.damageSpreadProfile)
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

test('compiles Projectile Count totals into each weapon attack pattern', () => {
  const content = prepareGameContent()
  const modules = [slot('module.projectile-count', 2)]
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
  const orbit = resolveWeaponProfile(
    content.weaponDefinitionsById[ORBIT_ENERGY_BALL_WEAPON_ID],
    modules,
    content.weaponModuleDefinitionsById,
  )
  if (
    projectile.targetStrategyId !== 'AIM_ASSISTED' ||
    cone.targetStrategyId !== 'PLAYER_AIM' ||
    orbit.targetStrategyId !== 'OWNER_RELATIVE'
  ) {
    throw new Error('Unexpected weapon profile kinds.')
  }

  assert.equal(projectile.attackPattern.emissionCount, 3)
  assert.equal(
    projectile.attackPattern.emissionAngleSpacingRadians,
    (8 * Math.PI) / 180,
  )
  assert.equal(cone.attackPattern.emissionCount, 3)
  assert.equal(
    cone.attackPattern.emissionAngleSpacingRadians,
    (10 * Math.PI) / 180,
  )
  assert.equal(orbit.attackPattern.ballCount, 3)
})

test('maps universal Modules to orbit-specific runtime parameters', () => {
  const content = prepareGameContent()
  const definition =
    content.weaponDefinitionsById[ORBIT_ENERGY_BALL_WEAPON_ID]
  const profile = resolveWeaponProfile(
    definition,
    [
      slot('module.attack-speed', 1),
      slot('module.damage-spread', 1),
      slot('module.knockback', 1),
    ],
    content.weaponModuleDefinitionsById,
  )
  if (profile.targetStrategyId !== 'OWNER_RELATIVE') {
    throw new Error('Expected owner-relative orbit profile.')
  }

  assert.equal(profile.rehitCooldownMs, 200)
  assert.equal(
    profile.attackPattern.angularSpeedRevolutionsPerSecond,
    0.9 * 1.15,
  )
  assert.equal(profile.attackPattern.orbitRadius, 80)
  assert.equal(profile.damageShape.radius, 16)
  assert.deepEqual(profile.damageSpreadProfile, {
    bandWidth: 24,
    bandDamageRatios: [0.2],
  })
  assert.equal(profile.impactStrengthMultiplier, 1.25)
  assert.equal(profile.rootKnockbackDistance, 20 * 1.25)
})

test('compiles each Range Rank into pattern-specific reach without changing area', () => {
  const content = prepareGameContent()
  const rangeDefinition = preparePrototypeRangeModule()
  const moduleDefinitionsById = Object.freeze({
    ...content.weaponModuleDefinitionsById,
    [rangeDefinition.id]: rangeDefinition,
  })
  const expectedRanks = [
    {
      rank: 1,
      targetRange: 805,
      travelDistance: 1_283.4,
      coneRange: 184,
      maximumOrbitRadius: 92,
    },
    {
      rank: 2,
      targetRange: 910,
      travelDistance: 1_450.8,
      coneRange: 208,
      maximumOrbitRadius: 104,
    },
    {
      rank: 3,
      targetRange: 1_050,
      travelDistance: 1_674,
      coneRange: 240,
      maximumOrbitRadius: 120,
    },
  ] as const

  for (const expected of expectedRanks) {
    const modules = [slot(rangeDefinition.id, expected.rank)]
    const projectile = resolveWeaponProfile(
      content.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID],
      modules,
      moduleDefinitionsById,
    )
    const cone = resolveWeaponProfile(
      content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
      modules,
      moduleDefinitionsById,
    )
    const orbit = resolveWeaponProfile(
      content.weaponDefinitionsById[ORBIT_ENERGY_BALL_WEAPON_ID],
      modules,
      moduleDefinitionsById,
    )
    if (
      projectile.targetStrategyId !== 'AIM_ASSISTED' ||
      cone.targetStrategyId !== 'PLAYER_AIM' ||
      orbit.targetStrategyId !== 'OWNER_RELATIVE'
    ) {
      throw new Error('Unexpected weapon profile kinds.')
    }

    assertApproximatelyEqual(
      projectile.trackingProfile.range,
      expected.targetRange,
    )
    assertApproximatelyEqual(
      projectile.attackPattern.maximumTravelDistance,
      expected.travelDistance,
    )
    assert.equal(projectile.attackPattern.projectileSpeed, 620)
    assert.equal(projectile.damageShape.radius, 7)

    assertApproximatelyEqual(cone.damageShape.range, expected.coneRange)
    assert.equal(cone.damageShape.fullAngleRadians, Math.PI / 2)
    assert.equal(cone.attackPattern.muzzleDistance, 20)

    assert.equal(orbit.attackPattern.orbitRadius, 80)
    assertApproximatelyEqual(
      orbit.attackPattern.maximumOrbitRadius,
      expected.maximumOrbitRadius,
    )
    assert.equal(orbit.damageShape.radius, 16)
    assert.equal(orbit.rehitCooldownMs, 200)
  }
})
