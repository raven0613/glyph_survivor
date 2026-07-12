export interface GlyphDamageEvent {
  readonly glyphId: number
  readonly amount: number
  readonly impactDirectionX: number
  readonly impactDirectionY: number
}

export interface GlyphDamageQueue {
  readonly count: number
  enqueue(
    glyphId: number,
    amount: number,
    impactDirectionX: number,
    impactDirectionY: number,
  ): void
  drain(consumer: (event: Readonly<GlyphDamageEvent>) => void): void
}

type MutableGlyphDamageEvent = {
  glyphId: number
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

    enqueue(
      glyphId: number,
      amount: number,
      impactDirectionX: number,
      impactDirectionY: number,
    ) {
      if (!Number.isSafeInteger(glyphId) || glyphId <= 0) {
        throw new RangeError('glyphId must be a positive safe integer.')
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new RangeError('damage amount must be finite and greater than zero.')
      }
      if (
        !Number.isFinite(impactDirectionX) ||
        !Number.isFinite(impactDirectionY)
      ) {
        throw new RangeError('impact direction must be finite.')
      }

      const event = events[eventCount] ?? {
        glyphId,
        amount,
        impactDirectionX,
        impactDirectionY,
      }
      event.glyphId = glyphId
      event.amount = amount
      event.impactDirectionX = impactDirectionX
      event.impactDirectionY = impactDirectionY
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
