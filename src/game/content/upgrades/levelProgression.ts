export interface LevelProgressionDefinition {
  readonly earlyLevelLimit: number
  readonly earlyBaseXp: number
  readonly lateBaseXp: number
  readonly lateXpPerLevel: number
}

export const PROTOTYPE_LEVEL_PROGRESSION: Readonly<LevelProgressionDefinition> =
  Object.freeze({
    earlyLevelLimit: 10,
    earlyBaseXp: 3,
    lateBaseXp: 68,
    lateXpPerLevel: 12,
  })

export function getXpToNextLevel(
  definition: Readonly<LevelProgressionDefinition>,
  level: number,
): number {
  if (!Number.isSafeInteger(level) || level <= 0) {
    throw new RangeError('level must be a positive safe integer.')
  }
  return level <= definition.earlyLevelLimit
    ? definition.earlyBaseXp + (level * (level + 3)) / 2
    : definition.lateBaseXp +
        definition.lateXpPerLevel * (level - definition.earlyLevelLimit)
}
