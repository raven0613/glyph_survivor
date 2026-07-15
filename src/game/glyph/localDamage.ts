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

export const DAMAGE_PRIMARY_SCOPE = Object.freeze({
  LOCKED_OWNER: 'LOCKED_OWNER',
  ALL_INTERSECTING_OWNERS: 'ALL_INTERSECTING_OWNERS',
} as const)

export type DamagePrimaryScope =
  (typeof DAMAGE_PRIMARY_SCOPE)[keyof typeof DAMAGE_PRIMARY_SCOPE]

export interface DamageSpreadProfile {
  readonly bandWidth: number
  readonly bandDamageRatios: readonly number[]
}

interface BaseGlyphDamageEvent {
  readonly attackEventId: number
  readonly visualRoleId: PlayerAttackVisualRoleId
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
  readonly damageSpreadProfile?: Readonly<DamageSpreadProfile> | null
  readonly impactStrengthMultiplier: number
  readonly impactDirectionX: number
  readonly impactDirectionY: number
  readonly rootKnockbackDistance?: number
  readonly rootKnockbackDirectionX?: number
  readonly rootKnockbackDirectionY?: number
}

export type GlyphDamageEvent = BaseGlyphDamageEvent &
  (
    | {
        readonly primaryScope: typeof DAMAGE_PRIMARY_SCOPE.LOCKED_OWNER
        readonly ownerId: number
      }
    | {
        readonly primaryScope:
          typeof DAMAGE_PRIMARY_SCOPE.ALL_INTERSECTING_OWNERS
        readonly ownerId?: never
      }
  )

export interface GlyphDamageQueue {
  readonly count: number
  enqueue(event: Readonly<GlyphDamageEvent>): void
  drain(consumer: (event: Readonly<GlyphDamageEvent>) => void): void
}

export interface DamageClaim {
  glyphId: number
  amount: number
  isSpread: boolean
  spreadVisualRoleId: PlayerAttackVisualRoleId | null
}

export interface DamageResolutionScratch {
  readonly claims: DamageClaim[]
  readonly claimIndexByGlyphId: Map<number, number>
  claimCount: number
}

export function createDamageResolutionScratch(): DamageResolutionScratch {
  return {
    claims: [],
    claimIndexByGlyphId: new Map(),
    claimCount: 0,
  }
}

type MutableGlyphDamageEvent = {
  attackEventId: number
  visualRoleId: PlayerAttackVisualRoleId
  primaryScope: DamagePrimaryScope
  ownerId?: number
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
  damageSpreadProfile: Readonly<DamageSpreadProfile> | null
  impactStrengthMultiplier: number
  impactDirectionX: number
  impactDirectionY: number
  rootKnockbackDistance: number
  rootKnockbackDirectionX: number
  rootKnockbackDirectionY: number
}

function validateDamageSpreadProfile(
  profile: Readonly<DamageSpreadProfile> | null,
): void {
  if (!profile) {
    return
  }
  if (!Number.isFinite(profile.bandWidth) || profile.bandWidth <= 0) {
    throw new RangeError('Damage Spread bandWidth must be finite and positive.')
  }
  if (profile.bandDamageRatios.length === 0) {
    throw new RangeError('Damage Spread must contain at least one band ratio.')
  }
  for (const ratio of profile.bandDamageRatios) {
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
      throw new RangeError('Damage Spread ratios must be finite values in (0, 1].')
    }
  }
}

/** Reuses event slots so collision-heavy steps do not allocate per impact. */
export function createGlyphDamageQueue(): GlyphDamageQueue {
  const events: MutableGlyphDamageEvent[] = []
  const activeEventIds = new Set<number>()
  let eventCount = 0

  return Object.freeze({
    get count() {
      return eventCount
    },

    enqueue(input: Readonly<GlyphDamageEvent>) {
      if (
        !Number.isSafeInteger(input.attackEventId) ||
        input.attackEventId <= 0
      ) {
        throw new RangeError('attackEventId must be a positive safe integer.')
      }
      if (activeEventIds.has(input.attackEventId)) {
        throw new Error(`Duplicate active attackEventId ${input.attackEventId}.`)
      }
      if (!isPlayerAttackVisualRoleId(input.visualRoleId)) {
        throw new TypeError('Damage visualRoleId must be registered.')
      }
      if (
        input.primaryScope !== DAMAGE_PRIMARY_SCOPE.LOCKED_OWNER &&
        input.primaryScope !== DAMAGE_PRIMARY_SCOPE.ALL_INTERSECTING_OWNERS
      ) {
        throw new TypeError('Unknown damage primary scope.')
      }
      if (
        input.primaryScope === DAMAGE_PRIMARY_SCOPE.LOCKED_OWNER &&
        (!Number.isSafeInteger(input.ownerId) || input.ownerId <= 0)
      ) {
        throw new RangeError('Locked ownerId must be a positive safe integer.')
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

      const damageSpreadProfile = input.damageSpreadProfile ?? null
      validateDamageSpreadProfile(damageSpreadProfile)
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
      event.ownerId =
        input.primaryScope === DAMAGE_PRIMARY_SCOPE.LOCKED_OWNER
          ? input.ownerId
          : undefined
      event.damageSpreadProfile = damageSpreadProfile
      event.rootKnockbackDistance = rootKnockbackDistance
      event.rootKnockbackDirectionX = rootKnockbackDirectionX
      event.rootKnockbackDirectionY = rootKnockbackDirectionY
      events[eventCount] = event
      activeEventIds.add(input.attackEventId)
      eventCount += 1
    },

    drain(consumer: (event: Readonly<GlyphDamageEvent>) => void) {
      try {
        for (let index = 0; index < eventCount; index += 1) {
          consumer(events[index] as GlyphDamageEvent)
        }
      } finally {
        eventCount = 0
        activeEventIds.clear()
      }
    },
  })
}
import {
  isPlayerAttackVisualRoleId,
  type PlayerAttackVisualRoleId,
} from '../content/visuals/combatVisualTheme.ts'
