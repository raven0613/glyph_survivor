export const RHOMBUS_COLLAPSE_PHASE = Object.freeze({
  BRIGHTNESS_LIFT: 'BRIGHTNESS_LIFT',
  FALLING: 'FALLING',
  SETTLING: 'SETTLING',
  COMPLETE: 'COMPLETE',
} as const)

export type RhombusCollapsePhase =
  (typeof RHOMBUS_COLLAPSE_PHASE)[keyof typeof RHOMBUS_COLLAPSE_PHASE]

export interface RhombusCollapseGlyphPlan {
  readonly glyphId: number
  readonly bodySlotId: number
  readonly startX: number
  readonly startY: number
  readonly startRotation: number
  readonly landingX: number
  readonly landingY: number
  readonly targetX: number
  readonly targetY: number
  readonly targetRotation: number
  readonly fallDelayMs: number
}

export interface RhombusCollapseState {
  readonly ownerId: number
  readonly encounterId: number
  readonly glyphPlans: readonly Readonly<RhombusCollapseGlyphPlan>[]
  readonly glyphPlanById: ReadonlyMap<number, Readonly<RhombusCollapseGlyphPlan>>
  phase: RhombusCollapsePhase
}
