import { getCreatureDefinition } from '../content/gameContent.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import {
  PLAYER_DAMAGE_ROUTE,
  PLAYER_DAMAGE_SOURCE_KIND,
  type PlayerDamageCandidate,
} from '../runtime/playerSurvival.ts'
import { isEnemyCombatPhase } from '../runtime/worldEntities.ts'
import {
  getNextPlayerDamageEventId,
  type WorldState,
} from '../runtime/worldState.ts'
import { circlesIntersect } from './combatGeometry.ts'

function intersectsPlayer(world: WorldState, enemyId: number): boolean {
  const enemy = world.enemyById.get(enemyId)
  if (!enemy) {
    return false
  }
  for (const glyph of world.glyphStore.getOwnerGlyphs(enemy.id)) {
    if (
      circlesIntersect(
        world.player.x,
        world.player.y,
        GAME_CONFIG.playerCollisionRadius,
        getGlyphWorldX(enemy.x, glyph),
        getGlyphWorldY(enemy.y, glyph),
        glyph.collisionRadius,
      )
    ) {
      return true
    }
  }
  return false
}

function writeContactCandidate(
  world: WorldState,
  sourceId: number,
  amount: number,
): void {
  const index = world.playerDamageCandidateCount
  const candidate =
    world.playerDamageCandidates[index] ?? ({} as PlayerDamageCandidate)
  candidate.eventId = getNextPlayerDamageEventId(world)
  candidate.sourceKind = PLAYER_DAMAGE_SOURCE_KIND.CREATURE_CONTACT
  candidate.sourceId = sourceId
  candidate.amount = amount
  candidate.route = PLAYER_DAMAGE_ROUTE.SHIELD_FIRST
  world.playerDamageCandidates[index] = candidate
  world.playerDamageCandidateCount += 1
}

/** Collects at most one candidate per authoritative creature owner. */
export function runPlayerContactSystem(world: WorldState): number {
  world.playerDamageCandidateCount = 0
  const candidates = world.enemySpatialHash.queryCircle(
    world.player.x,
    world.player.y,
    GAME_CONFIG.playerCollisionRadius + world.maximumEnemyQueryRadius,
    world.playerContactCandidates,
  )

  for (const enemy of candidates) {
    if (!isEnemyCombatPhase(enemy.phase) || !intersectsPlayer(world, enemy.id)) {
      continue
    }
    const contactDamage = getCreatureDefinition(
      world.content,
      enemy.definitionId,
    ).contactDamage
    if (contactDamage > 0) {
      writeContactCandidate(world, enemy.id, contactDamage)
    }
  }
  return world.playerDamageCandidateCount
}
