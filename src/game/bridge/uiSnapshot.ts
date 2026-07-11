export interface UiUpgradeChoice {
  readonly id: string
  readonly title?: string
  readonly description?: string
}

export interface UiSnapshot {
  readonly phase: string
  readonly seed: string | number | null
  readonly upgradeChoices: readonly Readonly<UiUpgradeChoice>[]
  readonly pendingUpgradeCount: number
  readonly recoverableError: string | null
}

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
  upgradeChoices: Object.freeze([]),
  pendingUpgradeCount: 0,
  recoverableError: null,
})

/** Copies only UI-sized data; gameplay stores cannot cross this boundary. */
export function createUiSnapshot(
  machineSnapshot: MachineSnapshotForUi,
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
    upgradeChoices,
    pendingUpgradeCount: machineSnapshot.context.pendingUpgradeCount,
    recoverableError: machineSnapshot.context.recoverableError,
  })
}
