import type { GlyphCell } from './glyphCell.ts'
import { isGlyphLivingState } from './glyphCell.ts'

export const GLYPH_STATUS_FLAG = Object.freeze({
  CRACKED: 1 << 0,
  DISCONNECTED_LATCHED: 1 << 1,
} as const)

export type GlyphStatusFlag =
  (typeof GLYPH_STATUS_FLAG)[keyof typeof GLYPH_STATUS_FLAG]

export function hasGlyphStatus(
  glyph: Readonly<GlyphCell>,
  flag: GlyphStatusFlag,
): boolean {
  return (glyph.flags & flag) !== 0
}

type MutableGlyphStatus = {
  -readonly [Key in
    | 'flags'
    | 'crackedCreatedByRootAttackEventId'
    | 'disconnectedLatchedMultiplier'
    | 'disconnectedLatchEpisodeId']: GlyphCell[Key]
} & Pick<GlyphCell, 'state'>

export function applyCrackedStatus(
  glyph: MutableGlyphStatus | undefined,
  rootAttackEventId: number,
): boolean {
  if (
    !glyph ||
    !isGlyphLivingState(glyph.state) ||
    (glyph.flags & GLYPH_STATUS_FLAG.CRACKED) !== 0
  ) {
    return false
  }
  glyph.flags |= GLYPH_STATUS_FLAG.CRACKED
  glyph.crackedCreatedByRootAttackEventId = rootAttackEventId
  return true
}

export function consumeCrackedStatus(
  glyph: MutableGlyphStatus | undefined,
  rootAttackEventId: number,
): boolean {
  if (
    !glyph ||
    !isGlyphLivingState(glyph.state) ||
    (glyph.flags & GLYPH_STATUS_FLAG.CRACKED) === 0 ||
    glyph.crackedCreatedByRootAttackEventId === rootAttackEventId
  ) {
    return false
  }
  glyph.flags &= ~GLYPH_STATUS_FLAG.CRACKED
  glyph.crackedCreatedByRootAttackEventId = 0
  return true
}

export function applyDisconnectedLatchStatus(
  glyph: MutableGlyphStatus | undefined,
  multiplier: number,
  episodeId: number,
): boolean {
  if (!Number.isFinite(multiplier) || multiplier <= 1) {
    throw new RangeError(
      'Disconnected latch multiplier must be greater than one.',
    )
  }
  if (!Number.isSafeInteger(episodeId) || episodeId <= 0) {
    throw new RangeError('Disconnected latch episode ID must be positive.')
  }
  if (!glyph || !isGlyphLivingState(glyph.state)) {
    return false
  }
  const previousMultiplier = glyph.disconnectedLatchedMultiplier
  const previousEpisodeId = glyph.disconnectedLatchEpisodeId
  glyph.flags |= GLYPH_STATUS_FLAG.DISCONNECTED_LATCHED
  glyph.disconnectedLatchedMultiplier = Math.max(
    previousMultiplier,
    multiplier,
  )
  glyph.disconnectedLatchEpisodeId = episodeId
  return (
    glyph.disconnectedLatchedMultiplier !== previousMultiplier ||
    previousEpisodeId !== episodeId
  )
}

export function clearDisconnectedLatchStatus(
  glyph: MutableGlyphStatus,
  episodeId: number,
): boolean {
  if (
    (glyph.flags & GLYPH_STATUS_FLAG.DISCONNECTED_LATCHED) === 0 ||
    glyph.disconnectedLatchEpisodeId !== episodeId
  ) {
    return false
  }
  glyph.flags &= ~GLYPH_STATUS_FLAG.DISCONNECTED_LATCHED
  glyph.disconnectedLatchedMultiplier = 1
  glyph.disconnectedLatchEpisodeId = 0
  return true
}

export function clearLivingGlyphStatuses(glyph: MutableGlyphStatus): void {
  glyph.flags = 0
  glyph.crackedCreatedByRootAttackEventId = 0
  glyph.disconnectedLatchedMultiplier = 1
  glyph.disconnectedLatchEpisodeId = 0
}
