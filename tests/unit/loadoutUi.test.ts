import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { createLoadoutUiSummaries } from '../../src/game/host/createLoadoutUiSummaries.ts'
import { createWorldState } from '../../src/game/runtime/worldState.ts'

test('copies equipped weapon and ordered Module Slot summaries for React', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'loadout-ui',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const weapon = world.weaponLoadout.equipped[0]
  weapon.moduleSlots[0] = {
    moduleDefinitionId: 'module.attack-speed',
    rank: 2,
  }

  const summaries = createLoadoutUiSummaries(
    content,
    world.weaponLoadout,
  )
  weapon.moduleSlots[0] = null

  assert.equal(Object.isFrozen(summaries), true)
  assert.deepEqual(summaries, [
    {
      instanceId: weapon.id,
      definitionId: BASIC_PROJECTILE_WEAPON_ID,
      title: 'Assisted o',
      identityGlyph: 'o',
      profileRevision: 0,
      moduleSlots: [
        {
          slotIndex: 0,
          moduleDefinitionId: 'module.attack-speed',
          title: 'Attack Speed',
          rank: 2,
          maximumRank: 3,
        },
        null,
        null,
        null,
      ],
    },
  ])
  assert.equal(Object.isFrozen(summaries[0].moduleSlots), true)
  assert.equal(Object.isFrozen(summaries[0].moduleSlots[0]), true)
})
