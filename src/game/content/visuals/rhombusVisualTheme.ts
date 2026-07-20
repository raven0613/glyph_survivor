import { getPrintableAsciiGlyphFrame } from '../../glyph/glyphFrame.ts'
import type {
  RhombusEffectAppearance,
  VisualColor,
} from './combatVisualThemeTypes.ts'

interface RhombusVisualValidators {
  validateColor(color: VisualColor, name: string): void
  positive(value: number, name: string): void
  range(value: number, minimum: number, maximum: number, name: string): void
}

export function validateAndFreezeRhombusEffectAppearance(
  appearance: RhombusEffectAppearance,
  validators: Readonly<RhombusVisualValidators>,
): RhombusEffectAppearance {
  const spike = appearance.hostileSpike
  validators.validateColor(spike.active, 'RHOMBUS hostile spike active')
  validators.validateColor(
    spike.dissipation,
    'RHOMBUS hostile spike dissipation',
  )
  validators.positive(
    spike.dissipationDurationMs,
    'RHOMBUS spike dissipationDurationMs',
  )
  validators.range(
    spike.fadeOutStartRatio,
    0,
    0.99,
    'RHOMBUS spike fadeOutStartRatio',
  )
  if (!Number.isSafeInteger(spike.particleCount) || spike.particleCount <= 0) {
    throw new RangeError('RHOMBUS spike particleCount must be a positive safe integer.')
  }
  validators.positive(spike.particleDistance, 'RHOMBUS spike particleDistance')
  validators.positive(spike.particleScale, 'RHOMBUS spike particleScale')
  if (spike.particleCharacters.length === 0) {
    throw new Error('RHOMBUS spike particles require at least one character.')
  }
  spike.particleCharacters.forEach(getPrintableAsciiGlyphFrame)

  const collapse = appearance.collapse
  validators.validateColor(
    collapse.brightnessLift,
    'RHOMBUS collapse brightnessLift',
  )
  validators.validateColor(collapse.settledPile, 'RHOMBUS collapse settledPile')
  validators.positive(
    collapse.brightnessLiftDurationMs,
    'RHOMBUS collapse brightnessLiftDurationMs',
  )

  return Object.freeze({
    hostileSpike: Object.freeze({
      ...spike,
      active: Object.freeze({ ...spike.active }),
      dissipation: Object.freeze({ ...spike.dissipation }),
      particleCharacters: Object.freeze([...spike.particleCharacters]),
    }),
    collapse: Object.freeze({
      ...collapse,
      brightnessLift: Object.freeze({ ...collapse.brightnessLift }),
      settledPile: Object.freeze({ ...collapse.settledPile }),
    }),
  })
}
