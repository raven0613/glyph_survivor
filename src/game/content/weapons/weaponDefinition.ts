import {
  getPrintableAsciiCharacter,
  getPrintableAsciiGlyphFrame,
} from '../../glyph/glyphFrame.ts'
import {
  DAMAGE_TARGET_MODE,
  type DamageTargetMode,
} from '../../glyph/localDamage.ts'
import type { ProjectileTrackingProfile } from './projectileTracking.ts'

export const TARGET_STRATEGY = Object.freeze({
  AIM_ASSISTED: 'AIM_ASSISTED',
} as const)

export type TargetStrategyId =
  (typeof TARGET_STRATEGY)[keyof typeof TARGET_STRATEGY]

export const ATTACK_PATTERN = Object.freeze({
  SINGLE_PROJECTILE: 'SINGLE_PROJECTILE',
} as const)

export type AttackPatternId =
  (typeof ATTACK_PATTERN)[keyof typeof ATTACK_PATTERN]

export const DAMAGE_SHAPE = Object.freeze({
  POINT: 'POINT',
} as const)

export type DamageShapeId =
  (typeof DAMAGE_SHAPE)[keyof typeof DAMAGE_SHAPE]

export const DESTRUCTION_PROFILE = Object.freeze({
  MATERIAL_IMPACT: 'MATERIAL_IMPACT',
} as const)

export type DestructionProfileId =
  (typeof DESTRUCTION_PROFILE)[keyof typeof DESTRUCTION_PROFILE]

export interface SingleProjectileAttackPattern {
  readonly kind: typeof ATTACK_PATTERN.SINGLE_PROJECTILE
  readonly muzzleDistance: number
  readonly projectileSpeed: number
  readonly projectileLifetimeMs: number
}

export interface PointDamageShape {
  readonly kind: typeof DAMAGE_SHAPE.POINT
  readonly radius: number
  readonly targetMode: DamageTargetMode
}

export interface ProjectilePresentation {
  readonly glyphFrame: number
  readonly scale: number
  readonly alpha: number
  readonly tint: number
}

export interface WeaponCombatProfile {
  readonly fireIntervalMs: number
  readonly targetStrategyId: TargetStrategyId
  readonly attackPattern: SingleProjectileAttackPattern
  readonly damageShape: PointDamageShape
  readonly destructionProfileId: DestructionProfileId
  readonly damageAmount: number
  readonly trackingProfile: ProjectileTrackingProfile
  readonly projectilePresentation: ProjectilePresentation
}

export interface WeaponDefinitionInput {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly identityGlyph: string
  readonly moduleSlotCount: number
  readonly baseProfile: WeaponCombatProfile
}

export type WeaponDefinition = Readonly<WeaponDefinitionInput>

function requireNonEmptyText(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new TypeError(`${name} must not be empty.`)
  }
}

function requireFiniteAtLeast(
  value: number,
  minimum: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value < minimum) {
    throw new RangeError(`${name} must be finite and at least ${minimum}.`)
  }
}

function requireFiniteGreaterThanZero(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and greater than zero.`)
  }
}

function validateTrackingProfile(profile: ProjectileTrackingProfile): void {
  requireFiniteGreaterThanZero(profile.range, 'tracking range')
  requireFiniteAtLeast(profile.responsiveness, 0, 'tracking responsiveness')
  if (
    !Number.isFinite(profile.maximumCorrectionCos) ||
    profile.maximumCorrectionCos < -1 ||
    profile.maximumCorrectionCos > 1
  ) {
    throw new RangeError('maximumCorrectionCos must be between -1 and 1.')
  }
  if (
    profile.retargetIntervalMs !== Number.POSITIVE_INFINITY &&
    (!Number.isFinite(profile.retargetIntervalMs) ||
      profile.retargetIntervalMs < 0)
  ) {
    throw new RangeError(
      'retargetIntervalMs must be non-negative or positive infinity.',
    )
  }
}

/** Validates and deeply freezes one immutable weapon content definition. */
export function defineWeapon(input: WeaponDefinitionInput): WeaponDefinition {
  requireNonEmptyText(input.id, 'Weapon definition id')
  requireNonEmptyText(input.title, 'Weapon title')
  requireNonEmptyText(input.description, 'Weapon description')
  getPrintableAsciiGlyphFrame(input.identityGlyph)

  if (!Number.isSafeInteger(input.moduleSlotCount) || input.moduleSlotCount <= 0) {
    throw new RangeError('moduleSlotCount must be a positive safe integer.')
  }

  const profile = input.baseProfile
  if (profile.targetStrategyId !== TARGET_STRATEGY.AIM_ASSISTED) {
    throw new TypeError('Unknown targetStrategyId.')
  }
  if (profile.attackPattern.kind !== ATTACK_PATTERN.SINGLE_PROJECTILE) {
    throw new TypeError('Unknown attack pattern.')
  }
  if (profile.damageShape.kind !== DAMAGE_SHAPE.POINT) {
    throw new TypeError('Unknown damage shape.')
  }
  if (
    profile.destructionProfileId !== DESTRUCTION_PROFILE.MATERIAL_IMPACT
  ) {
    throw new TypeError('Unknown destructionProfileId.')
  }
  requireFiniteGreaterThanZero(profile.fireIntervalMs, 'fireIntervalMs')
  requireFiniteAtLeast(
    profile.attackPattern.muzzleDistance,
    0,
    'muzzleDistance',
  )
  requireFiniteGreaterThanZero(
    profile.attackPattern.projectileSpeed,
    'projectileSpeed',
  )
  requireFiniteGreaterThanZero(
    profile.attackPattern.projectileLifetimeMs,
    'projectileLifetimeMs',
  )
  requireFiniteAtLeast(profile.damageShape.radius, 0, 'damage shape radius')
  if (
    profile.damageShape.targetMode !== DAMAGE_TARGET_MODE.SINGLE &&
    profile.damageShape.targetMode !== DAMAGE_TARGET_MODE.AREA
  ) {
    throw new TypeError('Unknown damage target mode.')
  }
  if (profile.damageShape.targetMode !== DAMAGE_TARGET_MODE.SINGLE) {
    throw new TypeError('Point damage shapes must use single target mode.')
  }
  requireFiniteGreaterThanZero(profile.damageAmount, 'damageAmount')
  validateTrackingProfile(profile.trackingProfile)

  getPrintableAsciiCharacter(profile.projectilePresentation.glyphFrame)
  requireFiniteGreaterThanZero(
    profile.projectilePresentation.scale,
    'projectile presentation scale',
  )
  if (
    !Number.isFinite(profile.projectilePresentation.alpha) ||
    profile.projectilePresentation.alpha < 0 ||
    profile.projectilePresentation.alpha > 1
  ) {
    throw new RangeError('projectile presentation alpha must be between 0 and 1.')
  }
  if (
    !Number.isSafeInteger(profile.projectilePresentation.tint) ||
    profile.projectilePresentation.tint < 0 ||
    profile.projectilePresentation.tint > 0xffffff
  ) {
    throw new RangeError('projectile presentation tint must be a 24-bit color.')
  }

  return Object.freeze({
    id: input.id,
    title: input.title,
    description: input.description,
    identityGlyph: input.identityGlyph,
    moduleSlotCount: input.moduleSlotCount,
    baseProfile: Object.freeze({
      ...profile,
      attackPattern: Object.freeze({ ...profile.attackPattern }),
      damageShape: Object.freeze({ ...profile.damageShape }),
      trackingProfile: Object.freeze({ ...profile.trackingProfile }),
      projectilePresentation: Object.freeze({
        ...profile.projectilePresentation,
      }),
    }),
  })
}
