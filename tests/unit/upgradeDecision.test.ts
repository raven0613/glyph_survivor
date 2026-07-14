import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  UiEquippedWeapon,
  UiUpgradeChoice,
} from '../../src/game/bridge/uiSnapshot.ts'
import {
  EMPTY_UPGRADE_SELECTION,
  resolveUpgradeDecision,
  selectUpgradeChoice,
  selectUpgradeSlot,
  selectUpgradeWeapon,
  stepBackUpgradeSelection,
} from '../../src/app/screens/upgradeDecision.ts'

const WEAPON_CHOICE: UiUpgradeChoice = {
  id: 'offer-1:weapon',
  kind: 'WEAPON',
  definitionId: 'weapon.flamethrower',
  title: 'Flamethrower',
  description: 'A short range cone.',
}

const MODULE_CHOICE: UiUpgradeChoice = {
  id: 'offer-1:module',
  kind: 'MODULE',
  definitionId: 'module.attack-speed',
  title: 'Attack Speed',
  description: 'Compile a faster cadence.',
}

function createWeapon(
  instanceId: number,
  moduleSlots: UiEquippedWeapon['moduleSlots'] = [null, null, null, null],
): UiEquippedWeapon {
  return {
    instanceId,
    definitionId: `weapon.test-${instanceId}`,
    title: `Weapon ${instanceId}`,
    identityGlyph: String(instanceId),
    profileRevision: 0,
    moduleSlots,
  }
}

function resolve(
  choices: readonly UiUpgradeChoice[],
  weapons: readonly UiEquippedWeapon[],
  selection = EMPTY_UPGRADE_SELECTION,
) {
  return resolveUpgradeDecision(
    {
      offerId: 'offer-1',
      choices,
      equippedWeapons: weapons,
      maximumEquippedWeapons: 3,
    },
    selection,
  )
}

test('readies a new weapon immediately when the loadout has an open position', () => {
  const selection = selectUpgradeChoice(
    EMPTY_UPGRADE_SELECTION,
    WEAPON_CHOICE.id,
  )

  const decision = resolve([WEAPON_CHOICE], [createWeapon(1)], selection)

  assert.equal(decision.stage, 'CONFIRM')
  assert.deepEqual(decision.command, {
    kind: 'WEAPON',
    offerId: 'offer-1',
    choiceId: WEAPON_CHOICE.id,
  })
  assert.equal(decision.operation?.kind, 'ACQUIRE_WEAPON')
})

test('requires a replacement target at the weapon limit and preserves back navigation', () => {
  const weapons = [createWeapon(1), createWeapon(2), createWeapon(3)]
  const cardSelection = selectUpgradeChoice(
    EMPTY_UPGRADE_SELECTION,
    WEAPON_CHOICE.id,
  )

  assert.equal(resolve([WEAPON_CHOICE], weapons, cardSelection).stage, 'WEAPON')

  const targetSelection = selectUpgradeWeapon(cardSelection, 2)
  const decision = resolve([WEAPON_CHOICE], weapons, targetSelection)
  assert.equal(decision.stage, 'CONFIRM')
  assert.deepEqual(decision.command, {
    kind: 'WEAPON',
    offerId: 'offer-1',
    choiceId: WEAPON_CHOICE.id,
    replacedWeaponInstanceId: 2,
  })
  assert.equal(decision.operation?.kind, 'REPLACE_WEAPON')
  assert.deepEqual(stepBackUpgradeSelection(targetSelection), cardSelection)
})

test('previews a matching Module rank-up without asking for a Slot', () => {
  const weapon = createWeapon(1, [
    {
      slotIndex: 0,
      moduleDefinitionId: MODULE_CHOICE.definitionId,
      title: 'Attack Speed',
      rank: 2,
      maximumRank: 3,
    },
    null,
    null,
    null,
  ])
  const cardSelection = selectUpgradeChoice(
    EMPTY_UPGRADE_SELECTION,
    MODULE_CHOICE.id,
  )
  const targetSelection = selectUpgradeWeapon(cardSelection, weapon.instanceId)

  const decision = resolve([MODULE_CHOICE], [weapon], targetSelection)

  assert.equal(decision.stage, 'CONFIRM')
  assert.deepEqual(decision.operation, {
    kind: 'RANK_UP_MODULE',
    weapon,
    slotIndex: 0,
    rankBefore: 2,
    rankAfter: 3,
  })
  assert.deepEqual(decision.command, {
    kind: 'MODULE',
    offerId: 'offer-1',
    choiceId: MODULE_CHOICE.id,
    weaponInstanceId: weapon.instanceId,
  })
})

test('disables a weapon whose matching Module is already at maximum Rank', () => {
  const weapon = createWeapon(1, [
    {
      slotIndex: 0,
      moduleDefinitionId: MODULE_CHOICE.definitionId,
      title: 'Attack Speed',
      rank: 3,
      maximumRank: 3,
    },
    null,
    null,
    null,
  ])
  const cardSelection = selectUpgradeChoice(
    EMPTY_UPGRADE_SELECTION,
    MODULE_CHOICE.id,
  )
  const optionsDecision = resolve([MODULE_CHOICE], [weapon], cardSelection)

  assert.equal(optionsDecision.weaponOptions[0].disabled, true)
  assert.match(optionsDecision.weaponOptions[0].disabledReason ?? '', /maximum Rank/)

  const invalidTarget = selectUpgradeWeapon(cardSelection, weapon.instanceId)
  const decision = resolve([MODULE_CHOICE], [weapon], invalidTarget)
  assert.equal(decision.stage, 'WEAPON')
  assert.equal(decision.command, null)
})

test('requires an explicit occupied Slot before replacing a Module', () => {
  const weapon = createWeapon(1, [
    {
      slotIndex: 0,
      moduleDefinitionId: 'module.damage-spread',
      title: 'Damage Spread',
      rank: 2,
      maximumRank: 3,
    },
    {
      slotIndex: 1,
      moduleDefinitionId: 'module.knockback',
      title: 'Knockback',
      rank: 1,
      maximumRank: 3,
    },
    {
      slotIndex: 2,
      moduleDefinitionId: 'module.duration',
      title: 'Duration',
      rank: 1,
      maximumRank: 3,
    },
    {
      slotIndex: 3,
      moduleDefinitionId: 'module.range',
      title: 'Range',
      rank: 1,
      maximumRank: 3,
    },
  ])
  const targetSelection = selectUpgradeWeapon(
    selectUpgradeChoice(EMPTY_UPGRADE_SELECTION, MODULE_CHOICE.id),
    weapon.instanceId,
  )

  assert.equal(resolve([MODULE_CHOICE], [weapon], targetSelection).stage, 'SLOT')

  const slotSelection = selectUpgradeSlot(targetSelection, 1)
  const decision = resolve([MODULE_CHOICE], [weapon], slotSelection)
  assert.equal(decision.stage, 'CONFIRM')
  assert.equal(decision.operation?.kind, 'REPLACE_MODULE')
  assert.deepEqual(decision.command, {
    kind: 'MODULE',
    offerId: 'offer-1',
    choiceId: MODULE_CHOICE.id,
    weaponInstanceId: weapon.instanceId,
    replacedSlotIndex: 1,
  })
  assert.deepEqual(stepBackUpgradeSelection(slotSelection), targetSelection)
})

test('selecting a different card clears its previous weapon and Slot targets', () => {
  const previousSelection = selectUpgradeSlot(
    selectUpgradeWeapon(
      selectUpgradeChoice(EMPTY_UPGRADE_SELECTION, MODULE_CHOICE.id),
      1,
    ),
    2,
  )

  assert.deepEqual(
    selectUpgradeChoice(previousSelection, WEAPON_CHOICE.id),
    {
      choiceId: WEAPON_CHOICE.id,
      weaponInstanceId: null,
      replacedSlotIndex: null,
    },
  )
})
