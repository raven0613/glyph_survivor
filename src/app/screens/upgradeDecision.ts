import type {
  UiEquippedWeapon,
  UiUpgradeChoice,
  UiWeaponModuleSlot,
} from '../../game/bridge/uiSnapshot.ts'

export interface UpgradeSelection {
  readonly choiceId: string | null
  readonly weaponInstanceId: number | null
  readonly replacedSlotIndex: number | null
}

export const EMPTY_UPGRADE_SELECTION: Readonly<UpgradeSelection> =
  Object.freeze({
    choiceId: null,
    weaponInstanceId: null,
    replacedSlotIndex: null,
  })

export type UpgradeOperation =
  | { readonly kind: 'ACQUIRE_WEAPON' }
  | {
      readonly kind: 'REPLACE_WEAPON'
      readonly weapon: Readonly<UiEquippedWeapon>
    }
  | {
      readonly kind: 'INSTALL_MODULE'
      readonly weapon: Readonly<UiEquippedWeapon>
      readonly slotIndex: number
    }
  | {
      readonly kind: 'RANK_UP_MODULE'
      readonly weapon: Readonly<UiEquippedWeapon>
      readonly slotIndex: number
      readonly rankBefore: number
      readonly rankAfter: number
    }
  | {
      readonly kind: 'REPLACE_MODULE'
      readonly weapon: Readonly<UiEquippedWeapon>
      readonly slotIndex: number
      readonly replacedSlot: Readonly<UiWeaponModuleSlot>
    }

export type UpgradeCommitCommand =
  | {
      readonly kind: 'WEAPON'
      readonly offerId: string
      readonly choiceId: string
      readonly replacedWeaponInstanceId?: number
    }
  | {
      readonly kind: 'MODULE'
      readonly offerId: string
      readonly choiceId: string
      readonly weaponInstanceId: number
      readonly replacedSlotIndex?: number
    }

export interface UpgradeWeaponOption {
  readonly weapon: Readonly<UiEquippedWeapon>
  readonly disabled: boolean
  readonly disabledReason: string | null
  readonly operation: UpgradeOperation | null
  readonly requiresSlotSelection: boolean
}

export type UpgradeDecisionStage = 'CARD' | 'WEAPON' | 'SLOT' | 'CONFIRM'

export interface UpgradeDecisionInput {
  readonly offerId: string
  readonly choices: readonly Readonly<UiUpgradeChoice>[]
  readonly equippedWeapons: readonly Readonly<UiEquippedWeapon>[]
  readonly maximumEquippedWeapons: number
}

export interface UpgradeDecision {
  readonly stage: UpgradeDecisionStage
  readonly selectedChoice: Readonly<UiUpgradeChoice> | null
  readonly selectedWeapon: Readonly<UiEquippedWeapon> | null
  readonly weaponOptions: readonly UpgradeWeaponOption[]
  readonly operation: UpgradeOperation | null
  readonly command: UpgradeCommitCommand | null
}

export function selectUpgradeChoice(
  selection: Readonly<UpgradeSelection>,
  choiceId: string,
): UpgradeSelection {
  if (selection.choiceId === choiceId) {
    return selection
  }
  return {
    choiceId,
    weaponInstanceId: null,
    replacedSlotIndex: null,
  }
}

export function selectUpgradeWeapon(
  selection: Readonly<UpgradeSelection>,
  weaponInstanceId: number,
): UpgradeSelection {
  return {
    ...selection,
    weaponInstanceId,
    replacedSlotIndex: null,
  }
}

export function selectUpgradeSlot(
  selection: Readonly<UpgradeSelection>,
  replacedSlotIndex: number,
): UpgradeSelection {
  return { ...selection, replacedSlotIndex }
}

export function stepBackUpgradeSelection(
  selection: Readonly<UpgradeSelection>,
): UpgradeSelection {
  if (selection.replacedSlotIndex !== null) {
    return { ...selection, replacedSlotIndex: null }
  }
  if (selection.weaponInstanceId !== null) {
    return {
      ...selection,
      weaponInstanceId: null,
      replacedSlotIndex: null,
    }
  }
  if (selection.choiceId !== null) {
    return EMPTY_UPGRADE_SELECTION
  }
  return selection
}

function getModuleOption(
  choice: Readonly<UiUpgradeChoice>,
  weapon: Readonly<UiEquippedWeapon>,
): UpgradeWeaponOption {
  const matchingSlot = weapon.moduleSlots.find(
    (slot) => slot?.moduleDefinitionId === choice.definitionId,
  )
  if (matchingSlot) {
    const isMaximumRank = matchingSlot.rank >= matchingSlot.maximumRank
    return {
      weapon,
      disabled: isMaximumRank,
      disabledReason: isMaximumRank
        ? `${matchingSlot.title} is already at maximum Rank.`
        : null,
      operation: isMaximumRank
        ? null
        : {
            kind: 'RANK_UP_MODULE',
            weapon,
            slotIndex: matchingSlot.slotIndex,
            rankBefore: matchingSlot.rank,
            rankAfter: matchingSlot.rank + 1,
          },
      requiresSlotSelection: false,
    }
  }

  const emptySlotIndex = weapon.moduleSlots.indexOf(null)
  if (emptySlotIndex >= 0) {
    return {
      weapon,
      disabled: false,
      disabledReason: null,
      operation: {
        kind: 'INSTALL_MODULE',
        weapon,
        slotIndex: emptySlotIndex,
      },
      requiresSlotSelection: false,
    }
  }

  return {
    weapon,
    disabled: false,
    disabledReason: null,
    operation: null,
    requiresSlotSelection: true,
  }
}

function getWeaponOptions(
  choice: Readonly<UiUpgradeChoice>,
  equippedWeapons: readonly Readonly<UiEquippedWeapon>[],
): readonly UpgradeWeaponOption[] {
  return equippedWeapons.map((weapon) =>
    choice.kind === 'WEAPON'
      ? {
          weapon,
          disabled: false,
          disabledReason: null,
          operation: { kind: 'REPLACE_WEAPON', weapon },
          requiresSlotSelection: false,
        }
      : getModuleOption(choice, weapon),
  )
}

function createBaseDecision(
  stage: UpgradeDecisionStage,
  selectedChoice: Readonly<UiUpgradeChoice> | null,
  weaponOptions: readonly UpgradeWeaponOption[] = [],
): UpgradeDecision {
  return {
    stage,
    selectedChoice,
    selectedWeapon: null,
    weaponOptions,
    operation: null,
    command: null,
  }
}

/** Resolves local UI preview state; Runtime still revalidates the final command. */
export function resolveUpgradeDecision(
  input: Readonly<UpgradeDecisionInput>,
  selection: Readonly<UpgradeSelection>,
): UpgradeDecision {
  const selectedChoice = input.choices.find(
    ({ id }) => id === selection.choiceId,
  )
  if (!selectedChoice) {
    return createBaseDecision('CARD', null)
  }

  if (
    selectedChoice.kind === 'WEAPON' &&
    input.equippedWeapons.length < input.maximumEquippedWeapons
  ) {
    return {
      ...createBaseDecision('CONFIRM', selectedChoice),
      operation: { kind: 'ACQUIRE_WEAPON' },
      command: {
        kind: 'WEAPON',
        offerId: input.offerId,
        choiceId: selectedChoice.id,
      },
    }
  }

  const weaponOptions = getWeaponOptions(
    selectedChoice,
    input.equippedWeapons,
  )
  const selectedOption = weaponOptions.find(
    ({ weapon }) => weapon.instanceId === selection.weaponInstanceId,
  )
  if (!selectedOption || selectedOption.disabled) {
    return createBaseDecision('WEAPON', selectedChoice, weaponOptions)
  }

  const selectedWeapon = selectedOption.weapon
  if (selectedChoice.kind === 'WEAPON') {
    return {
      stage: 'CONFIRM',
      selectedChoice,
      selectedWeapon,
      weaponOptions,
      operation: selectedOption.operation,
      command: {
        kind: 'WEAPON',
        offerId: input.offerId,
        choiceId: selectedChoice.id,
        replacedWeaponInstanceId: selectedWeapon.instanceId,
      },
    }
  }

  if (!selectedOption.requiresSlotSelection && selectedOption.operation) {
    return {
      stage: 'CONFIRM',
      selectedChoice,
      selectedWeapon,
      weaponOptions,
      operation: selectedOption.operation,
      command: {
        kind: 'MODULE',
        offerId: input.offerId,
        choiceId: selectedChoice.id,
        weaponInstanceId: selectedWeapon.instanceId,
      },
    }
  }

  const replacedSlot = selectedWeapon.moduleSlots.find(
    (slot) => slot?.slotIndex === selection.replacedSlotIndex,
  )
  if (!replacedSlot) {
    return {
      ...createBaseDecision('SLOT', selectedChoice, weaponOptions),
      selectedWeapon,
    }
  }

  return {
    stage: 'CONFIRM',
    selectedChoice,
    selectedWeapon,
    weaponOptions,
    operation: {
      kind: 'REPLACE_MODULE',
      weapon: selectedWeapon,
      slotIndex: replacedSlot.slotIndex,
      replacedSlot,
    },
    command: {
      kind: 'MODULE',
      offerId: input.offerId,
      choiceId: selectedChoice.id,
      weaponInstanceId: selectedWeapon.instanceId,
      replacedSlotIndex: replacedSlot.slotIndex,
    },
  }
}
