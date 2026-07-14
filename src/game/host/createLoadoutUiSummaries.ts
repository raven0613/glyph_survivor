import type { UiEquippedWeapon } from '../bridge/uiSnapshot.ts'
import {
  getWeaponDefinition,
  getWeaponModuleDefinition,
  type PreparedGameContent,
} from '../content/gameContent.ts'
import type { WeaponLoadoutState } from '../runtime/weaponLoadout.ts'

export function createLoadoutUiSummaries(
  content: PreparedGameContent,
  loadout: WeaponLoadoutState,
): readonly Readonly<UiEquippedWeapon>[] {
  return Object.freeze(
    loadout.equipped.map((weapon) => {
      const definition = getWeaponDefinition(content, weapon.definitionId)
      return Object.freeze({
        instanceId: weapon.id,
        definitionId: weapon.definitionId,
        title: definition.title,
        identityGlyph: definition.identityGlyph,
        profileRevision: weapon.profileRevision,
        moduleSlots: Object.freeze(
          weapon.moduleSlots.map((slot, slotIndex) => {
            if (!slot) {
              return null
            }
            const moduleDefinition = getWeaponModuleDefinition(
              content,
              slot.moduleDefinitionId,
            )
            return Object.freeze({
              slotIndex,
              moduleDefinitionId: moduleDefinition.id,
              title: moduleDefinition.title,
              rank: slot.rank,
              maximumRank: moduleDefinition.ranks.length,
            })
          }),
        ),
      })
    }),
  )
}
