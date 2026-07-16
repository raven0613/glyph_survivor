import assert from 'node:assert/strict'
import test from 'node:test'
import {
  prepareGameContent,
  type PreparedGameContent,
} from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { FLAMETHROWER_WEAPON_ID } from '../../src/game/content/weapons/flamethrowerWeapon.ts'
import { ORBIT_ENERGY_BALL_WEAPON_ID } from '../../src/game/content/weapons/orbitEnergyBallWeapon.ts'
import {
  defineWeapon,
  type WeaponDefinition,
} from '../../src/game/content/weapons/weaponDefinition.ts'
import type { UpgradeChoiceReference } from '../../src/game/runtime/upgradeState.ts'
import {
  equipWeapon,
  type WeaponInstance,
} from '../../src/game/runtime/weaponLoadout.ts'
import { createWorldState } from '../../src/game/runtime/worldState.ts'
import {
  acquireWeaponFromOffer,
  type AcquireWeaponCommand,
} from '../../src/game/systems/weaponAcquisition.ts'
import { runWeaponSystem } from '../../src/game/systems/weaponSystem.ts'
import { runOrbitWeaponSystem } from '../../src/game/systems/orbitWeaponSystem.ts'

function createTestWeapon(
  template: WeaponDefinition,
  id: string,
): WeaponDefinition {
  return defineWeapon({
    ...template,
    id,
    title: id,
    description: `Test weapon ${id}`,
  })
}

function extendWeapons(
  content: PreparedGameContent,
  additions: readonly WeaponDefinition[],
): PreparedGameContent {
  return Object.freeze({
    ...content,
    weaponDefinitions: Object.freeze([
      ...content.weaponDefinitions,
      ...additions,
    ]),
    weaponDefinitionsById: Object.freeze({
      ...content.weaponDefinitionsById,
      ...Object.fromEntries(
        additions.map((definition) => [definition.id, definition]),
      ),
    }),
  })
}

function prepareWeaponOffer(
  world: ReturnType<typeof createWorldState>,
  definition: WeaponDefinition,
  offerId: string,
  pendingUpgradeCount = 1,
): AcquireWeaponCommand {
  const choice: UpgradeChoiceReference = Object.freeze({
    id: `${offerId}:weapon`,
    kind: 'WEAPON',
    definitionId: definition.id,
    title: definition.title,
    description: definition.description,
  })
  world.upgradeState.pendingUpgradeCount = pendingUpgradeCount
  world.upgradeState.offerSequence = 1
  world.upgradeState.activeOffer = Object.freeze({
    id: offerId,
    sequence: 0,
    choices: Object.freeze([
      choice,
      Object.freeze({ ...choice, id: `${offerId}:filler-1` }),
      Object.freeze({ ...choice, id: `${offerId}:filler-2` }),
    ]),
  })
  return { offerId, choiceId: choice.id }
}

test('acquires an unlocked weapon below the cap as a fresh instance', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'weapon-acquire-open-slot',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const originalWeapon = world.weaponLoadout.equipped[0]
  originalWeapon.cooldownRemainingMs = 73
  const command = prepareWeaponOffer(
    world,
    content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
    'offer-open-slot',
  )

  const result = acquireWeaponFromOffer(world, command)

  assert.equal(result.ok, true)
  assert.equal(world.weaponLoadout.equipped.length, 2)
  assert.equal(world.weaponLoadout.equipped[0], originalWeapon)
  assert.equal(originalWeapon.cooldownRemainingMs, 73)
  const acquiredWeapon = world.weaponLoadout.equipped[1]
  assert.deepEqual(
    {
      id: acquiredWeapon.id,
      definitionId: acquiredWeapon.definitionId,
      equipmentSlot: acquiredWeapon.equipmentSlot,
      cooldownRemainingMs: acquiredWeapon.cooldownRemainingMs,
      attackSequence: acquiredWeapon.attackSequence,
      moduleSlots: acquiredWeapon.moduleSlots,
      profileRevision: acquiredWeapon.profileRevision,
    },
    {
      id: 2,
      definitionId: FLAMETHROWER_WEAPON_ID,
      equipmentSlot: 1,
      cooldownRemainingMs: 0,
      attackSequence: 0,
      moduleSlots: [null, null, null, null],
      profileRevision: 0,
    },
  )
  assert.equal(world.upgradeState.pendingUpgradeCount, 0)
  assert.equal(world.upgradeState.activeOffer, null)
})

test('rejects stale, replayed, locked, and duplicate weapon choices', () => {
  const baseContent = prepareGameContent()
  const lockedWeapon = createTestWeapon(
    baseContent.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID],
    'weapon.test-locked',
  )
  const content = extendWeapons(baseContent, [lockedWeapon])
  const world = createWorldState(
    'weapon-acquire-rejections',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
    [BASIC_PROJECTILE_WEAPON_ID, FLAMETHROWER_WEAPON_ID],
  )
  const lockedCommand = prepareWeaponOffer(
    world,
    lockedWeapon,
    'offer-locked',
  )
  const beforeLoadout = [...world.weaponLoadout.equipped]

  const staleResult = acquireWeaponFromOffer(world, {
    ...lockedCommand,
    offerId: 'offer-stale',
  })
  assert.equal(staleResult.ok, false)

  const lockedResult = acquireWeaponFromOffer(world, lockedCommand)
  assert.equal(lockedResult.ok, false)
  assert.match(lockedResult.error, /not unlocked/)
  assert.deepEqual(world.weaponLoadout.equipped, beforeLoadout)
  assert.equal(world.upgradeState.activeOffer?.id, lockedCommand.offerId)

  const flameCommand = prepareWeaponOffer(
    world,
    content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
    'offer-flame',
  )
  assert.equal(acquireWeaponFromOffer(world, flameCommand).ok, true)
  assert.equal(acquireWeaponFromOffer(world, flameCommand).ok, false)

  const duplicateCommand = prepareWeaponOffer(
    world,
    content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
    'offer-duplicate',
  )
  const duplicateResult = acquireWeaponFromOffer(world, duplicateCommand)
  assert.equal(duplicateResult.ok, false)
  assert.match(duplicateResult.error, /already equipped/)
  assert.equal(world.weaponLoadout.equipped.length, 2)
  assert.equal(world.upgradeState.activeOffer?.id, duplicateCommand.offerId)
})

test('full loadout replacement preserves position and untouched instances', () => {
  const baseContent = prepareGameContent()
  const template = baseContent.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID]
  const thirdWeapon = createTestWeapon(template, 'weapon.test-third')
  const incomingWeapon = createTestWeapon(template, 'weapon.test-incoming')
  const content = extendWeapons(baseContent, [thirdWeapon, incomingWeapon])
  const unlockedIds = content.weaponDefinitions.map(({ id }) => id)
  const world = createWorldState(
    'weapon-full-replacement',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
    unlockedIds,
  )
  const replacedWeapon = world.weaponLoadout.equipped[0]
  const untouchedFlame = equipWeapon(
    world.weaponLoadout,
    content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
  )
  const untouchedThird = equipWeapon(world.weaponLoadout, thirdWeapon)
  runWeaponSystem(world, 10)
  const inFlightProjectile = world.projectiles.find(
    ({ sourceWeaponInstanceId }) =>
      sourceWeaponInstanceId === replacedWeapon.id,
  )
  assert.ok(inFlightProjectile)
  replacedWeapon.moduleSlots[0] = {
    moduleDefinitionId: 'module.attack-speed',
    rank: 1,
  }
  replacedWeapon.cooldownRemainingMs = 91
  replacedWeapon.attackSequence = 7
  replacedWeapon.profileRevision = 1
  untouchedFlame.cooldownRemainingMs = 52
  untouchedThird.cooldownRemainingMs = 33
  const command = prepareWeaponOffer(
    world,
    incomingWeapon,
    'offer-full-replacement',
  )

  const missingTarget = acquireWeaponFromOffer(world, command)
  assert.equal(missingTarget.ok, false)
  assert.match(missingTarget.error, /replacement weapon/)
  assert.equal(world.upgradeState.activeOffer?.id, command.offerId)

  const result = acquireWeaponFromOffer(world, {
    ...command,
    replacedWeaponInstanceId: replacedWeapon.id,
  })

  assert.equal(result.ok, true)
  assert.equal(world.weaponLoadout.equipped.length, 3)
  const acquiredWeapon = world.weaponLoadout.equipped[0]
  assert.equal(acquiredWeapon.definitionId, incomingWeapon.id)
  assert.equal(acquiredWeapon.equipmentSlot, replacedWeapon.equipmentSlot)
  assert.notEqual(acquiredWeapon.id, replacedWeapon.id)
  assert.deepEqual(acquiredWeapon.moduleSlots, [null, null, null, null])
  assert.equal(acquiredWeapon.cooldownRemainingMs, 0)
  assert.equal(acquiredWeapon.attackSequence, 0)
  assert.equal(acquiredWeapon.profileRevision, 0)
  assert.equal(world.weaponLoadout.equipped[1], untouchedFlame)
  assert.equal(world.weaponLoadout.equipped[2], untouchedThird)
  assert.equal(untouchedFlame.cooldownRemainingMs, 52)
  assert.equal(untouchedThird.cooldownRemainingMs, 33)
  assert.equal(
    world.weaponLoadout.equipped.some(({ id }) => id === replacedWeapon.id),
    false,
  )
  assert.equal(world.projectiles.includes(inFlightProjectile), true)
  assert.equal(inFlightProjectile.sourceWeaponInstanceId, replacedWeapon.id)
})

test('replacing an orbit weapon immediately destroys its attached attack state', () => {
  const baseContent = prepareGameContent()
  const incomingWeapon = createTestWeapon(
    baseContent.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID],
    'weapon.test-orbit-replacement',
  )
  const content = extendWeapons(baseContent, [incomingWeapon])
  const world = createWorldState(
    'orbit-replacement-cleanup',
    800,
    600,
    content,
    ORBIT_ENERGY_BALL_WEAPON_ID,
    content.weaponDefinitions.map(({ id }) => id),
  )
  const orbitWeapon = world.weaponLoadout.equipped[0]
  equipWeapon(
    world.weaponLoadout,
    content.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID],
  )
  equipWeapon(
    world.weaponLoadout,
    content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
  )
  runOrbitWeaponSystem(world, 0)
  const [attachedOrbit] = world.orbitAttacks
  attachedOrbit.contactStateByOwner.set(99, {
    wasOverlapping: true,
    isOverlapping: true,
    pendingAttackEventId: null,
    nextContinuousHitTimeMs: 200,
  })
  const command = prepareWeaponOffer(
    world,
    incomingWeapon,
    'offer-replace-orbit',
  )

  const result = acquireWeaponFromOffer(world, {
    ...command,
    replacedWeaponInstanceId: orbitWeapon.id,
  })

  assert.equal(result.ok, true)
  assert.equal(world.orbitAttacks.length, 0)
  assert.equal(attachedOrbit.contactStateByOwner.size, 0)
})

test('rejects an invalid full-loadout replacement target atomically', () => {
  const baseContent = prepareGameContent()
  const template = baseContent.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID]
  const thirdWeapon = createTestWeapon(template, 'weapon.test-third-invalid')
  const incomingWeapon = createTestWeapon(template, 'weapon.test-incoming-invalid')
  const content = extendWeapons(baseContent, [thirdWeapon, incomingWeapon])
  const world = createWorldState(
    'weapon-invalid-replacement',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
    content.weaponDefinitions.map(({ id }) => id),
  )
  equipWeapon(
    world.weaponLoadout,
    content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
  )
  equipWeapon(world.weaponLoadout, thirdWeapon)
  const beforeInstances: readonly WeaponInstance[] = [
    ...world.weaponLoadout.equipped,
  ]
  const command = prepareWeaponOffer(
    world,
    incomingWeapon,
    'offer-invalid-replacement',
  )

  const result = acquireWeaponFromOffer(world, {
    ...command,
    replacedWeaponInstanceId: 999_999,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /no longer equipped/)
  assert.deepEqual(world.weaponLoadout.equipped, beforeInstances)
  assert.equal(world.upgradeState.pendingUpgradeCount, 1)
  assert.equal(world.upgradeState.activeOffer?.id, command.offerId)
})

test('creates the next queued offer after acquiring a weapon', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'weapon-acquire-queued',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const command = prepareWeaponOffer(
    world,
    content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
    'offer-queued-acquisition',
    2,
  )

  const result = acquireWeaponFromOffer(world, command)

  assert.equal(result.ok, true)
  assert.equal(world.upgradeState.pendingUpgradeCount, 1)
  assert.ok(world.upgradeState.activeOffer)
  assert.notEqual(world.upgradeState.activeOffer.id, command.offerId)
  assert.equal(result.ok && result.nextOffer, world.upgradeState.activeOffer)
})
