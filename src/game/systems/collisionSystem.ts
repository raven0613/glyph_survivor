import {
  isEnemyOutlineCollisionPhase,
  type EnemyState,
  type ProjectileState,
} from '../runtime/worldEntities.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'
import type { GlyphCell } from '../glyph/glyphStore.ts'
import { circlesIntersect } from './combatGeometry.ts'
import {
  DAMAGE_PRIMARY_SCOPE,
  LOCAL_DAMAGE_SHAPE,
} from '../glyph/localDamage.ts'
import { getNextDamageEventId } from '../runtime/worldState.ts'

function findHitGlyph(
  world: WorldState,
  enemy: EnemyState,
  projectile: ProjectileState,
): GlyphCell | null {
  let closestGlyph: GlyphCell | null = null
  let closestDistanceSquared = Number.POSITIVE_INFINITY

  for (const glyph of world.glyphStore.getOwnerGlyphs(enemy.id)) {
    const glyphX = getGlyphWorldX(enemy.x, glyph)
    const glyphY = getGlyphWorldY(enemy.y, glyph)
    if (
      !circlesIntersect(
        projectile.x,
        projectile.y,
        projectile.radius,
        glyphX,
        glyphY,
        glyph.collisionRadius,
      )
    ) {
      continue
    }

    const deltaX = glyphX - projectile.x
    const deltaY = glyphY - projectile.y
    const distanceSquared = deltaX * deltaX + deltaY * deltaY
    const winsTie =
      distanceSquared === closestDistanceSquared &&
      glyph.id < (closestGlyph?.id ?? Number.POSITIVE_INFINITY)

    if (distanceSquared < closestDistanceSquared || winsTie) {
      closestGlyph = glyph
      closestDistanceSquared = distanceSquared
    }
  }

  return closestGlyph
}

export function runCollisionSystem(world: WorldState): void {
  for (const projectile of world.projectiles) {
    if (!projectile.isAlive) {
      continue
    }

    const candidates = world.enemySpatialHash.queryCircle(
      projectile.x,
      projectile.y,
      projectile.radius + world.maximumEnemyQueryRadius,
      world.collisionCandidates,
    )

    for (const enemy of candidates) {
      if (!isEnemyOutlineCollisionPhase(enemy.phase)) {
        continue
      }

      const glyph = findHitGlyph(world, enemy, projectile)
      if (!glyph) {
        continue
      }

      projectile.isAlive = false
      const velocityLength = Math.hypot(
        projectile.velocityX,
        projectile.velocityY,
      )
      const directionX =
        velocityLength > 0
          ? projectile.velocityX / velocityLength
          : projectile.launchDirectionX
      const directionY =
        velocityLength > 0
          ? projectile.velocityY / velocityLength
          : projectile.launchDirectionY
      world.glyphDamageQueue.enqueue({
        attackEventId: getNextDamageEventId(world),
        sourceWeaponInstanceId: projectile.sourceWeaponInstanceId,
        visualRoleId: projectile.visualRoleId,
        primaryScope: DAMAGE_PRIMARY_SCOPE.LOCKED_OWNER,
        ownerId: glyph.ownerId,
        shapeKind: LOCAL_DAMAGE_SHAPE.CIRCLE,
        shapeX: projectile.x,
        shapeY: projectile.y,
        shapeRadius: projectile.radius,
        shapeDirectionX: 0,
        shapeDirectionY: 0,
        shapeRange: 0,
        shapeHalfAngleRadians: 0,
        targetMode: projectile.damageTargetMode,
        amount: projectile.damage,
        damageSpreadProfile: projectile.damageSpreadProfile,
        impactStrengthMultiplier: projectile.impactStrengthMultiplier,
        impactDirectionX: directionX,
        impactDirectionY: directionY,
      })
      break
    }

    if (projectile.isAlive && projectile.rangeExhausted) {
      projectile.isAlive = false
      world.diagnostics.rangeExpiredProjectileCount += 1
    }
  }
}
