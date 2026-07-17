import type { CreatureDefinition } from '../creatures/creatureDefinition.ts'

export interface OrdinaryEnemyProgressionEntryInput {
  readonly definition: CreatureDefinition
  readonly earliestAppearanceTimeMs: number
  readonly postDebutWeight: number
}

export type OrdinaryEnemyProgressionEntry = OrdinaryEnemyProgressionEntryInput

export interface OrdinaryEnemyProgression {
  readonly entries: readonly Readonly<OrdinaryEnemyProgressionEntry>[]
}

export interface OrdinaryEnemyProgressionState {
  completedDebutCount: number
  pendingDebutIndex: number | null
}

export interface OrdinaryEnemySpawnSelection {
  readonly definition: CreatureDefinition
  readonly progressionIndex: number
  readonly isDebut: boolean
}

function requireGameplayTime(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and non-negative.`)
  }
}

function requireProgressionState(
  progression: OrdinaryEnemyProgression,
  state: OrdinaryEnemyProgressionState,
): void {
  if (
    !Number.isSafeInteger(state.completedDebutCount) ||
    state.completedDebutCount < 0 ||
    state.completedDebutCount > progression.entries.length
  ) {
    throw new RangeError('completedDebutCount is outside the progression.')
  }
  if (
    state.pendingDebutIndex !== null &&
    state.pendingDebutIndex !== state.completedDebutCount
  ) {
    throw new Error('pendingDebutIndex must be the next incomplete debut.')
  }
}

export function defineOrdinaryEnemyProgression(
  inputs: readonly OrdinaryEnemyProgressionEntryInput[],
): OrdinaryEnemyProgression {
  if (inputs.length === 0 || inputs[0].earliestAppearanceTimeMs !== 0) {
    throw new Error(
      'Ordinary enemy progression must start at first appearance time zero.',
    )
  }

  let previousAppearanceTimeMs = -1
  const definitionIds = new Set<string>()
  const entries = inputs.map((input) => {
    if (input.definition.category !== 'ORDINARY') {
      throw new Error(
        `Ordinary enemy progression cannot include ${input.definition.id}.`,
      )
    }
    if (definitionIds.has(input.definition.id)) {
      throw new Error(
        `Ordinary enemy progression duplicates ${input.definition.id}.`,
      )
    }
    definitionIds.add(input.definition.id)

    requireGameplayTime(
      input.earliestAppearanceTimeMs,
      'earliestAppearanceTimeMs',
    )
    if (input.earliestAppearanceTimeMs <= previousAppearanceTimeMs) {
      throw new Error(
        'Ordinary enemy appearance times must be strictly increasing.',
      )
    }
    previousAppearanceTimeMs = input.earliestAppearanceTimeMs

    if (!Number.isFinite(input.postDebutWeight) || input.postDebutWeight <= 0) {
      throw new RangeError('postDebutWeight must be finite and positive.')
    }
    return Object.freeze({ ...input })
  })

  return Object.freeze({ entries: Object.freeze(entries) })
}

export function createOrdinaryEnemyProgressionState(): OrdinaryEnemyProgressionState {
  return {
    completedDebutCount: 0,
    pendingDebutIndex: null,
  }
}

function selectMixedDefinition(
  progression: OrdinaryEnemyProgression,
  completedDebutCount: number,
  nextRandom: () => number,
): OrdinaryEnemySpawnSelection {
  if (completedDebutCount <= 0) {
    throw new Error('A mixed spawn requires at least one completed debut.')
  }
  if (completedDebutCount === 1) {
    return Object.freeze({
      definition: progression.entries[0].definition,
      progressionIndex: 0,
      isDebut: false,
    })
  }

  const randomValue = nextRandom()
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError('Seeded random values must be finite in [0, 1).')
  }
  let totalWeight = 0
  for (let index = 0; index < completedDebutCount; index += 1) {
    totalWeight += progression.entries[index].postDebutWeight
  }
  const targetWeight = randomValue * totalWeight
  let cumulativeWeight = 0
  for (let index = 0; index < completedDebutCount; index += 1) {
    cumulativeWeight += progression.entries[index].postDebutWeight
    if (targetWeight < cumulativeWeight) {
      return Object.freeze({
        definition: progression.entries[index].definition,
        progressionIndex: index,
        isDebut: false,
      })
    }
  }

  const fallbackIndex = completedDebutCount - 1
  return Object.freeze({
    definition: progression.entries[fallbackIndex].definition,
    progressionIndex: fallbackIndex,
    isDebut: false,
  })
}

export function selectOrdinaryEnemyDefinition(
  progression: OrdinaryEnemyProgression,
  state: OrdinaryEnemyProgressionState,
  gameplayTimeMs: number,
  nextRandom: () => number,
): OrdinaryEnemySpawnSelection {
  requireGameplayTime(gameplayTimeMs, 'gameplayTimeMs')
  requireProgressionState(progression, state)

  const nextDebutIndex = state.completedDebutCount
  const nextDebut = progression.entries[nextDebutIndex]
  if (
    state.pendingDebutIndex === null &&
    nextDebut &&
    gameplayTimeMs >= nextDebut.earliestAppearanceTimeMs
  ) {
    state.pendingDebutIndex = nextDebutIndex
  }

  if (state.pendingDebutIndex !== null) {
    const pendingIndex = state.pendingDebutIndex
    return Object.freeze({
      definition: progression.entries[pendingIndex].definition,
      progressionIndex: pendingIndex,
      isDebut: true,
    })
  }

  return selectMixedDefinition(
    progression,
    state.completedDebutCount,
    nextRandom,
  )
}

export function commitOrdinaryEnemySpawn(
  state: OrdinaryEnemyProgressionState,
  selection: OrdinaryEnemySpawnSelection,
): void {
  if (!selection.isDebut) {
    return
  }
  if (
    state.pendingDebutIndex !== selection.progressionIndex ||
    state.completedDebutCount !== selection.progressionIndex
  ) {
    throw new Error('Cannot commit a stale ordinary enemy debut selection.')
  }
  state.completedDebutCount += 1
  state.pendingDebutIndex = null
}
