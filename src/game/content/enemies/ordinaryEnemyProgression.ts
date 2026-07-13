import type { CreatureDefinition } from '../creatures/creatureDefinition.ts'

export interface OrdinaryEnemySpawnEntryInput {
  readonly definition: CreatureDefinition
  readonly weight: number
}

export interface OrdinaryEnemyProgressionStageInput {
  readonly startSpawnCount: number
  readonly entries: readonly OrdinaryEnemySpawnEntryInput[]
}

export interface OrdinaryEnemySpawnEntry {
  readonly definition: CreatureDefinition
  readonly weight: number
}

export interface OrdinaryEnemyProgressionStage {
  readonly startSpawnCount: number
  readonly entries: readonly OrdinaryEnemySpawnEntry[]
  readonly totalWeight: number
}

export type OrdinaryEnemyProgression =
  readonly Readonly<OrdinaryEnemyProgressionStage>[]

function validateSpawnCount(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`)
  }
}

export function defineOrdinaryEnemyProgression(
  inputs: readonly OrdinaryEnemyProgressionStageInput[],
): OrdinaryEnemyProgression {
  if (inputs.length === 0 || inputs[0].startSpawnCount !== 0) {
    throw new Error('Ordinary enemy progression must start at spawn count zero.')
  }

  let previousStartSpawnCount = -1
  const stages = inputs.map((input) => {
    validateSpawnCount(input.startSpawnCount, 'startSpawnCount')
    if (input.startSpawnCount <= previousStartSpawnCount) {
      throw new Error(
        'Ordinary enemy progression start counts must be strictly increasing.',
      )
    }
    previousStartSpawnCount = input.startSpawnCount

    if (input.entries.length === 0) {
      throw new Error('Ordinary enemy progression stages must not be empty.')
    }

    let totalWeight = 0
    const entries = input.entries.map(({ definition, weight }) => {
      if (definition.category !== 'ORDINARY') {
        throw new Error(
          `Ordinary enemy progression cannot include ${definition.id}.`,
        )
      }
      if (!Number.isFinite(weight) || weight <= 0) {
        throw new RangeError('Ordinary enemy weight must be finite and positive.')
      }
      totalWeight += weight
      return Object.freeze({ definition, weight })
    })

    return Object.freeze({
      startSpawnCount: input.startSpawnCount,
      entries: Object.freeze(entries),
      totalWeight,
    })
  })

  return Object.freeze(stages)
}

export function selectOrdinaryEnemyDefinition(
  progression: OrdinaryEnemyProgression,
  successfulSpawnCount: number,
  nextRandom: () => number,
): CreatureDefinition {
  validateSpawnCount(successfulSpawnCount, 'successfulSpawnCount')

  let stage = progression[0]
  for (let index = 1; index < progression.length; index += 1) {
    const candidate = progression[index]
    if (candidate.startSpawnCount > successfulSpawnCount) {
      break
    }
    stage = candidate
  }

  if (stage.entries.length === 1) {
    return stage.entries[0].definition
  }

  const randomValue = nextRandom()
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError('Seeded random values must be finite in [0, 1).')
  }
  const targetWeight = randomValue * stage.totalWeight
  let cumulativeWeight = 0
  for (const entry of stage.entries) {
    cumulativeWeight += entry.weight
    if (targetWeight < cumulativeWeight) {
      return entry.definition
    }
  }

  return stage.entries[stage.entries.length - 1].definition
}
