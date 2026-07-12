export const GLYPH_MATERIAL = Object.freeze({
  BASIC: 'BASIC',
  SLIME: 'SLIME',
} as const)

export type GlyphMaterialId =
  (typeof GLYPH_MATERIAL)[keyof typeof GLYPH_MATERIAL]

export interface GlyphMaterialDefinition {
  readonly id: GlyphMaterialId
  readonly durabilityTints: readonly number[]
  readonly hitTint: number
  readonly hitFlashDurationMs: number
  readonly knockbackImpulse: number
  readonly springStrength: number
  readonly damping: number
  readonly maximumOffset: number
}

const MATERIAL_DEFINITIONS: Readonly<
  Record<GlyphMaterialId, GlyphMaterialDefinition>
> = Object.freeze({
  [GLYPH_MATERIAL.BASIC]: Object.freeze({
    id: GLYPH_MATERIAL.BASIC,
    durabilityTints: Object.freeze([0xc94b5f]),
    hitTint: 0xffd8de,
    hitFlashDurationMs: 60,
    knockbackImpulse: 70,
    springStrength: 55,
    damping: 14,
    maximumOffset: 8,
  }),
  [GLYPH_MATERIAL.SLIME]: Object.freeze({
    id: GLYPH_MATERIAL.SLIME,
    durabilityTints: Object.freeze([0x4c956c, 0x70b77e]),
    hitTint: 0xb7e4c7,
    hitFlashDurationMs: 80,
    knockbackImpulse: 220,
    springStrength: 22,
    damping: 7,
    maximumOffset: 34,
  }),
})

export function getGlyphMaterialDefinition(
  materialId: GlyphMaterialId,
): GlyphMaterialDefinition {
  return MATERIAL_DEFINITIONS[materialId]
}

export function getGlyphDurabilityTint(
  material: GlyphMaterialDefinition,
  currentDurability: number,
): number {
  const durabilityTier = Math.max(1, Math.ceil(currentDurability))
  const tintIndex = Math.min(
    durabilityTier - 1,
    material.durabilityTints.length - 1,
  )
  return material.durabilityTints[tintIndex]
}
