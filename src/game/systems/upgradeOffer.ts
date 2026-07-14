import type { PreparedGameContent } from '../content/gameContent.ts'
import {
  MODULE_EFFECT_KIND,
  type WeaponModuleDefinition,
} from '../content/upgrades/moduleDefinition.ts'
import type { WeaponDefinition } from '../content/weapons/weaponDefinition.ts'
import type {
  UpgradeChoiceReference,
  UpgradeOffer,
  UpgradeRankPreview,
  UpgradeState,
} from '../runtime/upgradeState.ts'
import type { WeaponLoadoutState } from '../runtime/weaponLoadout.ts'
import { canWeaponAcceptModule } from './modulePlacement.ts'
import { createRangeWeaponTargetPreviews } from './rangeUpgradePreview.ts'

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

function createModuleRankPreviews(
  definition: WeaponModuleDefinition,
): readonly Readonly<UpgradeRankPreview>[] {
  if (definition.effectKind === MODULE_EFFECT_KIND.DAMAGE_SPREAD) {
    return Object.freeze(
      definition.ranks.map((rank) =>
        Object.freeze({
          rank: rank.rank,
          summary: rank.bandDamageRatios
            .map((ratio) => `${Number((ratio * 100).toFixed(2))}%`)
            .join(' / '),
        }),
      ),
    )
  }
  if (definition.effectKind === MODULE_EFFECT_KIND.PROJECTILE_COUNT) {
    return Object.freeze(
      definition.ranks.map((rank) =>
        Object.freeze({
          rank: rank.rank,
          summary: `${rank.totalCount} emissions`,
        }),
      ),
    )
  }
  return Object.freeze(
    definition.ranks.map((rank) =>
      Object.freeze({
        rank: rank.rank,
        summary: `×${rank.totalMultiplier}`,
      }),
    ),
  )
}

function moduleChoice(
  definition: WeaponModuleDefinition,
  content: PreparedGameContent,
  loadout: WeaponLoadoutState,
): UpgradeChoiceReference {
  return {
    id: '',
    kind: 'MODULE',
    definitionId: definition.id,
    title: definition.title,
    description: definition.description,
    rankPreviews: createModuleRankPreviews(definition),
    weaponTargetPreviews:
      definition.effectKind === MODULE_EFFECT_KIND.RANGE
        ? createRangeWeaponTargetPreviews(
            content,
            loadout,
            definition,
          )
        : undefined,
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
    choices.push(
      moduleChoice(
        chooseAndRemove(eligibleModules, state.rng.next()),
        content,
        loadout,
      ),
    )
    choices.push(
      moduleChoice(
        chooseAndRemove(eligibleModules, state.rng.next()),
        content,
        loadout,
      ),
    )
  } else {
    const pool = [
      ...eligibleWeapons.map(weaponChoice),
      ...eligibleModules.map((definition) =>
        moduleChoice(definition, content, loadout),
      ),
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
