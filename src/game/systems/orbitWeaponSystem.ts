import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'
import {
  DAMAGE_PRIMARY_SCOPE,
  LOCAL_DAMAGE_SHAPE,
} from '../glyph/localDamage.ts'
import type { OrbitAttackState } from '../runtime/worldEntities.ts'
import { isEnemyOutlineCollisionPhase } from '../runtime/worldEntities.ts'
import type { WeaponInstance } from '../runtime/weaponLoadout.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { getNextDamageEventId } from '../runtime/worldState.ts'
import { getFirstSegmentCircleContactTime } from './combatGeometry.ts'
import type { ResolvedOrbitWeaponProfile } from './resolveWeaponProfile.ts'
import { getPlayerAttackAppearance } from '../content/visuals/combatVisualTheme.ts'

const FULL_CIRCLE_RADIANS = Math.PI * 2

function findOrbit(
  world: WorldState,
  weaponInstanceId: number,
  ballIndex: number,
): OrbitAttackState | undefined {
  for (const orbit of world.orbitAttacks) {
    if (
      orbit.sourceWeaponInstanceId === weaponInstanceId &&
      orbit.ballIndex === ballIndex
    ) {
      return orbit
    }
  }
  return undefined
}

function createOrbit(
  world: WorldState,
  weapon: WeaponInstance,
  profile: ResolvedOrbitWeaponProfile,
  ballIndex: number,
  phaseRadians: number,
  currentRadius: number,
): OrbitAttackState {
  const x = world.player.x + Math.cos(phaseRadians) * currentRadius
  const y = world.player.y + Math.sin(phaseRadians) * currentRadius
  const appearance = getPlayerAttackAppearance(
    world.content.combatVisualTheme,
    profile.orbitPresentation.visualRoleId,
  )
  const orbit: OrbitAttackState = {
    id: world.nextOrbitAttackId,
    sourceWeaponInstanceId: weapon.id,
    sourceEquipmentSlot: weapon.equipmentSlot,
    sourceProfileRevision: weapon.profileRevision,
    ballIndex,
    phaseRadians,
    radialPhaseRadians: phaseRadians,
    currentRadius,
    x,
    y,
    previousX: x,
    previousY: y,
    damageRadius: profile.damageShape.radius,
    damage: profile.damageAmount,
    rehitCooldownMs: profile.rehitCooldownMs,
    rootKnockbackDistance: profile.rootKnockbackDistance,
    impactStrengthMultiplier: profile.impactStrengthMultiplier,
    damageSpreadProfile: profile.damageSpreadProfile,
    glyphFrame: profile.orbitPresentation.glyphFrame,
    visualRoleId: profile.orbitPresentation.visualRoleId,
    visualScale: profile.orbitPresentation.scale,
    visualAlpha: appearance.core.alpha,
    visualTint: appearance.core.tint,
    nextAllowedHitTimeByOwner: new Map(),
  }
  world.nextOrbitAttackId += 1
  world.orbitAttacks.push(orbit)
  world.diagnostics.attackEmissionCount += 1
  return orbit
}

function normalizePhase(phaseRadians: number): number {
  return (phaseRadians + FULL_CIRCLE_RADIANS) % FULL_CIRCLE_RADIANS
}

function getOrbitRadius(
  baseRadius: number,
  maximumRadius: number,
  radialPhaseRadians: number,
): number {
  const outwardProgress = (1 - Math.cos(radialPhaseRadians)) / 2
  return baseRadius + (maximumRadius - baseRadius) * outwardProgress
}

function updateResolvedValues(
  world: WorldState,
  orbit: OrbitAttackState,
  profile: ResolvedOrbitWeaponProfile,
): void {
  const appearance = getPlayerAttackAppearance(
    world.content.combatVisualTheme,
    profile.orbitPresentation.visualRoleId,
  )
  orbit.damageRadius = profile.damageShape.radius
  orbit.damage = profile.damageAmount
  orbit.rehitCooldownMs = profile.rehitCooldownMs
  orbit.rootKnockbackDistance = profile.rootKnockbackDistance
  orbit.impactStrengthMultiplier = profile.impactStrengthMultiplier
  orbit.damageSpreadProfile = profile.damageSpreadProfile
  orbit.glyphFrame = profile.orbitPresentation.glyphFrame
  orbit.visualRoleId = profile.orbitPresentation.visualRoleId
  orbit.visualScale = profile.orbitPresentation.scale
  orbit.visualAlpha = appearance.core.alpha
  orbit.visualTint = appearance.core.tint
}

function findEarliestOrbitContactTime(
  world: WorldState,
  ownerId: number,
  ownerX: number,
  ownerY: number,
  orbit: OrbitAttackState,
): number | null {
  let earliestContactTime = Number.POSITIVE_INFINITY
  for (const glyph of world.glyphStore.getOwnerGlyphs(ownerId)) {
    world.diagnostics.orbitSweepPreciseTestCount += 1
    const combinedRadius = glyph.collisionRadius + orbit.damageRadius
    const contactTime = getFirstSegmentCircleContactTime(
      orbit.previousX,
      orbit.previousY,
      orbit.x,
      orbit.y,
      getGlyphWorldX(ownerX, glyph),
      getGlyphWorldY(ownerY, glyph),
      combinedRadius,
    )
    if (contactTime !== null && contactTime < earliestContactTime) {
      earliestContactTime = contactTime
      if (contactTime === 0) {
        break
      }
    }
  }
  return Number.isFinite(earliestContactTime) ? earliestContactTime : null
}

function collideOrbit(world: WorldState, orbit: OrbitAttackState): void {
  for (const [ownerId, nextAllowedTime] of orbit.nextAllowedHitTimeByOwner) {
    if (nextAllowedTime <= world.runTimeMs) {
      orbit.nextAllowedHitTimeByOwner.delete(ownerId)
    }
  }

  const midpointX = (orbit.previousX + orbit.x) / 2
  const midpointY = (orbit.previousY + orbit.y) / 2
  const halfSweepLength =
    Math.hypot(orbit.x - orbit.previousX, orbit.y - orbit.previousY) / 2
  const candidates = world.enemySpatialHash.queryCircle(
    midpointX,
    midpointY,
    halfSweepLength + orbit.damageRadius + world.maximumEnemyQueryRadius,
    world.collisionCandidates,
  )
  world.diagnostics.orbitSweepCandidateCount += candidates.length

  for (const enemy of candidates) {
    if (
      !isEnemyOutlineCollisionPhase(enemy.phase) ||
      orbit.nextAllowedHitTimeByOwner.has(enemy.id)
    ) {
      continue
    }
    const contactTime = findEarliestOrbitContactTime(
      world,
      enemy.id,
      enemy.x,
      enemy.y,
      orbit,
    )
    if (contactTime === null) {
      continue
    }
    const contactX =
      orbit.previousX + (orbit.x - orbit.previousX) * contactTime
    const contactY =
      orbit.previousY + (orbit.y - orbit.previousY) * contactTime
    const outwardX = contactX - world.player.x
    const outwardY = contactY - world.player.y
    const outwardLength = Math.hypot(outwardX, outwardY)
    const directionX = outwardLength > 0 ? outwardX / outwardLength : 1
    const directionY = outwardLength > 0 ? outwardY / outwardLength : 0

    orbit.nextAllowedHitTimeByOwner.set(
      enemy.id,
      world.runTimeMs + orbit.rehitCooldownMs,
    )
    world.glyphDamageQueue.enqueue({
      attackEventId: getNextDamageEventId(world),
      visualRoleId: orbit.visualRoleId,
      primaryScope: DAMAGE_PRIMARY_SCOPE.LOCKED_OWNER,
      ownerId: enemy.id,
      shapeKind: LOCAL_DAMAGE_SHAPE.CIRCLE,
      shapeX: contactX,
      shapeY: contactY,
      shapeRadius: orbit.damageRadius,
      shapeDirectionX: 0,
      shapeDirectionY: 0,
      shapeRange: 0,
      shapeHalfAngleRadians: 0,
      targetMode: 'AREA',
      amount: orbit.damage,
      damageSpreadProfile: orbit.damageSpreadProfile,
      impactStrengthMultiplier: orbit.impactStrengthMultiplier,
      impactDirectionX: directionX,
      impactDirectionY: directionY,
      rootKnockbackDistance: orbit.rootKnockbackDistance,
      rootKnockbackDirectionX: directionX,
      rootKnockbackDirectionY: directionY,
    })
  }
}

function isOrbitStillEquipped(world: WorldState, orbit: OrbitAttackState): boolean {
  for (const weapon of world.weaponLoadout.equipped) {
    if (weapon.id !== orbit.sourceWeaponInstanceId) {
      continue
    }
    return (
      weapon.resolvedProfile.targetStrategyId === 'OWNER_RELATIVE' &&
      orbit.ballIndex < weapon.resolvedProfile.attackPattern.ballCount
    )
  }
  return false
}

export function removeOrbitAttacksForWeapon(
  world: WorldState,
  weaponInstanceId: number,
): void {
  for (let index = world.orbitAttacks.length - 1; index >= 0; index -= 1) {
    if (world.orbitAttacks[index].sourceWeaponInstanceId === weaponInstanceId) {
      world.orbitAttacks[index].nextAllowedHitTimeByOwner.clear()
      world.orbitAttacks.splice(index, 1)
    }
  }
}

/** Owns persistent orbit phase, collision, re-hit history, and attached cleanup. */
export function runOrbitWeaponSystem(world: WorldState, deltaMs: number): void {
  for (let index = world.orbitAttacks.length - 1; index >= 0; index -= 1) {
    if (!isOrbitStillEquipped(world, world.orbitAttacks[index])) {
      world.orbitAttacks[index].nextAllowedHitTimeByOwner.clear()
      world.orbitAttacks.splice(index, 1)
    }
  }

  for (const weapon of world.weaponLoadout.equipped) {
    const profile = weapon.resolvedProfile
    if (profile.targetStrategyId !== 'OWNER_RELATIVE') {
      continue
    }
    const previousBasePhase = findOrbit(world, weapon.id, 0)?.phaseRadians ?? 0
    const basePhase = normalizePhase(
      previousBasePhase +
        profile.attackPattern.angularSpeedRevolutionsPerSecond *
          FULL_CIRCLE_RADIANS *
          (deltaMs / 1_000),
    )
    for (
      let ballIndex = 0;
      ballIndex < profile.attackPattern.ballCount;
      ballIndex += 1
    ) {
      const phaseRadians = normalizePhase(
        basePhase +
          (ballIndex / profile.attackPattern.ballCount) * FULL_CIRCLE_RADIANS,
      )
      const currentRadius = getOrbitRadius(
        profile.attackPattern.orbitRadius,
        profile.attackPattern.maximumOrbitRadius,
        phaseRadians,
      )
      const nextX = world.player.x + Math.cos(phaseRadians) * currentRadius
      const nextY = world.player.y + Math.sin(phaseRadians) * currentRadius
      let orbit = findOrbit(world, weapon.id, ballIndex)
      if (!orbit) {
        orbit = createOrbit(
          world,
          weapon,
          profile,
          ballIndex,
          phaseRadians,
          currentRadius,
        )
      } else {
        const isProfileRebase =
          orbit.sourceProfileRevision !== weapon.profileRevision
        orbit.previousX = isProfileRebase ? nextX : orbit.x
        orbit.previousY = isProfileRebase ? nextY : orbit.y
        orbit.sourceProfileRevision = weapon.profileRevision
        orbit.phaseRadians = phaseRadians
        orbit.radialPhaseRadians = phaseRadians
        orbit.currentRadius = currentRadius
        orbit.x = nextX
        orbit.y = nextY
      }
      updateResolvedValues(world, orbit, profile)
      collideOrbit(world, orbit)
    }
  }
}
