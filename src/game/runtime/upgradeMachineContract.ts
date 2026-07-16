import type {
  UpgradeRankPreview,
  UpgradeWeaponTargetPreview,
} from './upgradeState.ts'

export const INVALID_UPGRADE_OFFER_ERROR =
  'Invalid upgrade offer: expected three choices with unique, non-empty IDs.'
export const INVALID_UPGRADE_SELECTION_ERROR =
  'Invalid upgrade selection: the choice is not part of the active offer.'

/** A UI-sized reference to an authoritative runtime upgrade definition. */
export interface UpgradeChoice {
  readonly id: string
  readonly kind: 'WEAPON' | 'MODULE'
  readonly definitionId: string
  readonly title?: string
  readonly description?: string
  readonly rankPreviews?: readonly Readonly<UpgradeRankPreview>[]
  readonly weaponTargetPreviews?: readonly Readonly<UpgradeWeaponTargetPreview>[]
}

export interface UpgradeOfferedEvent {
  readonly type: 'UPGRADE_OFFERED'
  readonly offerId: string
  readonly choices: readonly UpgradeChoice[]
  readonly pendingUpgradeCount?: number
}

export interface UpgradeCommittedEvent {
  readonly type: 'UPGRADE_COMMITTED'
  readonly choiceId: string
}

function hasValidWeaponTargetPreviews(
  previews: unknown,
): previews is readonly UpgradeWeaponTargetPreview[] {
  return (
    Array.isArray(previews) &&
    previews.length > 0 &&
    previews.every(
      (preview) =>
        preview !== null &&
        typeof preview === 'object' &&
        'weaponInstanceId' in preview &&
        Number.isSafeInteger(preview.weaponInstanceId) &&
        preview.weaponInstanceId > 0 &&
        'summary' in preview &&
        typeof preview.summary === 'string' &&
        preview.summary.trim().length > 0,
    ) &&
    new Set(previews.map(({ weaponInstanceId }) => weaponInstanceId)).size ===
      previews.length
  )
}

function hasValidRankPreviews(
  previews: unknown,
): previews is readonly UpgradeRankPreview[] {
  return (
    Array.isArray(previews) &&
    previews.length > 0 &&
    previews.every(
      (preview, index) =>
        preview !== null &&
        typeof preview === 'object' &&
        'rank' in preview &&
        preview.rank === index + 1 &&
        'summary' in preview &&
        typeof preview.summary === 'string' &&
        preview.summary.trim().length > 0,
    )
  )
}

function hasValidChoiceId(choice: unknown): choice is UpgradeChoice {
  return (
    choice !== null &&
    typeof choice === 'object' &&
    'id' in choice &&
    typeof choice.id === 'string' &&
    choice.id.trim().length > 0 &&
    'definitionId' in choice &&
    typeof choice.definitionId === 'string' &&
    choice.definitionId.trim().length > 0 &&
    'kind' in choice &&
    (choice.kind === 'WEAPON' || choice.kind === 'MODULE') &&
    (!('rankPreviews' in choice) || hasValidRankPreviews(choice.rankPreviews)) &&
    (!('weaponTargetPreviews' in choice) ||
      choice.weaponTargetPreviews === undefined ||
      hasValidWeaponTargetPreviews(choice.weaponTargetPreviews))
  )
}

export function isValidUpgradeOffer(
  event: unknown,
): event is UpgradeOfferedEvent {
  if (event === null || typeof event !== 'object') {
    return false
  }
  const candidate = event as Partial<UpgradeOfferedEvent>
  if (
    candidate.type !== 'UPGRADE_OFFERED' ||
    typeof candidate.offerId !== 'string' ||
    !candidate.offerId.trim() ||
    !Array.isArray(candidate.choices) ||
    candidate.choices.length !== 3 ||
    !candidate.choices.every(hasValidChoiceId) ||
    new Set(candidate.choices.map(({ id }) => id)).size !==
      candidate.choices.length
  ) {
    return false
  }

  return (
    candidate.pendingUpgradeCount === undefined ||
    (typeof candidate.pendingUpgradeCount === 'number' &&
      Number.isInteger(candidate.pendingUpgradeCount) &&
      candidate.pendingUpgradeCount > 0)
  )
}

export function copyUpgradeChoices(
  choices: readonly UpgradeChoice[],
): readonly Readonly<UpgradeChoice>[] {
  return Object.freeze(
    choices.map((choice) =>
      Object.freeze({
        ...choice,
        rankPreviews: choice.rankPreviews
          ? Object.freeze(
              choice.rankPreviews.map((preview) => Object.freeze({ ...preview })),
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
}
