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
  PLAYER_AIM: 'PLAYER_AIM',
  OWNER_RELATIVE: 'OWNER_RELATIVE',
} as const)

export type TargetStrategyId =
  (typeof TARGET_STRATEGY)[keyof typeof TARGET_STRATEGY]

export const ATTACK_PATTERN = Object.freeze({
  SINGLE_PROJECTILE: 'SINGLE_PROJECTILE',
  PULSED_CONE: 'PULSED_CONE',
  PERSISTENT_ORBIT: 'PERSISTENT_ORBIT',
} as const)

export type AttackPatternId =
  (typeof ATTACK_PATTERN)[keyof typeof ATTACK_PATTERN]

export const DAMAGE_SHAPE = Object.freeze({
  POINT: 'POINT',
  CONE: 'CONE',
  CIRCLE: 'CIRCLE',
} as const)

export type DamageShapeId =
  (typeof DAMAGE_SHAPE)[keyof typeof DAMAGE_SHAPE]

export const DESTRUCTION_PROFILE = Object.freeze({
  MATERIAL_IMPACT: 'MATERIAL_IMPACT',
  KNOCKBACK_CONTACT: 'KNOCKBACK_CONTACT',
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

export interface PulsedConeAttackPattern {
  readonly kind: typeof ATTACK_PATTERN.PULSED_CONE
  readonly muzzleDistance: number
}

export interface ConeDamageShape {
  readonly kind: typeof DAMAGE_SHAPE.CONE
  readonly range: number
  readonly fullAngleRadians: number
  readonly targetMode: typeof DAMAGE_TARGET_MODE.AREA
}

export interface PersistentOrbitAttackPattern {
  readonly kind: typeof ATTACK_PATTERN.PERSISTENT_ORBIT
  readonly ballCount: number
  readonly orbitRadius: number
  readonly angularSpeedRevolutionsPerSecond: number
}

export interface CircleDamageShape {
  readonly kind: typeof DAMAGE_SHAPE.CIRCLE
  readonly radius: number
  readonly targetMode: typeof DAMAGE_TARGET_MODE.AREA
}

export interface ProjectilePresentation {
  readonly glyphFrame: number
  readonly scale: number
  readonly alpha: number
  readonly tint: number
}

interface BaseWeaponCombatProfile {
  readonly destructionProfileId: DestructionProfileId
  readonly damageAmount: number
}

export interface ProjectileWeaponCombatProfile extends BaseWeaponCombatProfile {
  readonly fireIntervalMs: number
  readonly targetStrategyId: typeof TARGET_STRATEGY.AIM_ASSISTED
  readonly attackPattern: SingleProjectileAttackPattern
  readonly damageShape: PointDamageShape
  readonly trackingProfile: ProjectileTrackingProfile
  readonly projectilePresentation: ProjectilePresentation
}

export interface FlamePresentation {
  readonly durationMs: number
  readonly particleCount: number
  readonly innerTint: number
  readonly outerTint: number
}

export interface ConeWeaponCombatProfile extends BaseWeaponCombatProfile {
  readonly fireIntervalMs: number
  readonly targetStrategyId: typeof TARGET_STRATEGY.PLAYER_AIM
  readonly attackPattern: PulsedConeAttackPattern
  readonly damageShape: ConeDamageShape
  readonly flamePresentation: FlamePresentation
}

export type OrbitPresentation = ProjectilePresentation

export interface OrbitWeaponCombatProfile extends BaseWeaponCombatProfile {
  readonly targetStrategyId: typeof TARGET_STRATEGY.OWNER_RELATIVE
  readonly attackPattern: PersistentOrbitAttackPattern
  readonly damageShape: CircleDamageShape
  readonly rehitCooldownMs: number
  readonly rootKnockbackDistance: number
  readonly orbitPresentation: OrbitPresentation
}

export type WeaponCombatProfile =
  | ProjectileWeaponCombatProfile
  | ConeWeaponCombatProfile
  | OrbitWeaponCombatProfile

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

function validateGlyphPresentation(
  presentation: ProjectilePresentation,
  name: string,
): void {
  getPrintableAsciiCharacter(presentation.glyphFrame)
  requireFiniteGreaterThanZero(presentation.scale, `${name} scale`)
  requireFiniteAtLeast(presentation.alpha, 0, `${name} alpha`)
  if (presentation.alpha > 1) {
    throw new RangeError(`${name} alpha must be between 0 and 1.`)
  }
  requireFiniteAtLeast(presentation.tint, 0, `${name} tint`)
  if (
    !Number.isSafeInteger(presentation.tint) ||
    presentation.tint > 0xffffff
  ) {
    throw new RangeError(`${name} tint must be a 24-bit color.`)
  }
}

/** Validates and deeply freezes one immutable weapon content definition. */
export function defineWeapon(input: WeaponDefinitionInput): WeaponDefinition {
  requireNonEmptyText(input.id, 'Weapon definition id')
  requireNonEmptyText(input.title, 'Weapon title')
  requireNonEmptyText(input.description, 'Weapon description')
  getPrintableAsciiGlyphFrame(input.identityGlyph)

  if (input.moduleSlotCount !== 4) {
    throw new RangeError('moduleSlotCount must be exactly 4 for first-pass weapons.')
  }

  const profile = input.baseProfile
  requireFiniteGreaterThanZero(profile.damageAmount, 'damageAmount')

  let preparedProfile: WeaponCombatProfile
  if (profile.targetStrategyId === TARGET_STRATEGY.AIM_ASSISTED) {
    if (
      profile.attackPattern.kind !== ATTACK_PATTERN.SINGLE_PROJECTILE ||
      profile.damageShape.kind !== DAMAGE_SHAPE.POINT
    ) {
      throw new TypeError('Projectile profile strategy and shape must agree.')
    }
    if (profile.destructionProfileId !== DESTRUCTION_PROFILE.MATERIAL_IMPACT) {
      throw new TypeError('Projectile destruction profile must use material impact.')
    }
    requireFiniteGreaterThanZero(profile.fireIntervalMs, 'fireIntervalMs')
    requireFiniteAtLeast(profile.attackPattern.muzzleDistance, 0, 'muzzleDistance')
    requireFiniteGreaterThanZero(profile.attackPattern.projectileSpeed, 'projectileSpeed')
    requireFiniteGreaterThanZero(profile.attackPattern.projectileLifetimeMs, 'projectileLifetimeMs')
    requireFiniteAtLeast(profile.damageShape.radius, 0, 'damage shape radius')
    if (profile.damageShape.targetMode !== DAMAGE_TARGET_MODE.SINGLE) {
      throw new TypeError('Point damage shapes must use single target mode.')
    }
    validateTrackingProfile(profile.trackingProfile)
    validateGlyphPresentation(
      profile.projectilePresentation,
      'projectile presentation',
    )
    preparedProfile = Object.freeze({
      ...profile,
      attackPattern: Object.freeze({ ...profile.attackPattern }),
      damageShape: Object.freeze({ ...profile.damageShape }),
      trackingProfile: Object.freeze({ ...profile.trackingProfile }),
      projectilePresentation: Object.freeze({ ...profile.projectilePresentation }),
    })
  } else if (profile.targetStrategyId === TARGET_STRATEGY.PLAYER_AIM) {
    if (
      profile.attackPattern.kind !== ATTACK_PATTERN.PULSED_CONE ||
      profile.damageShape.kind !== DAMAGE_SHAPE.CONE
    ) {
      throw new TypeError('Cone profile strategy and shape must agree.')
    }
    if (profile.destructionProfileId !== DESTRUCTION_PROFILE.MATERIAL_IMPACT) {
      throw new TypeError('Cone destruction profile must use material impact.')
    }
    requireFiniteGreaterThanZero(profile.fireIntervalMs, 'fireIntervalMs')
    requireFiniteAtLeast(profile.attackPattern.muzzleDistance, 0, 'muzzleDistance')
    requireFiniteGreaterThanZero(profile.damageShape.range, 'cone range')
    requireFiniteGreaterThanZero(profile.damageShape.fullAngleRadians, 'cone angle')
    if (profile.damageShape.fullAngleRadians > Math.PI * 2) {
      throw new RangeError('cone angle must not exceed a full circle.')
    }
    requireFiniteGreaterThanZero(profile.flamePresentation.durationMs, 'flame duration')
    if (!Number.isSafeInteger(profile.flamePresentation.particleCount) || profile.flamePresentation.particleCount <= 0) {
      throw new RangeError('flame particleCount must be a positive safe integer.')
    }
    for (const tint of [profile.flamePresentation.innerTint, profile.flamePresentation.outerTint]) {
      if (!Number.isSafeInteger(tint) || tint < 0 || tint > 0xffffff) {
        throw new RangeError('flame tint must be a 24-bit color.')
      }
    }
    preparedProfile = Object.freeze({
      ...profile,
      attackPattern: Object.freeze({ ...profile.attackPattern }),
      damageShape: Object.freeze({ ...profile.damageShape }),
      flamePresentation: Object.freeze({ ...profile.flamePresentation }),
    })
  } else if (profile.targetStrategyId === TARGET_STRATEGY.OWNER_RELATIVE) {
    if (
      profile.attackPattern.kind !== ATTACK_PATTERN.PERSISTENT_ORBIT ||
      profile.damageShape.kind !== DAMAGE_SHAPE.CIRCLE
    ) {
      throw new TypeError('Orbit profile strategy and shape must agree.')
    }
    if (
      profile.destructionProfileId !== DESTRUCTION_PROFILE.KNOCKBACK_CONTACT
    ) {
      throw new TypeError('Orbit destruction profile must use knockback contact.')
    }
    if (
      !Number.isSafeInteger(profile.attackPattern.ballCount) ||
      profile.attackPattern.ballCount <= 0
    ) {
      throw new RangeError('orbit ballCount must be a positive safe integer.')
    }
    requireFiniteGreaterThanZero(profile.attackPattern.orbitRadius, 'orbitRadius')
    requireFiniteGreaterThanZero(
      profile.attackPattern.angularSpeedRevolutionsPerSecond,
      'angularSpeedRevolutionsPerSecond',
    )
    requireFiniteGreaterThanZero(profile.damageShape.radius, 'orbit damage radius')
    if (profile.damageShape.targetMode !== DAMAGE_TARGET_MODE.AREA) {
      throw new TypeError('Orbit Circle damage shapes must use area target mode.')
    }
    requireFiniteGreaterThanZero(profile.rehitCooldownMs, 'rehitCooldownMs')
    requireFiniteGreaterThanZero(
      profile.rootKnockbackDistance,
      'rootKnockbackDistance',
    )
    validateGlyphPresentation(profile.orbitPresentation, 'orbit presentation')
    preparedProfile = Object.freeze({
      ...profile,
      attackPattern: Object.freeze({ ...profile.attackPattern }),
      damageShape: Object.freeze({ ...profile.damageShape }),
      orbitPresentation: Object.freeze({ ...profile.orbitPresentation }),
    })
  } else {
    throw new TypeError('Unknown targetStrategyId.')
  }

  return Object.freeze({
    id: input.id,
    title: input.title,
    description: input.description,
    identityGlyph: input.identityGlyph,
    moduleSlotCount: input.moduleSlotCount,
    baseProfile: preparedProfile,
  })
}
