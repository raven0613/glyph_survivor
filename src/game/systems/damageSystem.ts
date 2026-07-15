import type { GlyphCell } from '../glyph/glyphStore.ts'
import {
  GLYPH_CELL_STATE,
  isGlyphLivingState,
} from '../glyph/glyphStore.ts'
import { getGlyphMaterialDefinition } from '../glyph/glyphMaterial.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'
import {
  DAMAGE_PRIMARY_SCOPE,
  LOCAL_DAMAGE_SHAPE,
  type DamageClaim,
  type GlyphDamageEvent,
} from '../glyph/localDamage.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import type {
  DamageTransferLinkState,
  EnemyState,
} from '../runtime/worldEntities.ts'
import { isEnemyOutlineCollisionPhase } from '../runtime/worldEntities.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { getDamageSpreadBandIndex } from './damageSpreadGeometry.ts'
import {
  selectGlyphDamage,
  type DamageSelectionCell,
  type DamageSelectionShape,
} from './glyphDamageSelection.ts'

const DAMAGE_TRANSFER_LINK_DURATION_MS = 120
const MAX_ACTIVE_DAMAGE_TRANSFER_LINKS = 96

type GlyphSelectionCell = DamageSelectionCell & { readonly glyph: GlyphCell }
type MutableDamageSelectionCell = {
  -readonly [Key in keyof DamageSelectionCell]: DamageSelectionCell[Key]
}

function applyWholeBodyKnockback(
  enemy: EnemyState,
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

function getDamageShape(event: Readonly<GlyphDamageEvent>): DamageSelectionShape {
  return event.shapeKind === LOCAL_DAMAGE_SHAPE.CIRCLE
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
      }
}

function getSearchRadius(
  world: WorldState,
  event: Readonly<GlyphDamageEvent>,
): number {
  const spread = event.damageSpreadProfile
  const maximumSpreadDistance = spread
    ? spread.bandWidth * spread.bandDamageRatios.length
    : 0
  const shapeReach =
    event.shapeKind === LOCAL_DAMAGE_SHAPE.CONE
      ? event.shapeRange
      : event.shapeRadius
  return shapeReach + maximumSpreadDistance + world.maximumEnemyQueryRadius
}

function createOwnerSelectionCells(
  world: WorldState,
  enemy: EnemyState,
): GlyphSelectionCell[] {
  return world.glyphStore.getOwnerGlyphs(enemy.id).map((glyph) => ({
    glyph,
    id: glyph.id,
    state: glyph.state,
    topologyX: glyph.topologyX,
    topologyY: glyph.topologyY,
    worldX: getGlyphWorldX(enemy.x, glyph),
    worldY: getGlyphWorldY(enemy.y, glyph),
    collisionRadius: glyph.collisionRadius,
  }))
}

function resetDamageClaims(world: WorldState): void {
  world.damageResolutionScratch.claimCount = 0
  world.damageResolutionScratch.claimIndexByGlyphId.clear()
}

function addDamageClaim(
  world: WorldState,
  glyphId: number,
  amount: number,
  isSpread: boolean,
  spreadVisualRoleId: DamageClaim['spreadVisualRoleId'],
): void {
  const scratch = world.damageResolutionScratch
  const existingIndex = scratch.claimIndexByGlyphId.get(glyphId)
  if (existingIndex !== undefined) {
    world.diagnostics.damageClaimDedupCount += 1
    const existing = scratch.claims[existingIndex]
    if (
      amount > existing.amount ||
      (amount === existing.amount && existing.isSpread && !isSpread)
    ) {
      existing.amount = amount
      existing.isSpread = isSpread
      existing.spreadVisualRoleId = spreadVisualRoleId
    }
    return
  }

  const claim = scratch.claims[scratch.claimCount] ?? ({} as DamageClaim)
  claim.glyphId = glyphId
  claim.amount = amount
  claim.isSpread = isSpread
  claim.spreadVisualRoleId = spreadVisualRoleId
  scratch.claims[scratch.claimCount] = claim
  scratch.claimIndexByGlyphId.set(glyphId, scratch.claimCount)
  scratch.claimCount += 1
}

function createDamageTransferLink(
  world: WorldState,
  source: GlyphSelectionCell,
  target: GlyphSelectionCell,
): void {
  if (world.damageTransferLinks.length >= MAX_ACTIVE_DAMAGE_TRANSFER_LINKS) {
    world.diagnostics.damageTransferLinkDropCount += 1
    return
  }
  const link =
    world.damageTransferLinkPool.pop() ?? ({} as DamageTransferLinkState)
  Object.assign(link, {
    id: world.nextDamageTransferLinkId,
    sourceGlyphId: source.id,
    targetGlyphId: target.id,
    sourceX: source.worldX,
    sourceY: source.worldY,
    targetX: target.worldX,
    targetY: target.worldY,
    remainingMs: DAMAGE_TRANSFER_LINK_DURATION_MS,
    durationMs: DAMAGE_TRANSFER_LINK_DURATION_MS,
  })
  world.nextDamageTransferLinkId += 1
  world.damageTransferLinks.push(link)
}

function collectPrimaryDamageForOwner(
  world: WorldState,
  event: Readonly<GlyphDamageEvent>,
  shape: DamageSelectionShape,
  enemy: EnemyState,
): boolean {
  if (!isEnemyOutlineCollisionPhase(enemy.phase)) {
    return false
  }
  const selection = selectGlyphDamage(
    createOwnerSelectionCells(world, enemy),
    shape,
    event.targetMode,
  )
  if (selection.impactCells.length === 0) {
    return false
  }

  for (const target of selection.damageTargets) {
    addDamageClaim(world, target.id, event.amount, false, null)
  }
  for (const impact of selection.impactCells) {
    world.glyphStore.applyMaterialHit(
      impact.id,
      event.impactDirectionX * event.impactStrengthMultiplier,
      event.impactDirectionY * event.impactStrengthMultiplier,
      getGlyphMaterialDefinition(impact.glyph.material),
    )
  }
  for (const transfer of selection.frontierTransfers) {
    createDamageTransferLink(
      world,
      transfer.sourceImpactCell,
      transfer.targetCell,
    )
  }
  return true
}

function collectSpreadDamage(
  world: WorldState,
  event: Readonly<GlyphDamageEvent>,
  shape: DamageSelectionShape,
  candidates: readonly EnemyState[],
): void {
  const spread = event.damageSpreadProfile
  if (!spread) {
    return
  }
  const cell: MutableDamageSelectionCell = {
    id: 0,
    state: GLYPH_CELL_STATE.HEALTHY,
    topologyX: 0,
    topologyY: 0,
    worldX: 0,
    worldY: 0,
    collisionRadius: 0,
  }
  for (const enemy of candidates) {
    if (!isEnemyOutlineCollisionPhase(enemy.phase)) {
      continue
    }
    for (const glyph of world.glyphStore.getOwnerGlyphs(enemy.id)) {
      if (!isGlyphLivingState(glyph.state)) {
        continue
      }
      world.diagnostics.spreadCandidateCount += 1
      cell.id = glyph.id
      cell.state = glyph.state
      cell.topologyX = glyph.topologyX
      cell.topologyY = glyph.topologyY
      cell.worldX = getGlyphWorldX(enemy.x, glyph)
      cell.worldY = getGlyphWorldY(enemy.y, glyph)
      cell.collisionRadius = glyph.collisionRadius
      world.diagnostics.spreadPreciseTestCount += 1
      const bandIndex = getDamageSpreadBandIndex(
        cell,
        shape,
        spread.bandWidth,
        spread.bandDamageRatios.length,
      )
      if (bandIndex === null) {
        continue
      }
      addDamageClaim(
        world,
        glyph.id,
        event.amount * spread.bandDamageRatios[bandIndex],
        true,
        event.visualRoleId,
      )
    }
  }
}

function applyDamageClaims(world: WorldState): void {
  const scratch = world.damageResolutionScratch
  for (let index = 0; index < scratch.claimCount; index += 1) {
    const claim = scratch.claims[index]
    const glyph = world.glyphStore.getById(claim.glyphId)
    if (!glyph) {
      continue
    }
    const wasLiving = isGlyphLivingState(glyph.state)
    const appliedDamage = world.glyphStore.applyDamage(glyph.id, claim.amount)
    if (claim.isSpread && appliedDamage > 0) {
      if (claim.spreadVisualRoleId === null) {
        throw new Error('Spread damage claim is missing its visual role.')
      }
      world.glyphStore.applySpreadFeedback(
        glyph.id,
        world.content.combatVisualTheme.effects.spreadFeedbackDurationMs,
        claim.spreadVisualRoleId,
      )
    }
    if (
      wasLiving &&
      appliedDamage > 0 &&
      glyph.state === GLYPH_CELL_STATE.HUSK
    ) {
      world.topologyDirtyOwnerIds.add(glyph.ownerId)
    }
  }
}

function resolveDamageEvent(
  world: WorldState,
  event: Readonly<GlyphDamageEvent>,
): void {
  resetDamageClaims(world)
  const shape = getDamageShape(event)
  const candidates = world.enemySpatialHash.queryCircle(
    event.shapeX,
    event.shapeY,
    getSearchRadius(world, event),
    world.damageCandidates,
  )
  let hasPrimaryImpact = false
  let lockedOwner: EnemyState | undefined

  if (event.primaryScope === DAMAGE_PRIMARY_SCOPE.LOCKED_OWNER) {
    lockedOwner = world.enemyById.get(event.ownerId)
    if (lockedOwner) {
      hasPrimaryImpact = collectPrimaryDamageForOwner(
        world,
        event,
        shape,
        lockedOwner,
      )
    }
  } else {
    for (const enemy of candidates) {
      hasPrimaryImpact =
        collectPrimaryDamageForOwner(world, event, shape, enemy) ||
        hasPrimaryImpact
    }
  }

  if (!hasPrimaryImpact) {
    return
  }
  collectSpreadDamage(world, event, shape, candidates)
  applyDamageClaims(world)

  if (lockedOwner) {
    applyWholeBodyKnockback(
      lockedOwner,
      event.rootKnockbackDistance ?? 0,
      event.rootKnockbackDirectionX ?? 0,
      event.rootKnockbackDirectionY ?? 0,
    )
  }
}

export function runDamageSystem(world: WorldState): void {
  world.glyphDamageQueue.drain((event) => resolveDamageEvent(world, event))
}
