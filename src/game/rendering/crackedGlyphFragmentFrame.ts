import type { Texture } from 'pixi.js'
import type { CrackedGlyphFragmentLayout } from './crackedGlyphFragments.ts'

export interface CrackedGlyphFragmentFrame
  extends CrackedGlyphFragmentLayout {
  readonly texture: Texture
}
