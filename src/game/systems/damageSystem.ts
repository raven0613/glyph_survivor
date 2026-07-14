import type { WorldState } from '../runtime/worldState.ts'
import { GLYPH_CELL_STATE } from '../glyph/glyphStore.ts'
import { getGlyphMaterialDefinition } from '../glyph/glyphMaterial.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'
import { isEnemyOutlineCollisionPhase } from '../runtime/worldEntities.ts'
import { selectGlyphDamage } from './glyphDamageSelection.ts'
import { LOCAL_DAMAGE_SHAPE } from '../glyph/localDamage.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'

function applyWholeBodyKnockback(
  enemy: WorldState['enemies'][number],
  distance: number,
  directionX: number,
  directionY: number,
): void {
  if (distance <= 0) {
    return
  }
  const directionLength = Math.hypot(directionX, directionY)
  if (directionLength === 0) {
    return
  }
  const normalizedX = directionX / directionLength
  const normalizedY = directionY / directionLength
  enemy.x = Math.max(
    enemy.radius,
    Math.min(
      GAME_CONFIG.worldWidth - enemy.radius,
      enemy.x + normalizedX * distance,
    ),
  )
  enemy.y = Math.max(
    enemy.radius,
    Math.min(
      GAME_CONFIG.worldHeight - enemy.radius,
      enemy.y + normalizedY * distance,
    ),
  )
}

export function runDamageSystem(world: WorldState): void {
  world.glyphDamageQueue.drain((event) => {
    const enemy = world.enemyById.get(event.ownerId)
    if (!enemy || !isEnemyOutlineCollisionPhase(enemy.phase)) {
      return
    }

    const ownerGlyphs = world.glyphStore.getOwnerGlyphs(event.ownerId)
    const selection = selectGlyphDamage(
      ownerGlyphs.map((glyph) => ({
        glyph,
        id: glyph.id,
        state: glyph.state,
        topologyX: glyph.topologyX,
        topologyY: glyph.topologyY,
        worldX: getGlyphWorldX(enemy.x, glyph),
        worldY: getGlyphWorldY(enemy.y, glyph),
        collisionRadius: glyph.collisionRadius,
      })),
      event.shapeKind === LOCAL_DAMAGE_SHAPE.CIRCLE
        ? {
            kind: 'CIRCLE',
            x: event.shapeX,
            y: event.shapeY,
            radius: event.shapeRadius,
          }
        : {
            kind: 'CONE',
            x: event.shapeX,
            y: event.shapeY,
            directionX: event.shapeDirectionX,
            directionY: event.shapeDirectionY,
            range: event.shapeRange,
            halfAngleRadians: event.shapeHalfAngleRadians,
          },
      event.targetMode,
    )
    if (selection.impactCells.length === 0) {
      return
    }

    for (const target of selection.damageTargets) {
      const wasLiving = target.glyph.state !== GLYPH_CELL_STATE.HUSK
      const appliedDamage = world.glyphStore.applyDamage(
        target.glyph.id,
        event.amount,
      )
      if (
        wasLiving &&
        appliedDamage > 0 &&
        target.glyph.state === GLYPH_CELL_STATE.HUSK
      ) {
        world.topologyDirtyOwnerIds.add(target.glyph.ownerId)
      }
    }

    for (const impact of selection.impactCells) {
      const glyph = impact.glyph
      world.glyphStore.applyMaterialHit(
        glyph.id,
        event.impactDirectionX * event.impactStrengthMultiplier,
        event.impactDirectionY * event.impactStrengthMultiplier,
        getGlyphMaterialDefinition(glyph.material),
      )
    }

    applyWholeBodyKnockback(
      enemy,
      event.rootKnockbackDistance ?? 0,
      event.rootKnockbackDirectionX ?? 0,
      event.rootKnockbackDirectionY ?? 0,
    )
  })
}
