import type { PreparedGameContent } from '../content/gameContent.ts'
import type { WeaponModuleDefinition } from '../content/upgrades/moduleDefinition.ts'
import type { WeaponDefinition } from '../content/weapons/weaponDefinition.ts'
import type {
  UpgradeChoiceReference,
  UpgradeOffer,
  UpgradeState,
} from '../runtime/upgradeState.ts'
import type { WeaponLoadoutState } from '../runtime/weaponLoadout.ts'
import { canWeaponAcceptModule } from './modulePlacement.ts'

function chooseAndRemove<T>(values: T[], randomValue: number): T {
  const index = Math.min(values.length - 1, Math.floor(randomValue * values.length))
  return values.splice(index, 1)[0]
}

function weaponChoice(definition: WeaponDefinition): UpgradeChoiceReference {
  return {
    id: '',
    kind: 'WEAPON',
    definitionId: definition.id,
    title: definition.title,
    description: definition.description,
  }
}

function moduleChoice(
  definition: WeaponModuleDefinition,
): UpgradeChoiceReference {
  return {
    id: '',
    kind: 'MODULE',
    definitionId: definition.id,
    title: definition.title,
    description: definition.description,
  }
}

function getEligibleWeapons(
  content: PreparedGameContent,
  loadout: WeaponLoadoutState,
  state: UpgradeState,
): WeaponDefinition[] {
  const equippedIds = new Set(loadout.equipped.map(({ definitionId }) => definitionId))
  return state.unlockedWeaponDefinitionIds
    .map((id) => content.weaponDefinitionsById[id])
    .filter((definition): definition is WeaponDefinition =>
      definition !== undefined && !equippedIds.has(definition.id),
    )
}

function getEligibleModules(
  content: PreparedGameContent,
  loadout: WeaponLoadoutState,
): WeaponModuleDefinition[] {
  return content.weaponModuleDefinitions.filter((module) =>
    loadout.equipped.some((weapon) =>
      canWeaponAcceptModule(weapon, module),
    ),
  )
}

export function getUpgradeOfferGenerationError(
  content: PreparedGameContent,
  loadout: WeaponLoadoutState,
  state: UpgradeState,
): string | null {
  const eligibleWeapons = getEligibleWeapons(content, loadout, state)
  const eligibleModules = getEligibleModules(content, loadout)
  if (state.offerSequence === 0) {
    return eligibleWeapons.length === 0 || eligibleModules.length < 2
      ? 'First upgrade offer requires one weapon and two modules.'
      : null
  }
  return eligibleWeapons.length + eligibleModules.length < 3
    ? 'Upgrade pool must contain at least three unique choices.'
    : null
}

/** Generates exactly one deterministic UI-sized offer from the upgrade RNG. */
export function generateUpgradeOffer(
  content: PreparedGameContent,
  loadout: WeaponLoadoutState,
  state: UpgradeState,
): Readonly<UpgradeOffer> {
  const choices: UpgradeChoiceReference[] = []
  const eligibleWeapons = getEligibleWeapons(content, loadout, state)
  const eligibleModules = getEligibleModules(content, loadout)
  const generationError = getUpgradeOfferGenerationError(
    content,
    loadout,
    state,
  )
  if (generationError) {
    throw new Error(generationError)
  }

  if (state.offerSequence === 0) {
    choices.push(weaponChoice(chooseAndRemove(eligibleWeapons, state.rng.next())))
    choices.push(moduleChoice(chooseAndRemove(eligibleModules, state.rng.next())))
    choices.push(moduleChoice(chooseAndRemove(eligibleModules, state.rng.next())))
  } else {
    const pool = [
      ...eligibleWeapons.map(weaponChoice),
      ...eligibleModules.map(moduleChoice),
    ]
    while (choices.length < 3) {
      choices.push(chooseAndRemove(pool, state.rng.next()))
    }
  }

  const offerId = `upgrade-offer-${state.nextOfferId}`
  const sequence = state.offerSequence
  state.nextOfferId += 1
  state.offerSequence += 1
  return Object.freeze({
    id: offerId,
    sequence,
    choices: Object.freeze(
      choices.map((choice, index) =>
        Object.freeze({ ...choice, id: `${offerId}:${index}` }),
      ),
    ),
  })
}
