export interface GlyphHitPresentationInput {
  readonly baseAlpha: number
  readonly baseScale: number
  readonly baseTint: number
  readonly hitTint: number
  readonly hitFlashRemainingMs: number
  readonly hitFlashDurationMs: number
  readonly hitPulseScale: number
  readonly hitAlphaFloor: number
}

export interface GlyphHitPresentation {
  readonly alpha: number
  readonly scale: number
  readonly tint: number
  readonly intensity: number
}

function mixColorChannel(base: number, hit: number, intensity: number): number {
  return Math.round(base + (hit - base) * intensity)
}

function mixRgb(baseTint: number, hitTint: number, intensity: number): number {
  const red = mixColorChannel(
    (baseTint >> 16) & 0xff,
    (hitTint >> 16) & 0xff,
    intensity,
  )
  const green = mixColorChannel(
    (baseTint >> 8) & 0xff,
    (hitTint >> 8) & 0xff,
    intensity,
  )
  const blue = mixColorChannel(baseTint & 0xff, hitTint & 0xff, intensity)
  return (red << 16) | (green << 8) | blue
}

/** Derives a render-only pulse without changing Glyph collision or durability. */
export function calculateGlyphHitPresentation({
  baseAlpha,
  baseScale,
  baseTint,
  hitTint,
  hitFlashRemainingMs,
  hitFlashDurationMs,
  hitPulseScale,
  hitAlphaFloor,
}: GlyphHitPresentationInput): GlyphHitPresentation {
  if (hitFlashRemainingMs <= 0 || hitFlashDurationMs <= 0) {
    return { alpha: baseAlpha, scale: baseScale, tint: baseTint, intensity: 0 }
  }

  const remainingRatio = Math.min(
    1,
    hitFlashRemainingMs / hitFlashDurationMs,
  )
  const intensity = Math.sqrt(remainingRatio)
  const maximumHitAlpha = Math.max(baseAlpha, hitAlphaFloor)

  return {
    alpha: baseAlpha + (maximumHitAlpha - baseAlpha) * intensity,
    scale: baseScale * (1 + (hitPulseScale - 1) * intensity),
    tint: mixRgb(baseTint, hitTint, intensity),
    intensity,
  }
}
