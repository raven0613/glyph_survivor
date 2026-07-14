import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createUiSnapshot,
} from '../../src/game/bridge/uiSnapshot.ts'
import {
  getWeaponDefinition,
  prepareGameContent,
  type PreparedGameContent,
} from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { defineWeapon } from '../../src/game/content/weapons/weaponDefinition.ts'
import {
  getUnlockedInitialWeaponDefinition,
  prepareRunWeaponUnlocks,
  requireEligibleFirstOfferWeapon,
} from '../../src/game/host/runWeaponUnlocks.ts'

const READY_MACHINE_SNAPSHOT = {
  value: 'READY',
  context: {
    seed: null,
    upgradeChoices: [],
    pendingUpgradeCount: 0,
    activeUpgradeOfferId: null,
    recoverableError: null,
  },
} as const

function prepareContentWithLockedWeapon(): PreparedGameContent {
  const content = prepareGameContent()
  const baseWeapon = getWeaponDefinition(
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const lockedWeapon = defineWeapon({
    ...baseWeapon,
    id: 'weapon.test-locked',
    title: 'Locked test weapon',
  })

  return Object.freeze({
    ...content,
    weaponDefinitions: Object.freeze([
      ...content.weaponDefinitions,
      lockedWeapon,
    ]),
    weaponDefinitionsById: Object.freeze({
      ...content.weaponDefinitionsById,
      [lockedWeapon.id]: lockedWeapon,
    }),
  })
}

test('freezes a copied run unlock set and derives UI-sized weapon summaries', () => {
  const content = prepareGameContent()
  const mutableUnlockIds: string[] = [BASIC_PROJECTILE_WEAPON_ID]
  const unlocks = prepareRunWeaponUnlocks(content, mutableUnlockIds)

  mutableUnlockIds[0] = 'weapon.mutated-after-prepare'
  mutableUnlockIds.push('weapon.extra')

  assert.deepEqual(unlocks.definitionIds, [BASIC_PROJECTILE_WEAPON_ID])
  assert.deepEqual(unlocks.initialWeaponChoices, [
    {
      definitionId: BASIC_PROJECTILE_WEAPON_ID,
      title: 'Assisted o',
      description: 'Fires a small projectile with limited aim correction.',
      identityGlyph: 'o',
        moduleSlotCount: 4,
    },
  ])
  assert.equal(Object.isFrozen(unlocks), true)
  assert.equal(Object.isFrozen(unlocks.definitionIds), true)
  assert.equal(Object.isFrozen(unlocks.initialWeaponChoices), true)
  assert.equal(Object.isFrozen(unlocks.initialWeaponChoices[0]), true)
})

test('rejects invalid unlock snapshots instead of silently normalizing them', () => {
  const content = prepareGameContent()

  assert.throws(() => prepareRunWeaponUnlocks(content, []), /at least one/i)
  assert.throws(
    () =>
      prepareRunWeaponUnlocks(content, [
        BASIC_PROJECTILE_WEAPON_ID,
        BASIC_PROJECTILE_WEAPON_ID,
      ]),
    /duplicate/i,
  )
  assert.throws(
    () => prepareRunWeaponUnlocks(content, ['weapon.unknown']),
    /unknown weapon definition/i,
  )
  assert.throws(
    () => prepareRunWeaponUnlocks(content, ['   ']),
    /non-empty string/i,
  )
})

test('accepts exactly an unlocked initial weapon and rejects locked selections', () => {
  const content = prepareContentWithLockedWeapon()
  const unlocks = prepareRunWeaponUnlocks(content, [
    BASIC_PROJECTILE_WEAPON_ID,
  ])

  assert.equal(
    getUnlockedInitialWeaponDefinition(
      content,
      unlocks,
      BASIC_PROJECTILE_WEAPON_ID,
    ).id,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  assert.throws(
    () =>
      getUnlockedInitialWeaponDefinition(
        content,
        unlocks,
        'weapon.test-locked',
      ),
    /not unlocked/i,
  )
  assert.throws(
    () => getUnlockedInitialWeaponDefinition(content, unlocks, ''),
    /non-empty string/i,
  )
})

test('copies and freezes initial weapon choices at the UI boundary', () => {
  const mutableChoices: Array<{
    definitionId: string
    title: string
    description: string
    identityGlyph: string
    moduleSlotCount: number
  }> = [
    {
      definitionId: BASIC_PROJECTILE_WEAPON_ID,
      title: 'Assisted o',
      description: 'Original description',
      identityGlyph: 'o',
      moduleSlotCount: 3,
    },
  ]
  const snapshot = createUiSnapshot(
    READY_MACHINE_SNAPSHOT,
    undefined,
    mutableChoices,
  )

  mutableChoices[0].title = 'Mutated externally'
  mutableChoices.push({
    definitionId: 'weapon.extra',
    title: 'Extra',
    description: 'Extra',
    identityGlyph: 'x',
    moduleSlotCount: 1,
  })

  assert.equal(snapshot.initialWeaponChoices.length, 1)
  assert.equal(snapshot.initialWeaponChoices[0].title, 'Assisted o')
  assert.equal(Object.isFrozen(snapshot), true)
  assert.equal(Object.isFrozen(snapshot.initialWeaponChoices), true)
  assert.equal(Object.isFrozen(snapshot.initialWeaponChoices[0]), true)
})

test('rejects a run that cannot satisfy the first weapon-card guarantee', () => {
  const content = prepareGameContent()
  const unlocks = prepareRunWeaponUnlocks(content, [BASIC_PROJECTILE_WEAPON_ID])

  assert.throws(
    () => requireEligibleFirstOfferWeapon(unlocks, BASIC_PROJECTILE_WEAPON_ID),
    /first upgrade offer/,
  )
})
