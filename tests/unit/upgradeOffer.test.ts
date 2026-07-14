import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { FLAMETHROWER_WEAPON_ID } from '../../src/game/content/weapons/flamethrowerWeapon.ts'
import { ORBIT_ENERGY_BALL_WEAPON_ID } from '../../src/game/content/weapons/orbitEnergyBallWeapon.ts'
import { createSeededRng } from '../../src/game/core/seededRng.ts'
import { createUpgradeState } from '../../src/game/runtime/upgradeState.ts'
import { createWeaponLoadout, equipWeapon } from '../../src/game/runtime/weaponLoadout.ts'
import { generateUpgradeOffer } from '../../src/game/systems/upgradeOffer.ts'

test('first offer guarantees one unequipped unlocked weapon and two unique modules', () => {
  const content = prepareGameContent()
  const loadout = createWeaponLoadout(content.maximumEquippedWeapons)
  equipWeapon(loadout, content.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID])
  const state = createUpgradeState('offer-seed', content.weaponDefinitions.map(({ id }) => id))

  const offer = generateUpgradeOffer(content, loadout, state)

  assert.equal(offer.choices.length, 3)
  assert.equal(offer.choices.filter(({ kind }) => kind === 'WEAPON').length, 1)
  assert.equal(offer.choices.filter(({ kind }) => kind === 'MODULE').length, 2)
  assert.equal(new Set(offer.choices.map(({ definitionId }) => definitionId)).size, 3)
})

test('upgrade sequence is isolated from the gameplay RNG stream', () => {
  const content = prepareGameContent()
  const createOffer = (consumeGameplayRng: boolean) => {
    const loadout = createWeaponLoadout(content.maximumEquippedWeapons)
    equipWeapon(loadout, content.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID])
    const gameplayRng = createSeededRng('same-run')
    if (consumeGameplayRng) {
      gameplayRng.next()
      gameplayRng.next()
    }
    return generateUpgradeOffer(
      content,
      loadout,
      createUpgradeState('same-run', content.weaponDefinitions.map(({ id }) => id)),
    )
  }

  assert.deepEqual(createOffer(false), createOffer(true))
})

test('includes Runtime-authored Rank effect previews on Module cards', () => {
  const content = prepareGameContent()
  let spreadChoice:
    | ReturnType<typeof generateUpgradeOffer>['choices'][number]
    | undefined

  for (let seed = 0; seed < 16 && !spreadChoice; seed += 1) {
    const loadout = createWeaponLoadout(content.maximumEquippedWeapons)
    equipWeapon(
      loadout,
      content.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID],
    )
    const state = createUpgradeState(
      `rank-preview-${seed}`,
      content.weaponDefinitions.map(({ id }) => id),
    )
    spreadChoice = generateUpgradeOffer(content, loadout, state).choices.find(
      ({ definitionId }) => definitionId === 'module.damage-spread',
    )
  }

  assert.deepEqual(spreadChoice?.rankPreviews, [
    { rank: 1, summary: '20%' },
    { rank: 2, summary: '20% / 10%' },
    { rank: 3, summary: '20% / 10% / 5%' },
  ])
  assert.equal(Object.isFrozen(spreadChoice?.rankPreviews), true)
})

test('previews Projectile Count Ranks as complete emission totals', () => {
  const content = prepareGameContent()
  let countChoice:
    | ReturnType<typeof generateUpgradeOffer>['choices'][number]
    | undefined

  for (let seed = 0; seed < 32 && !countChoice; seed += 1) {
    const loadout = createWeaponLoadout(content.maximumEquippedWeapons)
    equipWeapon(
      loadout,
      content.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID],
    )
    const state = createUpgradeState(
      `count-preview-${seed}`,
      content.weaponDefinitions.map(({ id }) => id),
    )
    countChoice = generateUpgradeOffer(content, loadout, state).choices.find(
      ({ definitionId }) => definitionId === 'module.projectile-count',
    )
  }

  assert.deepEqual(countChoice?.rankPreviews, [
    { rank: 1, summary: '2 emissions' },
    { rank: 2, summary: '3 emissions' },
    { rank: 3, summary: '4 emissions' },
  ])
})

test('publishes Runtime-authored Range previews for every weapon target', () => {
  const content = prepareGameContent()
  const loadout = createWeaponLoadout(content.maximumEquippedWeapons)
  equipWeapon(
    loadout,
    content.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID],
  )
  equipWeapon(
    loadout,
    content.weaponDefinitionsById[FLAMETHROWER_WEAPON_ID],
  )
  equipWeapon(
    loadout,
    content.weaponDefinitionsById[ORBIT_ENERGY_BALL_WEAPON_ID],
  )
  let rangeChoice:
    | ReturnType<typeof generateUpgradeOffer>['choices'][number]
    | undefined

  for (let seed = 0; seed < 64 && !rangeChoice; seed += 1) {
    const state = createUpgradeState(
      `range-preview-${seed}`,
      content.weaponDefinitions.map(({ id }) => id),
    )
    state.offerSequence = 1
    rangeChoice = generateUpgradeOffer(content, loadout, state).choices.find(
      ({ definitionId }) => definitionId === 'module.range',
    )
  }

  assert.deepEqual(rangeChoice?.weaponTargetPreviews, [
    {
      weaponInstanceId: loadout.equipped[0].id,
      summary: 'Target 700 → 805 / Travel 1116 → 1283',
    },
    {
      weaponInstanceId: loadout.equipped[1].id,
      summary: 'Cone 160 → 184',
    },
    {
      weaponInstanceId: loadout.equipped[2].id,
      summary: 'Sweep 80 → 80–92',
    },
  ])
  assert.equal(Object.isFrozen(rangeChoice?.weaponTargetPreviews), true)
  assert.equal(Object.isFrozen(rangeChoice?.weaponTargetPreviews?.[0]), true)
})

test('previews a Range rank-up from current reach to the next complete Rank', () => {
  const content = prepareGameContent()
  const loadout = createWeaponLoadout(content.maximumEquippedWeapons)
  const weapon = equipWeapon(
    loadout,
    content.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID],
  )
  weapon.moduleSlots[0] = {
    moduleDefinitionId: 'module.range',
    rank: 1,
  }
  let rangeChoice:
    | ReturnType<typeof generateUpgradeOffer>['choices'][number]
    | undefined

  for (let seed = 0; seed < 64 && !rangeChoice; seed += 1) {
    const state = createUpgradeState(
      `range-rank-up-preview-${seed}`,
      content.weaponDefinitions.map(({ id }) => id),
    )
    state.offerSequence = 1
    rangeChoice = generateUpgradeOffer(content, loadout, state).choices.find(
      ({ definitionId }) => definitionId === 'module.range',
    )
  }

  assert.deepEqual(rangeChoice?.weaponTargetPreviews, [
    {
      weaponInstanceId: weapon.id,
      summary: 'Target 805 → 910 / Travel 1283 → 1451',
    },
  ])
})

test('does not offer a max-Rank module when no equipped weapon can accept it', () => {
  const content = prepareGameContent()
  const loadout = createWeaponLoadout(content.maximumEquippedWeapons)
  const weapon = equipWeapon(
    loadout,
    content.weaponDefinitionsById[BASIC_PROJECTILE_WEAPON_ID],
  )
  weapon.moduleSlots[0] = {
    moduleDefinitionId: 'module.attack-speed',
    rank: 3,
  }
  for (let seed = 0; seed < 32; seed += 1) {
    const state = createUpgradeState(
      `eligible-module-${seed}`,
      content.weaponDefinitions.map(({ id }) => id),
    )
    state.offerSequence = 1
    const offer = generateUpgradeOffer(content, loadout, state)
    assert.equal(
      offer.choices.some(
        ({ definitionId }) => definitionId === 'module.attack-speed',
      ),
      false,
    )
  }
})
