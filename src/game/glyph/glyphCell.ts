import type { GlyphBodySlotRole } from './glyphLayout.ts'
import type { GlyphMaterialDefinition, GlyphMaterialId } from './glyphMaterial.ts'

export const GLYPH_CELL_STATE = Object.freeze({
  HEALTHY: 'HEALTHY',
  DAMAGED: 'DAMAGED',
  HUSK: 'HUSK',
} as const)

export type GlyphCellState =
  (typeof GLYPH_CELL_STATE)[keyof typeof GLYPH_CELL_STATE]

export function isGlyphLivingState(state: GlyphCellState): boolean {
  return state === GLYPH_CELL_STATE.HEALTHY || state === GLYPH_CELL_STATE.DAMAGED
}

export interface GlyphCell {
  readonly id: number
  readonly ownerId: number
  readonly bodySlotId: number
  readonly character: string
  readonly glyphFrame: number
  readonly baseCharacter: string
  readonly baseGlyphFrame: number
  readonly role: GlyphBodySlotRole
  readonly topologyX: number
  readonly topologyY: number
  readonly layoutBaseX: number
  readonly layoutBaseY: number
  readonly localX: number
  readonly localY: number
  readonly currentDurability: number
  readonly maxDurability: number
  readonly collisionRadius: number
  readonly alpha: number
  readonly baseTint: number
  readonly tint: number
  readonly hitFlashRemainingMs: number
  readonly material: GlyphMaterialId
  readonly state: GlyphCellState
  readonly rotation: number
  readonly offsetX: number
  readonly offsetY: number
  readonly velocityX: number
  readonly velocityY: number
  readonly scale: number
  readonly flags: number
}

export interface OwnerDurability {
  readonly currentDurability: number
  readonly maxDurability: number
  readonly livingGlyphCount: number
  readonly glyphCount: number
}

export interface CreateGlyphInput {
  readonly ownerId: number
  readonly bodySlotId: number
  readonly character: string
  readonly glyphFrame: number
  readonly baseCharacter: string
  readonly baseGlyphFrame: number
  readonly role: GlyphBodySlotRole
  readonly topologyX: number
  readonly topologyY: number
  readonly maxDurability: number
  readonly collisionRadius: number
  readonly scale: number
  readonly material: GlyphMaterialId
  readonly baseTint: number
  readonly localX?: number
  readonly localY?: number
}

export interface GlyphStore {
  readonly cells: readonly GlyphCell[]
  readonly poolMisses: number
  createGlyph(input: CreateGlyphInput): GlyphCell
  getById(glyphId: number): GlyphCell | undefined
  getOwnerGlyphs(ownerId: number): readonly GlyphCell[]
  getOwnerDurability(ownerId: number): Readonly<OwnerDurability> | undefined
  isOwnerDepleted(ownerId: number): boolean
  applyDamage(glyphId: number, amount: number): number
  applyMaterialHit(
    glyphId: number,
    directionX: number,
    directionY: number,
    material: GlyphMaterialDefinition,
  ): void
  stepMaterial(
    glyphId: number,
    deltaMs: number,
    material: GlyphMaterialDefinition,
    allowUnboundedOffset?: boolean,
  ): void
  setGlyphLocalPosition(glyphId: number, localX: number, localY: number): void
  transferGlyph(glyphId: number, newOwnerId: number): void
  setGlyphCompiledLayout(
    glyphId: number,
    topologyX: number,
    topologyY: number,
    localX: number,
    localY: number,
    offsetX: number,
    offsetY: number,
  ): void
  setGlyphPresentation(glyphId: number, role: GlyphBodySlotRole): void
  removeOwner(ownerId: number): void
}

export interface CreateGlyphStoreOptions {
  readonly onPoolMiss?: () => void
}
