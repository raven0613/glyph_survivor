import {
  resolveGlyphBasePresentation,
  resolveGlyphImpactPresentation,
  type CombatVisualTheme,
} from '../content/visuals/combatVisualTheme.ts'
import { normalizeNonNegativeGameplayNumber } from '../core/gameplayNumber.ts'
import {
  GLYPH_CELL_STATE,
  type GlyphCell,
  type OwnerDurability,
} from './glyphCell.ts'
import { clearLivingGlyphStatuses } from './glyphStatus.ts'

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] }

export function applyGlyphDurabilityDamage(
  glyph: GlyphCell,
  ownerDurability: OwnerDurability,
  amount: number,
  visualTheme: CombatVisualTheme,
): number {
  const cell = glyph as Mutable<GlyphCell>
  const owner = ownerDurability as Mutable<OwnerDurability>
  const previousDurability = cell.currentDurability
  cell.currentDurability = normalizeNonNegativeGameplayNumber(
    Math.max(0, previousDurability - amount),
  )
  const appliedDamage = previousDurability - cell.currentDurability
  owner.currentDurability = normalizeNonNegativeGameplayNumber(
    Math.max(0, owner.currentDurability - appliedDamage),
  )
  if (cell.currentDurability === 0) {
    cell.state = GLYPH_CELL_STATE.HUSK
    owner.livingGlyphCount -= 1
    clearLivingGlyphStatuses(cell)
  } else {
    cell.state = GLYPH_CELL_STATE.DAMAGED
  }

  const presentation = resolveGlyphBasePresentation(
    visualTheme,
    cell.appearanceProfileId,
    cell.currentDurability,
    cell.maxDurability,
    cell.role,
  )
  cell.alpha = presentation.alpha
  cell.baseTint = presentation.tint
  cell.tint =
    cell.hitFlashRemainingMs === 0
      ? cell.baseTint
      : resolveGlyphImpactPresentation(
          visualTheme,
          cell.appearanceProfileId,
        ).tint
  return appliedDamage
}
