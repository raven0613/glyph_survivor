import {
  resolveGlyphBasePresentation,
  type CombatVisualTheme,
} from '../content/visuals/combatVisualTheme.ts'
import { getPrintableAsciiGlyphFrame } from './glyphFrame.ts'
import type { GlyphBodySlotRole } from './glyphLayout.ts'
import type { GlyphCell } from './glyphCell.ts'

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] }

export function updateGlyphRolePresentation(
  glyph: GlyphCell | undefined,
  role: GlyphBodySlotRole,
  visualTheme: CombatVisualTheme,
): void {
  if (!glyph) {
    return
  }
  const cell = glyph as Mutable<GlyphCell>
  cell.role = role
  cell.character = role === 'EYE' ? 'O' : cell.baseCharacter
  cell.glyphFrame =
    role === 'EYE'
      ? getPrintableAsciiGlyphFrame('O')
      : cell.baseGlyphFrame
  const presentation = resolveGlyphBasePresentation(
    visualTheme,
    cell.appearanceProfileId,
    cell.currentDurability,
    cell.maxDurability,
    role,
  )
  cell.alpha = presentation.alpha
  cell.baseTint = presentation.tint
  if (cell.hitFlashRemainingMs === 0) {
    cell.tint = cell.baseTint
  }
}
