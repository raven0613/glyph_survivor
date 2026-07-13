import type { UiInitialWeaponChoice } from '../bridge/uiSnapshot.ts'
import {
  getWeaponDefinition,
  type PreparedGameContent,
} from '../content/gameContent.ts'
import type { WeaponDefinition } from '../content/weapons/weaponDefinition.ts'

export interface RunWeaponUnlocks {
  readonly definitionIds: readonly string[]
  readonly initialWeaponChoices: readonly Readonly<UiInitialWeaponChoice>[]
}

function requireWeaponDefinitionId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError('Weapon definition ID must be a non-empty string.')
  }

  return value
}

function createInitialWeaponChoice(
  definition: WeaponDefinition,
): Readonly<UiInitialWeaponChoice> {
  return Object.freeze({
    definitionId: definition.id,
    title: definition.title,
    description: definition.description,
    identityGlyph: definition.identityGlyph,
    moduleSlotCount: definition.moduleSlotCount,
  })
}

/** Validates and freezes the permanent unlock snapshot used by one host/run. */
export function prepareRunWeaponUnlocks(
  content: PreparedGameContent,
  unlockedWeaponDefinitionIds: unknown,
): Readonly<RunWeaponUnlocks> {
  if (
    !Array.isArray(unlockedWeaponDefinitionIds) ||
    unlockedWeaponDefinitionIds.length === 0
  ) {
    throw new TypeError(
      'Run weapon unlocks must contain at least one weapon definition ID.',
    )
  }

  const definitionIds = unlockedWeaponDefinitionIds.map((definitionId) =>
    requireWeaponDefinitionId(definitionId),
  )
  if (new Set(definitionIds).size !== definitionIds.length) {
    throw new TypeError('Run weapon unlocks contain a duplicate definition ID.')
  }

  const initialWeaponChoices = definitionIds.map((definitionId) =>
    createInitialWeaponChoice(getWeaponDefinition(content, definitionId)),
  )

  return Object.freeze({
    definitionIds: Object.freeze(definitionIds),
    initialWeaponChoices: Object.freeze(initialWeaponChoices),
  })
}

/** Resolves only definitions admitted by the host's frozen unlock snapshot. */
export function getUnlockedInitialWeaponDefinition(
  content: PreparedGameContent,
  unlocks: Readonly<RunWeaponUnlocks>,
  definitionId: unknown,
): WeaponDefinition {
  const validDefinitionId = requireWeaponDefinitionId(definitionId)
  if (!unlocks.definitionIds.includes(validDefinitionId)) {
    throw new RangeError(
      `Weapon definition ${validDefinitionId} is not unlocked for this run.`,
    )
  }

  return getWeaponDefinition(content, validDefinitionId)
}
