import assert from 'node:assert/strict'
import test from 'node:test'
import {
  prepareGameContent,
  type PreparedGameContent,
} from '../../src/game/content/gameContent.ts'
import {
  MODULE_EFFECT_KIND,
  defineWeaponModule,
  type ModuleEffectKind,
  type WeaponModuleDefinition,
} from '../../src/game/content/upgrades/moduleDefinition.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { FLAMETHROWER_WEAPON_ID } from '../../src/game/content/weapons/flamethrowerWeapon.ts'
import { createWorldState } from '../../src/game/runtime/worldState.ts'
import { equipWeapon } from '../../src/game/runtime/weaponLoadout.ts'
import type { UpgradeChoiceReference } from '../../src/game/runtime/upgradeState.ts'
import {
  installModuleFromOffer,
  type InstallModuleCommand,
} from '../../src/game/systems/moduleInstallation.ts'
import { runWeaponSystem } from '../../src/game/systems/weaponSystem.ts'

function getModule(
  content: PreparedGameContent,
  definitionId: string,
): WeaponModuleDefinition {
  const definition = content.weaponModuleDefinitionsById[definitionId]
  assert.ok(definition)
  return definition
}

function prepareModuleOffer(
  world: ReturnType<typeof createWorldState>,
  moduleDefinition: WeaponModuleDefinition,
  offerId: string,
): InstallModuleCommand {
  const choice: UpgradeChoiceReference = Object.freeze({
    id: `${offerId}:module`,
    kind: 'MODULE',
    definitionId: moduleDefinition.id,
    title: moduleDefinition.title,
    description: moduleDefinition.description,
  })
  world.upgradeState.pendingUpgradeCount = 1
  world.upgradeState.activeOffer = Object.freeze({
    id: offerId,
    sequence: world.upgradeState.offerSequence,
    choices: Object.freeze([
      choice,
      Object.freeze({ ...choice, id: `${offerId}:filler-1` }),
      Object.freeze({ ...choice, id: `${offerId}:filler-2` }),
    ]),
  })
  return {
    offerId,
    choiceId: choice.id,
    weaponInstanceId: world.weaponLoadout.equipped[0].id,
  }
}

test('installs a new module into the first empty slot at Rank I', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'module-empty-slot',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const weapon = world.weaponLoadout.equipped[0]
  const untouchedWeapon = equipWeapon(
    world.weaponLoadout,
    content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
  )
  const speed = getModule(content, 'module.attack-speed')
  const command = prepareModuleOffer(world, speed, 'offer-empty')

  const result = installModuleFromOffer(world, command)

  assert.equal(result.ok, true)
  assert.deepEqual(weapon.moduleSlots, [
    { moduleDefinitionId: speed.id, rank: 1 },
    null,
    null,
    null,
  ])
  assert.equal(weapon.profileRevision, 1)
  if (weapon.resolvedProfile.targetStrategyId !== 'AIM_ASSISTED') {
    throw new Error('Expected assisted projectile profile.')
  }
  assert.equal(weapon.resolvedProfile.fireIntervalMs, 220 / 1.15)
  assert.equal(world.upgradeState.activeOffer, null)
  assert.equal(world.upgradeState.pendingUpgradeCount, 0)
  assert.deepEqual(untouchedWeapon.moduleSlots, [null, null, null, null])
  assert.equal(untouchedWeapon.profileRevision, 0)
})

test('ranks a matching module in place using total Rank values and rejects max Rank', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'module-rank-up',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const weapon = world.weaponLoadout.equipped[0]
  const speed = getModule(content, 'module.attack-speed')

  for (let rank = 1; rank <= 3; rank += 1) {
    const command = prepareModuleOffer(world, speed, `offer-rank-${rank}`)
    assert.equal(installModuleFromOffer(world, command).ok, true)
  }

  assert.deepEqual(weapon.moduleSlots, [
    { moduleDefinitionId: speed.id, rank: 3 },
    null,
    null,
    null,
  ])
  if (weapon.resolvedProfile.targetStrategyId !== 'AIM_ASSISTED') {
    throw new Error('Expected assisted projectile profile.')
  }
  assert.equal(weapon.resolvedProfile.fireIntervalMs, 220 / 1.5)
  assert.equal(weapon.profileRevision, 3)

  const maxRankCommand = prepareModuleOffer(world, speed, 'offer-max-rank')
  const beforeSlots = weapon.moduleSlots.map((slot) =>
    slot ? { ...slot } : null,
  )
  const result = installModuleFromOffer(world, maxRankCommand)

  assert.equal(result.ok, false)
  assert.match(result.error, /maximum Rank/)
  assert.deepEqual(weapon.moduleSlots, beforeSlots)
  assert.equal(weapon.profileRevision, 3)
  assert.equal(world.upgradeState.activeOffer?.id, 'offer-max-rank')
})

function createTestModule(
  id: string,
  effectKind: ModuleEffectKind = MODULE_EFFECT_KIND.ATTACK_SPEED,
): WeaponModuleDefinition {
  return defineWeaponModule({
    id,
    title: id,
    description: `Test module ${id}`,
    effectKind,
    ranks: [{ rank: 1, totalMultiplier: 1.1 }],
  })
}

function extendModules(
  content: PreparedGameContent,
  additions: readonly WeaponModuleDefinition[],
): PreparedGameContent {
  return Object.freeze({
    ...content,
    weaponModuleDefinitions: Object.freeze([
      ...content.weaponModuleDefinitions,
      ...additions,
    ]),
    weaponModuleDefinitionsById: Object.freeze({
      ...content.weaponModuleDefinitionsById,
      ...Object.fromEntries(additions.map((definition) => [definition.id, definition])),
    }),
  })
}

test('requires an explicit full-slot replacement and changes only that slot', () => {
  const baseContent = prepareGameContent()
  const fourth = createTestModule('module.test-fourth')
  const incoming = createTestModule(
    'module.test-incoming',
    MODULE_EFFECT_KIND.ATTACK_AREA,
  )
  const content = extendModules(baseContent, [fourth, incoming])
  const world = createWorldState(
    'module-replacement',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const weapon = world.weaponLoadout.equipped[0]
  weapon.moduleSlots = [
    { moduleDefinitionId: 'module.attack-speed', rank: 1 },
    { moduleDefinitionId: 'module.attack-area', rank: 1 },
    { moduleDefinitionId: 'module.knockback', rank: 1 },
    { moduleDefinitionId: fourth.id, rank: 1 },
  ]
  const command = prepareModuleOffer(world, incoming, 'offer-replace')

  const missingReplacement = installModuleFromOffer(world, command)
  assert.equal(missingReplacement.ok, false)
  assert.match(missingReplacement.error, /replacement slot/)

  const result = installModuleFromOffer(world, {
    ...command,
    replacedSlotIndex: 1,
  })

  assert.equal(result.ok, true)
  assert.deepEqual(weapon.moduleSlots, [
    { moduleDefinitionId: 'module.attack-speed', rank: 1 },
    { moduleDefinitionId: incoming.id, rank: 1 },
    { moduleDefinitionId: 'module.knockback', rank: 1 },
    { moduleDefinitionId: fourth.id, rank: 1 },
  ])
})

test('rejects stale and replayed offers without changing the weapon', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'module-stale-offer',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const weapon = world.weaponLoadout.equipped[0]
  const area = getModule(content, 'module.attack-area')
  const command = prepareModuleOffer(world, area, 'offer-current')

  const stale = installModuleFromOffer(world, {
    ...command,
    offerId: 'offer-stale',
  })
  assert.equal(stale.ok, false)
  assert.deepEqual(weapon.moduleSlots, [null, null, null, null])

  assert.equal(installModuleFromOffer(world, command).ok, true)
  const replayed = installModuleFromOffer(world, command)
  assert.equal(replayed.ok, false)
  assert.deepEqual(weapon.moduleSlots, [
    { moduleDefinitionId: area.id, rank: 1 },
    null,
    null,
    null,
  ])
})

test('generates the next offer without leaving the paused upgrade queue', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'module-queued-offer',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const speed = getModule(content, 'module.attack-speed')
  const command = prepareModuleOffer(world, speed, 'offer-queued')
  world.upgradeState.pendingUpgradeCount = 2

  const result = installModuleFromOffer(world, command)

  assert.equal(result.ok, true)
  assert.equal(world.upgradeState.pendingUpgradeCount, 1)
  assert.ok(world.upgradeState.activeOffer)
  assert.notEqual(world.upgradeState.activeOffer.id, command.offerId)
  assert.equal(result.ok && result.nextOffer, world.upgradeState.activeOffer)
})

test('does not partially commit when the queued offer pool would be invalid', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'module-invalid-next-pool',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
    [BASIC_PROJECTILE_WEAPON_ID],
  )
  const weapon = world.weaponLoadout.equipped[0]
  weapon.moduleSlots = [
    { moduleDefinitionId: 'module.attack-speed', rank: 3 },
    { moduleDefinitionId: 'module.attack-area', rank: 2 },
    null,
    null,
  ]
  const area = getModule(content, 'module.attack-area')
  const command = prepareModuleOffer(world, area, 'offer-invalid-next')
  world.upgradeState.offerSequence = 1
  world.upgradeState.pendingUpgradeCount = 2

  const result = installModuleFromOffer(world, command)

  assert.equal(result.ok, false)
  assert.match(result.error, /next upgrade offer/)
  assert.equal(weapon.moduleSlots[1]?.rank, 2)
  assert.equal(weapon.profileRevision, 0)
  assert.equal(world.upgradeState.activeOffer?.id, command.offerId)
  assert.equal(world.upgradeState.pendingUpgradeCount, 2)
})

test('keeps an in-flight projectile on its emission-time Module snapshot', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'module-in-flight-snapshot',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  runWeaponSystem(world, 50)
  const projectile = world.projectiles[0]
  const area = getModule(content, 'module.attack-area')
  const command = prepareModuleOffer(world, area, 'offer-in-flight')

  assert.equal(installModuleFromOffer(world, command).ok, true)

  const profile = world.weaponLoadout.equipped[0].resolvedProfile
  if (profile.targetStrategyId !== 'AIM_ASSISTED') {
    throw new Error('Expected assisted projectile profile.')
  }
  assert.equal(projectile.radius, 7)
  assert.equal(projectile.impactStrengthMultiplier, 1)
  assert.equal(profile.damageShape.radius, 7 * 1.15)
})
