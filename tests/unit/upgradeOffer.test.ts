import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
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
