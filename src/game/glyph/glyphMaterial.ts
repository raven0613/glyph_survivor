export const GLYPH_MATERIAL = Object.freeze({
  BASIC: 'BASIC',
  ROCK: 'ROCK',
  SLIME: 'SLIME',
} as const)

export type GlyphMaterialId =
  (typeof GLYPH_MATERIAL)[keyof typeof GLYPH_MATERIAL]

export interface GlyphMaterialDefinition {
  readonly id: GlyphMaterialId
  readonly hitFlashDurationMs: number
  readonly hitPulseScale: number
  readonly hitBurstCharacters: readonly string[]
  readonly hitBurstParticleCount: number
  readonly hitBurstDistance: number
  readonly hitBurstScale: number
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
    hitFlashDurationMs: 110,
    hitPulseScale: 1.12,
    hitBurstCharacters: Object.freeze(['+', '*']),
    hitBurstParticleCount: 3,
    hitBurstDistance: 34,
    hitBurstScale: 0.34,
    knockbackImpulse: 70,
    springStrength: 55,
    damping: 14,
    maximumOffset: 8,
  }),
  [GLYPH_MATERIAL.ROCK]: Object.freeze({
    id: GLYPH_MATERIAL.ROCK,
    hitFlashDurationMs: 90,
    hitPulseScale: 1.06,
    hitBurstCharacters: Object.freeze(['#', '+']),
    hitBurstParticleCount: 2,
    hitBurstDistance: 18,
    hitBurstScale: 0.28,
    knockbackImpulse: 22,
    springStrength: 90,
    damping: 20,
    maximumOffset: 3,
  }),
  [GLYPH_MATERIAL.SLIME]: Object.freeze({
    id: GLYPH_MATERIAL.SLIME,
    hitFlashDurationMs: 140,
    hitPulseScale: 1.16,
    hitBurstCharacters: Object.freeze(['~', '.', '*']),
    hitBurstParticleCount: 5,
    hitBurstDistance: 42,
    hitBurstScale: 0.3,
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
