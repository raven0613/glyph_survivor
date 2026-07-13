export const DAMAGE_TARGET_MODE = Object.freeze({
  SINGLE: 'SINGLE',
  AREA: 'AREA',
} as const)

export type DamageTargetMode =
  (typeof DAMAGE_TARGET_MODE)[keyof typeof DAMAGE_TARGET_MODE]

export interface GlyphDamageEvent {
  readonly ownerId: number
  readonly shapeX: number
  readonly shapeY: number
  readonly shapeRadius: number
  readonly targetMode: DamageTargetMode
  readonly amount: number
  readonly impactDirectionX: number
  readonly impactDirectionY: number
}

export interface GlyphDamageQueue {
  readonly count: number
  enqueue(event: Readonly<GlyphDamageEvent>): void
  drain(consumer: (event: Readonly<GlyphDamageEvent>) => void): void
}

type MutableGlyphDamageEvent = {
  ownerId: number
  shapeX: number
  shapeY: number
  shapeRadius: number
  targetMode: DamageTargetMode
  amount: number
  impactDirectionX: number
  impactDirectionY: number
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
        !Number.isFinite(input.shapeX) ||
        !Number.isFinite(input.shapeY) ||
        !Number.isFinite(input.shapeRadius) ||
        input.shapeRadius < 0
      ) {
        throw new RangeError('damage shape must contain finite circle values.')
      }
      if (
        !Number.isFinite(input.impactDirectionX) ||
        !Number.isFinite(input.impactDirectionY)
      ) {
        throw new RangeError('impact direction must be finite.')
      }

      const event = events[eventCount] ?? {
        ...input,
      }
      Object.assign(event, input)
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
