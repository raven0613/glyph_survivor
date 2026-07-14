import type { PreparedGameContent } from '../content/gameContent.ts'
import type { RangeWeaponModuleDefinition } from '../content/upgrades/moduleDefinition.ts'
import type { UpgradeWeaponTargetPreview } from '../runtime/upgradeState.ts'
import type {
  WeaponInstance,
  WeaponLoadoutState,
  WeaponModuleSlot,
} from '../runtime/weaponLoadout.ts'
import { resolveWeaponProfile } from './resolveWeaponProfile.ts'

function getNextRangeSlots(
  weapon: WeaponInstance,
  definition: RangeWeaponModuleDefinition,
): WeaponModuleSlot[] | null {
  const slots = weapon.moduleSlots.slice()
  const matchingIndex = slots.findIndex(
    (slot) => slot?.moduleDefinitionId === definition.id,
  )
  if (matchingIndex >= 0) {
    const matchingSlot = slots[matchingIndex]
    if (!matchingSlot || matchingSlot.rank >= definition.ranks.length) {
      return null
    }
    slots[matchingIndex] = Object.freeze({
      moduleDefinitionId: definition.id,
      rank: matchingSlot.rank + 1,
    })
    return slots
  }

  const emptyIndex = slots.indexOf(null)
  const targetIndex = emptyIndex >= 0 ? emptyIndex : 0
  slots[targetIndex] = Object.freeze({
    moduleDefinitionId: definition.id,
    rank: 1,
  })
  return slots
}

function formatReach(value: number): string {
  return String(Math.round(value))
}

function formatSweep(baseRadius: number, maximumRadius: number): string {
  const base = formatReach(baseRadius)
  return Math.abs(maximumRadius - baseRadius) < 1e-9
    ? base
    : `${base}–${formatReach(maximumRadius)}`
}

function summarizeRangeChange(
  before: ReturnType<typeof resolveWeaponProfile>,
  after: ReturnType<typeof resolveWeaponProfile>,
): string {
  if (
    before.targetStrategyId === 'AIM_ASSISTED' &&
    after.targetStrategyId === 'AIM_ASSISTED'
  ) {
    return `Target ${formatReach(before.trackingProfile.range)} → ${formatReach(after.trackingProfile.range)} / Travel ${formatReach(before.attackPattern.maximumTravelDistance)} → ${formatReach(after.attackPattern.maximumTravelDistance)}`
  }
  if (
    before.targetStrategyId === 'PLAYER_AIM' &&
    after.targetStrategyId === 'PLAYER_AIM'
  ) {
    return `Cone ${formatReach(before.damageShape.range)} → ${formatReach(after.damageShape.range)}`
  }
  if (
    before.targetStrategyId === 'OWNER_RELATIVE' &&
    after.targetStrategyId === 'OWNER_RELATIVE'
  ) {
    return `Sweep ${formatSweep(before.attackPattern.orbitRadius, before.attackPattern.maximumOrbitRadius)} → ${formatSweep(after.attackPattern.orbitRadius, after.attackPattern.maximumOrbitRadius)}`
  }
  throw new TypeError('Range preview profiles must use the same weapon pattern.')
}

export function createRangeWeaponTargetPreviews(
  content: PreparedGameContent,
  loadout: WeaponLoadoutState,
  definition: RangeWeaponModuleDefinition,
): readonly Readonly<UpgradeWeaponTargetPreview>[] {
  const previews: UpgradeWeaponTargetPreview[] = []
  for (const weapon of loadout.equipped) {
    const nextSlots = getNextRangeSlots(weapon, definition)
    if (!nextSlots) {
      continue
    }
    const weaponDefinition = content.weaponDefinitionsById[weapon.definitionId]
    if (!weaponDefinition) {
      throw new Error(`Unknown weapon definition ${weapon.definitionId}.`)
    }
    const before = resolveWeaponProfile(
      weaponDefinition,
      weapon.moduleSlots,
      content.weaponModuleDefinitionsById,
    )
    const after = resolveWeaponProfile(
      weaponDefinition,
      nextSlots,
      content.weaponModuleDefinitionsById,
    )
    previews.push(
      Object.freeze({
        weaponInstanceId: weapon.id,
        summary: summarizeRangeChange(before, after),
      }),
    )
  }
  return Object.freeze(previews)
}
