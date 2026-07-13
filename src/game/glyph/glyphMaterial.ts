import type { GlyphBodySlotRole } from './glyphLayout.ts'

export const GLYPH_MATERIAL = Object.freeze({
  BASIC: 'BASIC',
  SLIME: 'SLIME',
} as const)

export type GlyphMaterialId =
  (typeof GLYPH_MATERIAL)[keyof typeof GLYPH_MATERIAL]

export interface GlyphMaterialDefinition {
  readonly id: GlyphMaterialId
  readonly durabilityTints: readonly number[]
  readonly eyeDurabilityTints: readonly number[] | null
  readonly hitTint: number
  readonly hitFlashDurationMs: number
  readonly hitPulseScale: number
  readonly hitAlphaFloor: number
  readonly hitBurstCharacters: readonly string[]
  readonly hitBurstParticleCount: number
  readonly hitBurstDistance: number
  readonly hitBurstScale: number
  readonly hitBurstTint: number
  readonly huskTint: number
  readonly huskAlpha: number
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
    eyeDurabilityTints: null,
    hitTint: 0xffd8de,
    hitFlashDurationMs: 110,
    hitPulseScale: 1.12,
    hitAlphaFloor: 0.55,
    hitBurstCharacters: Object.freeze(['+', '*']),
    hitBurstParticleCount: 3,
    hitBurstDistance: 34,
    hitBurstScale: 0.34,
    hitBurstTint: 0xffd8de,
    huskTint: 0x5b2a32,
    huskAlpha: 0.12,
    knockbackImpulse: 70,
    springStrength: 55,
    damping: 14,
    maximumOffset: 8,
  }),
  [GLYPH_MATERIAL.SLIME]: Object.freeze({
    id: GLYPH_MATERIAL.SLIME,
    durabilityTints: Object.freeze([0x4c956c, 0x70b77e]),
    eyeDurabilityTints: Object.freeze([0xd4a72c, 0xf4d35e]),
    hitTint: 0xb7e4c7,
    hitFlashDurationMs: 140,
    hitPulseScale: 1.16,
    hitAlphaFloor: 0.5,
    hitBurstCharacters: Object.freeze(['~', '.', '*']),
    hitBurstParticleCount: 5,
    hitBurstDistance: 42,
    hitBurstScale: 0.3,
    hitBurstTint: 0xb7e4c7,
    huskTint: 0x4c956c,
    huskAlpha: 0.12,
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
  role: GlyphBodySlotRole = 'BODY',
): number {
  if (currentDurability <= 0) {
    return material.huskTint
  }
  const durabilityTints =
    role === 'EYE' && material.eyeDurabilityTints
      ? material.eyeDurabilityTints
      : material.durabilityTints
  const durabilityTier = Math.max(1, Math.ceil(currentDurability))
  const tintIndex = Math.min(
    durabilityTier - 1,
    durabilityTints.length - 1,
  )
  return durabilityTints[tintIndex]
}
