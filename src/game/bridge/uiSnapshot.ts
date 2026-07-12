export interface UiUpgradeChoice {
  readonly id: string
  readonly title?: string
  readonly description?: string
}

export interface UiSnapshot {
  readonly phase: string
  readonly seed: string | number | null
  readonly xp: number
  readonly level: number
  readonly runTimeMs: number
  readonly enemyCount: number
  readonly upgradeChoices: readonly Readonly<UiUpgradeChoice>[]
  readonly pendingUpgradeCount: number
  readonly recoverableError: string | null
}

export interface GameplayUiData {
  readonly xp: number
  readonly level: number
  readonly runTimeMs: number
  readonly enemyCount: number
}

const EMPTY_GAMEPLAY_UI: Readonly<GameplayUiData> = Object.freeze({
  xp: 0,
  level: 1,
  runTimeMs: 0,
  enemyCount: 0,
})

interface MachineSnapshotForUi {
  readonly value: unknown
  readonly context: {
    readonly seed: string | number | null
    readonly upgradeChoices: readonly UiUpgradeChoice[]
    readonly pendingUpgradeCount: number
    readonly recoverableError: string | null
  }
}

export const INITIAL_UI_SNAPSHOT: Readonly<UiSnapshot> = Object.freeze({
  phase: 'BOOT',
  seed: null,
  xp: 0,
  level: 1,
  runTimeMs: 0,
  enemyCount: 0,
  upgradeChoices: Object.freeze([]),
  pendingUpgradeCount: 0,
  recoverableError: null,
})

/** Copies only UI-sized data; gameplay stores cannot cross this boundary. */
export function createUiSnapshot(
  machineSnapshot: MachineSnapshotForUi,
  gameplayUi: Readonly<GameplayUiData> = EMPTY_GAMEPLAY_UI,
): Readonly<UiSnapshot> {
  if (typeof machineSnapshot.value !== 'string') {
    throw new TypeError('Game phase must be a string state value.')
  }

  const upgradeChoices = Object.freeze(
    machineSnapshot.context.upgradeChoices.map((choice) =>
      Object.freeze({ ...choice }),
    ),
  )

  return Object.freeze({
    phase: machineSnapshot.value,
    seed: machineSnapshot.context.seed,
    xp: gameplayUi.xp,
    level: gameplayUi.level,
    runTimeMs: gameplayUi.runTimeMs,
    enemyCount: gameplayUi.enemyCount,
    upgradeChoices,
    pendingUpgradeCount: machineSnapshot.context.pendingUpgradeCount,
    recoverableError: machineSnapshot.context.recoverableError,
  })
}
