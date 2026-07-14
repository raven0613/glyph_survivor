import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'
import { LOCAL_DAMAGE_SHAPE } from '../glyph/localDamage.ts'
import type { OrbitAttackState } from '../runtime/worldEntities.ts'
import { isEnemyOutlineCollisionPhase } from '../runtime/worldEntities.ts'
import type { WeaponInstance } from '../runtime/weaponLoadout.ts'
import type { WorldState } from '../runtime/worldState.ts'
import type { ResolvedOrbitWeaponProfile } from './resolveWeaponProfile.ts'

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
): OrbitAttackState {
  const phaseRadians =
    (ballIndex / profile.attackPattern.ballCount) * FULL_CIRCLE_RADIANS
  const x =
    world.player.x + Math.cos(phaseRadians) * profile.attackPattern.orbitRadius
  const y =
    world.player.y + Math.sin(phaseRadians) * profile.attackPattern.orbitRadius
  const orbit: OrbitAttackState = {
    id: world.nextOrbitAttackId,
    sourceWeaponInstanceId: weapon.id,
    sourceEquipmentSlot: weapon.equipmentSlot,
    ballIndex,
    phaseRadians,
    x,
    y,
    previousX: x,
    previousY: y,
    damageRadius: profile.damageShape.radius,
    damage: profile.damageAmount,
    rehitCooldownMs: profile.rehitCooldownMs,
    rootKnockbackDistance: profile.rootKnockbackDistance,
    impactStrengthMultiplier: profile.impactStrengthMultiplier,
    glyphFrame: profile.orbitPresentation.glyphFrame,
    visualScale: profile.orbitPresentation.scale,
    visualAlpha: profile.orbitPresentation.alpha,
    visualTint: profile.orbitPresentation.tint,
    nextAllowedHitTimeByOwner: new Map(),
  }
  world.nextOrbitAttackId += 1
  world.orbitAttacks.push(orbit)
  return orbit
}

function updateResolvedValues(
  orbit: OrbitAttackState,
  profile: ResolvedOrbitWeaponProfile,
): void {
  orbit.damageRadius = profile.damageShape.radius
  orbit.damage = profile.damageAmount
  orbit.rehitCooldownMs = profile.rehitCooldownMs
  orbit.rootKnockbackDistance = profile.rootKnockbackDistance
  orbit.impactStrengthMultiplier = profile.impactStrengthMultiplier
  orbit.glyphFrame = profile.orbitPresentation.glyphFrame
  orbit.visualScale = profile.orbitPresentation.scale
  orbit.visualAlpha = profile.orbitPresentation.alpha
  orbit.visualTint = profile.orbitPresentation.tint
}

function hasPreciseOutlineImpact(
  world: WorldState,
  ownerId: number,
  ownerX: number,
  ownerY: number,
  orbit: OrbitAttackState,
): boolean {
  for (const glyph of world.glyphStore.getOwnerGlyphs(ownerId)) {
    const deltaX = getGlyphWorldX(ownerX, glyph) - orbit.x
    const deltaY = getGlyphWorldY(ownerY, glyph) - orbit.y
    const combinedRadius = glyph.collisionRadius + orbit.damageRadius
    if (deltaX * deltaX + deltaY * deltaY <= combinedRadius * combinedRadius) {
      return true
    }
  }
  return false
}

function collideOrbit(world: WorldState, orbit: OrbitAttackState): void {
  for (const [ownerId, nextAllowedTime] of orbit.nextAllowedHitTimeByOwner) {
    if (nextAllowedTime <= world.runTimeMs) {
      orbit.nextAllowedHitTimeByOwner.delete(ownerId)
    }
  }

  const candidates = world.enemySpatialHash.queryCircle(
    orbit.x,
    orbit.y,
    orbit.damageRadius + world.maximumEnemyQueryRadius,
    world.collisionCandidates,
  )
  const outwardX = orbit.x - world.player.x
  const outwardY = orbit.y - world.player.y
  const outwardLength = Math.hypot(outwardX, outwardY)
  const directionX = outwardLength > 0 ? outwardX / outwardLength : 1
  const directionY = outwardLength > 0 ? outwardY / outwardLength : 0

  for (const enemy of candidates) {
    if (
      !isEnemyOutlineCollisionPhase(enemy.phase) ||
      orbit.nextAllowedHitTimeByOwner.has(enemy.id) ||
      !hasPreciseOutlineImpact(world, enemy.id, enemy.x, enemy.y, orbit)
    ) {
      continue
    }

    orbit.nextAllowedHitTimeByOwner.set(
      enemy.id,
      world.runTimeMs + orbit.rehitCooldownMs,
    )
    world.glyphDamageQueue.enqueue({
      ownerId: enemy.id,
      shapeKind: LOCAL_DAMAGE_SHAPE.CIRCLE,
      shapeX: orbit.x,
      shapeY: orbit.y,
      shapeRadius: orbit.damageRadius,
      shapeDirectionX: 0,
      shapeDirectionY: 0,
      shapeRange: 0,
      shapeHalfAngleRadians: 0,
      targetMode: 'AREA',
      amount: orbit.damage,
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
    for (
      let ballIndex = 0;
      ballIndex < profile.attackPattern.ballCount;
      ballIndex += 1
    ) {
      const orbit =
        findOrbit(world, weapon.id, ballIndex) ??
        createOrbit(world, weapon, profile, ballIndex)
      updateResolvedValues(orbit, profile)
      orbit.previousX = orbit.x
      orbit.previousY = orbit.y
      orbit.phaseRadians =
        (orbit.phaseRadians +
          profile.attackPattern.angularSpeedRevolutionsPerSecond *
            FULL_CIRCLE_RADIANS *
            (deltaMs / 1_000)) %
        FULL_CIRCLE_RADIANS
      orbit.x =
        world.player.x +
        Math.cos(orbit.phaseRadians) * profile.attackPattern.orbitRadius
      orbit.y =
        world.player.y +
        Math.sin(orbit.phaseRadians) * profile.attackPattern.orbitRadius
      collideOrbit(world, orbit)
    }
  }
}
