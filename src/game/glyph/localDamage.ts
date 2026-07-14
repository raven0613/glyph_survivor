export const DAMAGE_TARGET_MODE = Object.freeze({
  SINGLE: 'SINGLE',
  AREA: 'AREA',
} as const)

export type DamageTargetMode =
  (typeof DAMAGE_TARGET_MODE)[keyof typeof DAMAGE_TARGET_MODE]

export const LOCAL_DAMAGE_SHAPE = Object.freeze({
  CIRCLE: 'CIRCLE',
  CONE: 'CONE',
} as const)

export type LocalDamageShapeKind =
  (typeof LOCAL_DAMAGE_SHAPE)[keyof typeof LOCAL_DAMAGE_SHAPE]

export interface GlyphDamageEvent {
  readonly ownerId: number
  readonly shapeKind: LocalDamageShapeKind
  readonly shapeX: number
  readonly shapeY: number
  readonly shapeRadius: number
  readonly shapeDirectionX: number
  readonly shapeDirectionY: number
  readonly shapeRange: number
  readonly shapeHalfAngleRadians: number
  readonly targetMode: DamageTargetMode
  readonly amount: number
  readonly impactStrengthMultiplier: number
  readonly impactDirectionX: number
  readonly impactDirectionY: number
  readonly rootKnockbackDistance?: number
  readonly rootKnockbackDirectionX?: number
  readonly rootKnockbackDirectionY?: number
}

export interface GlyphDamageQueue {
  readonly count: number
  enqueue(event: Readonly<GlyphDamageEvent>): void
  drain(consumer: (event: Readonly<GlyphDamageEvent>) => void): void
}

type MutableGlyphDamageEvent = {
  ownerId: number
  shapeKind: LocalDamageShapeKind
  shapeX: number
  shapeY: number
  shapeRadius: number
  shapeDirectionX: number
  shapeDirectionY: number
  shapeRange: number
  shapeHalfAngleRadians: number
  targetMode: DamageTargetMode
  amount: number
  impactStrengthMultiplier: number
  impactDirectionX: number
  impactDirectionY: number
  rootKnockbackDistance: number
  rootKnockbackDirectionX: number
  rootKnockbackDirectionY: number
}

/** Reuses event slots so collision-heavy steps do not allocate per impact. */
export function createGlyphDamageQueue(): GlyphDamageQueue {
  const events: MutableGlyphDamageEvent[] = []
  let eventCount = 0

  return Object.freeze({
    get count() {
      return eventCount
    },

    enqueue(input: Readonly<GlyphDamageEvent>) {
      if (!Number.isSafeInteger(input.ownerId) || input.ownerId <= 0) {
        throw new RangeError('ownerId must be a positive safe integer.')
      }
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        throw new RangeError('damage amount must be finite and greater than zero.')
      }
      if (
        !Number.isFinite(input.impactStrengthMultiplier) ||
        input.impactStrengthMultiplier <= 0
      ) {
        throw new RangeError(
          'impactStrengthMultiplier must be finite and greater than zero.',
        )
      }
      if (
        input.shapeKind !== LOCAL_DAMAGE_SHAPE.CIRCLE &&
        input.shapeKind !== LOCAL_DAMAGE_SHAPE.CONE
      ) {
        throw new TypeError('Unknown local damage shape kind.')
      }
      if (
        !Number.isFinite(input.shapeX) ||
        !Number.isFinite(input.shapeY) ||
        !Number.isFinite(input.shapeRadius) ||
        input.shapeRadius < 0
      ) {
        throw new RangeError('damage shape must contain finite origin values.')
      }
      if (
        input.shapeKind === LOCAL_DAMAGE_SHAPE.CONE &&
        (!Number.isFinite(input.shapeDirectionX) ||
          !Number.isFinite(input.shapeDirectionY) ||
          Math.hypot(input.shapeDirectionX, input.shapeDirectionY) === 0 ||
          !Number.isFinite(input.shapeRange) ||
          input.shapeRange <= 0 ||
          !Number.isFinite(input.shapeHalfAngleRadians) ||
          input.shapeHalfAngleRadians <= 0)
      ) {
        throw new RangeError('cone damage shape values are invalid.')
      }
      if (
        !Number.isFinite(input.impactDirectionX) ||
        !Number.isFinite(input.impactDirectionY)
      ) {
        throw new RangeError('impact direction must be finite.')
      }

      const rootKnockbackDistance = input.rootKnockbackDistance ?? 0
      const rootKnockbackDirectionX = input.rootKnockbackDirectionX ?? 0
      const rootKnockbackDirectionY = input.rootKnockbackDirectionY ?? 0
      if (
        !Number.isFinite(rootKnockbackDistance) ||
        rootKnockbackDistance < 0 ||
        !Number.isFinite(rootKnockbackDirectionX) ||
        !Number.isFinite(rootKnockbackDirectionY)
      ) {
        throw new RangeError('root knockback values must be finite and non-negative.')
      }

      const event = events[eventCount] ?? ({} as MutableGlyphDamageEvent)
      Object.assign(event, input)
      event.rootKnockbackDistance = rootKnockbackDistance
      event.rootKnockbackDirectionX = rootKnockbackDirectionX
      event.rootKnockbackDirectionY = rootKnockbackDirectionY
      events[eventCount] = event
      eventCount += 1
    },

    drain(consumer: (event: Readonly<GlyphDamageEvent>) => void) {
      try {
        for (let index = 0; index < eventCount; index += 1) {
          consumer(events[index])
        }
      } finally {
        eventCount = 0
      }
    },
  })
}
