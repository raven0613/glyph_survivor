export interface UiUpgradeChoice {
  readonly id: string
  readonly kind: 'WEAPON' | 'MODULE'
  readonly definitionId: string
  readonly title?: string
  readonly description?: string
  readonly rankPreviews?: readonly Readonly<UiUpgradeRankPreview>[]
  readonly weaponTargetPreviews?: readonly Readonly<UiUpgradeWeaponTargetPreview>[]
}

export interface UiUpgradeRankPreview {
  readonly rank: number
  readonly summary: string
}

export interface UiUpgradeWeaponTargetPreview {
  readonly weaponInstanceId: number
  readonly summary: string
}

export interface UiInitialWeaponChoice {
  readonly definitionId: string
  readonly title: string
  readonly description: string
  readonly identityGlyph: string
  readonly moduleSlotCount: number
}

export interface UiWeaponModuleSlot {
  readonly slotIndex: number
  readonly moduleDefinitionId: string
  readonly title: string
  readonly rank: number
  readonly maximumRank: number
}

export interface UiEquippedWeapon {
  readonly instanceId: number
  readonly definitionId: string
  readonly title: string
  readonly identityGlyph: string
  readonly profileRevision: number
  readonly moduleSlots: readonly (Readonly<UiWeaponModuleSlot> | null)[]
}

export interface UiRunResultModuleSlot {
  readonly slotIndex: number
  readonly moduleDefinitionId: string
  readonly title: string
  readonly rank: number
}

export interface UiRunResultWeapon {
  readonly instanceId: number
  readonly definitionId: string
  readonly title: string
  readonly identityGlyph: string
  readonly moduleSlots: readonly (Readonly<UiRunResultModuleSlot> | null)[]
  readonly totalDamage: number
  readonly equippedGameplayTimeMs: number
  readonly averageEquippedDps: number | null
  readonly isHighestDamage: boolean
}

export interface UiRunResult {
  readonly gameplayTimeMs: number
  readonly killCount: number
  readonly finalPlayerLevel: number
  readonly weapons: readonly Readonly<UiRunResultWeapon>[]
}

export interface UiSnapshot {
  readonly phase: string
  readonly seed: string | number | null
  readonly currentHealth: number
  readonly maximumHealth: number
  readonly currentShieldLayers: number
  readonly maximumShieldLayers: number
  readonly runResult: Readonly<UiRunResult> | null
  readonly xp: number
  readonly xpToNext: number
  readonly level: number
  readonly runTimeMs: number
  readonly enemyCount: number
  readonly initialWeaponChoices: readonly Readonly<UiInitialWeaponChoice>[]
  readonly equippedWeapons: readonly Readonly<UiEquippedWeapon>[]
  readonly maximumEquippedWeapons: number
  readonly upgradeChoices: readonly Readonly<UiUpgradeChoice>[]
  readonly pendingUpgradeCount: number
  readonly activeUpgradeOfferId: string | null
  readonly recoverableError: string | null
}

export interface GameplayUiData {
  readonly currentHealth: number
  readonly maximumHealth: number
  readonly currentShieldLayers: number
  readonly maximumShieldLayers: number
  readonly runResult: Readonly<UiRunResult> | null
  readonly xp: number
  readonly xpToNext: number
  readonly level: number
  readonly runTimeMs: number
  readonly enemyCount: number
}

const EMPTY_GAMEPLAY_UI: Readonly<GameplayUiData> = Object.freeze({
  currentHealth: 0,
  maximumHealth: 0,
  currentShieldLayers: 0,
  maximumShieldLayers: 0,
  runResult: null,
  xp: 0,
  xpToNext: 5,
  level: 1,
  runTimeMs: 0,
  enemyCount: 0,
})

const EMPTY_INITIAL_WEAPON_CHOICES: readonly Readonly<UiInitialWeaponChoice>[] =
  Object.freeze([])
const EMPTY_EQUIPPED_WEAPONS: readonly Readonly<UiEquippedWeapon>[] =
  Object.freeze([])

interface MachineSnapshotForUi {
  readonly value: unknown
  readonly context: {
    readonly seed: string | number | null
    readonly upgradeChoices: readonly UiUpgradeChoice[]
    readonly pendingUpgradeCount: number
    readonly activeUpgradeOfferId: string | null
    readonly recoverableError: string | null
  }
}

export const INITIAL_UI_SNAPSHOT: Readonly<UiSnapshot> = Object.freeze({
  phase: 'BOOT',
  seed: null,
  currentHealth: 0,
  maximumHealth: 0,
  currentShieldLayers: 0,
  maximumShieldLayers: 0,
  runResult: null,
  xp: 0,
  xpToNext: 5,
  level: 1,
  runTimeMs: 0,
  enemyCount: 0,
  initialWeaponChoices: EMPTY_INITIAL_WEAPON_CHOICES,
  equippedWeapons: EMPTY_EQUIPPED_WEAPONS,
  maximumEquippedWeapons: 0,
  upgradeChoices: Object.freeze([]),
  pendingUpgradeCount: 0,
  activeUpgradeOfferId: null,
  recoverableError: null,
})

/** Copies only UI-sized data; gameplay stores cannot cross this boundary. */
export function createUiSnapshot(
  machineSnapshot: MachineSnapshotForUi,
  gameplayUi: Readonly<GameplayUiData> = EMPTY_GAMEPLAY_UI,
  initialWeaponChoices: readonly Readonly<UiInitialWeaponChoice>[] =
    EMPTY_INITIAL_WEAPON_CHOICES,
  equippedWeapons: readonly Readonly<UiEquippedWeapon>[] =
    EMPTY_EQUIPPED_WEAPONS,
  maximumEquippedWeapons = 0,
): Readonly<UiSnapshot> {
  if (typeof machineSnapshot.value !== 'string') {
    throw new TypeError('Game phase must be a string state value.')
  }
  if (
    !Number.isSafeInteger(maximumEquippedWeapons) ||
    maximumEquippedWeapons < 0
  ) {
    throw new RangeError(
      'maximumEquippedWeapons must be a non-negative safe integer.',
    )
  }

  const upgradeChoices = Object.freeze(
    machineSnapshot.context.upgradeChoices.map((choice) =>
      Object.freeze({
        ...choice,
        rankPreviews: choice.rankPreviews
          ? Object.freeze(
              choice.rankPreviews.map((preview) =>
                Object.freeze({ ...preview }),
              ),
            )
          : undefined,
        weaponTargetPreviews: choice.weaponTargetPreviews
          ? Object.freeze(
              choice.weaponTargetPreviews.map((preview) =>
                Object.freeze({ ...preview }),
              ),
            )
          : undefined,
      }),
    ),
  )
  const copiedInitialWeaponChoices = Object.freeze(
    initialWeaponChoices.map((choice) => Object.freeze({ ...choice })),
  )
  const copiedEquippedWeapons = Object.freeze(
    equippedWeapons.map((weapon) =>
      Object.freeze({
        ...weapon,
        moduleSlots: Object.freeze(
          weapon.moduleSlots.map((slot) =>
            slot ? Object.freeze({ ...slot }) : null,
          ),
        ),
      }),
    ),
  )
  const copiedRunResult = gameplayUi.runResult
    ? Object.freeze({
        gameplayTimeMs: gameplayUi.runResult.gameplayTimeMs,
        killCount: gameplayUi.runResult.killCount,
        finalPlayerLevel: gameplayUi.runResult.finalPlayerLevel,
        weapons: Object.freeze(
          gameplayUi.runResult.weapons.map((weapon) =>
            Object.freeze({
              ...weapon,
              moduleSlots: Object.freeze(
                weapon.moduleSlots.map((slot) =>
                  slot ? Object.freeze({ ...slot }) : null,
                ),
              ),
            }),
          ),
        ),
      })
    : null

  return Object.freeze({
    phase: machineSnapshot.value,
    seed: machineSnapshot.context.seed,
    currentHealth: gameplayUi.currentHealth,
    maximumHealth: gameplayUi.maximumHealth,
    currentShieldLayers: gameplayUi.currentShieldLayers,
    maximumShieldLayers: gameplayUi.maximumShieldLayers,
    runResult: copiedRunResult,
    xp: gameplayUi.xp,
    xpToNext: gameplayUi.xpToNext,
    level: gameplayUi.level,
    runTimeMs: gameplayUi.runTimeMs,
    enemyCount: gameplayUi.enemyCount,
    initialWeaponChoices: copiedInitialWeaponChoices,
    equippedWeapons: copiedEquippedWeapons,
    maximumEquippedWeapons,
    upgradeChoices,
    pendingUpgradeCount: machineSnapshot.context.pendingUpgradeCount,
    activeUpgradeOfferId: machineSnapshot.context.activeUpgradeOfferId,
    recoverableError: machineSnapshot.context.recoverableError,
  })
}
