import type { GlyphBodySlotRole } from './glyphLayout.ts'
import type { GlyphMaterialDefinition } from './glyphMaterial.ts'
import {
  isPlayerAttackVisualRoleId,
  resolveGlyphBasePresentation,
  resolveGlyphImpactPresentation,
  type PlayerAttackVisualRoleId,
} from '../content/visuals/combatVisualTheme.ts'
import {
  GLYPH_CELL_STATE,
  isGlyphLivingState,
  type CreateGlyphInput,
  type CreateGlyphStoreOptions,
  type GlyphCell,
  type GlyphStore,
  type OwnerDurability,
} from './glyphCell.ts'
import {
  applyDisconnectedLatchStatus,
  applyCrackedStatus,
  clearDisconnectedLatchStatus,
  consumeCrackedStatus,
} from './glyphStatus.ts'
import { applyGlyphDurabilityDamage } from './glyphDurability.ts'
import {
  requireFiniteNumber,
  requireNonNegativeSafeInteger,
  requirePositiveSafeInteger,
} from './glyphStoreValidation.ts'
import { removeGlyphOwner } from './glyphOwnerRemoval.ts'
import {
  updateGlyphBodyMotion,
  updateGlyphCompiledLayout,
  updateGlyphLocalPosition,
} from './glyphStoreLayout.ts'
import { updateGlyphRolePresentation } from './glyphStorePresentation.ts'

export { GLYPH_MATERIAL } from './glyphMaterial.ts'
export type { GlyphMaterialId } from './glyphMaterial.ts'
export { GLYPH_CELL_STATE } from './glyphCell.ts'
export { isGlyphLivingState } from './glyphCell.ts'
export type {
  CreateGlyphInput,
  CreateGlyphStoreOptions,
  GlyphCell,
  GlyphCellState,
  GlyphStore,
  OwnerDurability,
} from './glyphCell.ts'

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] }
type MutableGlyphCell = Mutable<GlyphCell>
type MutableOwnerDurability = Mutable<OwnerDurability>

/** Owns all mutable Glyph Cell life state and derived owner aggregates. */
export function createGlyphStore({
  visualTheme,
  onPoolMiss,
}: CreateGlyphStoreOptions): GlyphStore {
  const cells: MutableGlyphCell[] = []
  const recycledCells: MutableGlyphCell[] = []
  const recycledOwnerCells: MutableGlyphCell[][] = []
  const emptyOwnerCells: readonly GlyphCell[] = Object.freeze([])
  const cellById = new Map<number, MutableGlyphCell>()
  const cellIndexById = new Map<number, number>()
  const cellsByOwner = new Map<number, MutableGlyphCell[]>()
  const durabilityByOwner = new Map<number, MutableOwnerDurability>()
  let nextGlyphId = 1
  let poolMisses = 0

  function createGlyph(input: CreateGlyphInput): GlyphCell {
    requirePositiveSafeInteger(input.ownerId, 'ownerId')
    requireNonNegativeSafeInteger(input.bodySlotId, 'bodySlotId')
    requirePositiveSafeInteger(input.maxDurability, 'maxDurability')

    if (input.character.length !== 1) {
      throw new TypeError('character must contain exactly one glyph.')
    }

    const glyphFrame = input.glyphFrame
    const localX = input.localX ?? 0
    const localY = input.localY ?? 0
    requireNonNegativeSafeInteger(glyphFrame, 'glyphFrame')
    requireFiniteNumber(localX, 'localX')
    requireFiniteNumber(localY, 'localY')
    if (!Number.isFinite(input.collisionRadius) || input.collisionRadius <= 0) {
      throw new RangeError('collisionRadius must be finite and greater than zero.')
    }
    if (!Number.isFinite(input.scale) || input.scale <= 0) {
      throw new RangeError('scale must be finite and greater than zero.')
    }

    const ownerCells = cellsByOwner.get(input.ownerId)
    if (ownerCells?.some((cell) => cell.bodySlotId === input.bodySlotId)) {
      throw new Error(
        `Owner ${input.ownerId} already has bodySlotId ${input.bodySlotId}.`,
      )
    }

    const recycledCell = recycledCells.pop()
    if (!recycledCell) {
      poolMisses += 1
      onPoolMiss?.()
    }

    const cell = recycledCell ?? ({} as MutableGlyphCell)
    const id = nextGlyphId
    nextGlyphId += 1
    const presentation = resolveGlyphBasePresentation(
      visualTheme,
      input.appearanceProfileId,
      input.maxDurability,
      input.maxDurability,
      input.role,
    )
    Object.assign(cell, {
      id,
      ownerId: input.ownerId,
      bodySlotId: input.bodySlotId,
      character: input.character,
      glyphFrame,
      baseCharacter: input.baseCharacter,
      baseGlyphFrame: input.baseGlyphFrame,
      role: input.role,
      topologyX: input.topologyX,
      topologyY: input.topologyY,
      layoutBaseX: localX,
      layoutBaseY: localY,
      localX,
      localY,
      bodyMotionOffsetX: 0,
      bodyMotionOffsetY: 0,
      currentDurability: input.maxDurability,
      maxDurability: input.maxDurability,
      collisionRadius: input.collisionRadius,
      alpha: presentation.alpha,
      baseTint: presentation.tint,
      tint: presentation.tint,
      hitFlashRemainingMs: 0,
      spreadFlashRemainingMs: 0,
      spreadFeedbackVisualRoleId: null,
      material: input.material,
      appearanceProfileId: input.appearanceProfileId,
      state: GLYPH_CELL_STATE.HEALTHY,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
      velocityX: 0,
      velocityY: 0,
      scale: input.scale,
      flags: 0,
      crackedCreatedByRootAttackEventId: 0,
      disconnectedLatchedMultiplier: 1,
      disconnectedLatchEpisodeId: 0,
    })

    cellById.set(id, cell)
    cellIndexById.set(id, cells.length)
    cells.push(cell)

    if (ownerCells) {
      ownerCells.push(cell)
    } else {
      const newOwnerCells = recycledOwnerCells.pop() ?? []
      newOwnerCells.push(cell)
      cellsByOwner.set(input.ownerId, newOwnerCells)
    }

    const ownerDurability = durabilityByOwner.get(input.ownerId)
    if (ownerDurability) {
      ownerDurability.currentDurability += input.maxDurability
      ownerDurability.maxDurability += input.maxDurability
      ownerDurability.livingGlyphCount += 1
      ownerDurability.glyphCount += 1
    } else {
      durabilityByOwner.set(input.ownerId, {
        currentDurability: input.maxDurability,
        maxDurability: input.maxDurability,
        livingGlyphCount: 1,
        glyphCount: 1,
      })
    }

    return cell
  }

  function applyDamage(
    glyphId: number,
    amount: number,
  ): number {
    requireFiniteNumber(amount, 'damage amount')
    if (amount <= 0) {
      throw new RangeError('damage amount must be greater than zero.')
    }

    const cell = cellById.get(glyphId)
    if (!cell) {
      return 0
    }

    if (cell.state === GLYPH_CELL_STATE.HUSK) {
      return 0
    }

    const ownerDurability = durabilityByOwner.get(cell.ownerId)
    if (!ownerDurability) {
      throw new Error(`Glyph ${glyphId} has no owner durability aggregate.`)
    }

    return applyGlyphDurabilityDamage(
      cell,
      ownerDurability,
      amount,
      visualTheme,
    )
  }

  function applyCracked(
    glyphId: number,
    rootAttackEventId: number,
  ): boolean {
    requirePositiveSafeInteger(rootAttackEventId, 'rootAttackEventId')
    return applyCrackedStatus(cellById.get(glyphId), rootAttackEventId)
  }

  function consumeCracked(
    glyphId: number,
    rootAttackEventId: number,
  ): boolean {
    requirePositiveSafeInteger(rootAttackEventId, 'rootAttackEventId')
    return consumeCrackedStatus(cellById.get(glyphId), rootAttackEventId)
  }

  function applyDisconnectedLatch(
    glyphId: number,
    multiplier: number,
    episodeId: number,
  ): boolean {
    return applyDisconnectedLatchStatus(
      cellById.get(glyphId),
      multiplier,
      episodeId,
    )
  }

  function clearDisconnectedLatches(
    ownerId: number,
    episodeId: number,
  ): number {
    let clearedCount = 0
    for (const glyph of cellsByOwner.get(ownerId) ?? []) {
      if (clearDisconnectedLatchStatus(glyph, episodeId)) {
        clearedCount += 1
      }
    }
    return clearedCount
  }

  function removeOwner(ownerId: number): void {
    removeGlyphOwner(ownerId, {
      cells,
      recycledCells,
      recycledOwnerCells,
      cellById,
      cellIndexById,
      cellsByOwner,
      durabilityByOwner,
    })
  }

  function applyMaterialHit(
    glyphId: number,
    directionX: number,
    directionY: number,
    material: GlyphMaterialDefinition,
  ): void {
    const cell = cellById.get(glyphId)
    if (!cell) {
      return
    }

    cell.velocityX += directionX * material.knockbackImpulse
    cell.velocityY += directionY * material.knockbackImpulse
    cell.tint = resolveGlyphImpactPresentation(
      visualTheme,
      cell.appearanceProfileId,
    ).tint
    cell.hitFlashRemainingMs = material.hitFlashDurationMs
  }

  function applySpreadFeedback(
    glyphId: number,
    durationMs: number,
    visualRoleId: PlayerAttackVisualRoleId,
  ): void {
    requireFiniteNumber(durationMs, 'spread feedback duration')
    if (durationMs <= 0) {
      throw new RangeError('spread feedback duration must be greater than zero.')
    }
    if (!isPlayerAttackVisualRoleId(visualRoleId)) {
      throw new TypeError('spread feedback visualRoleId must be registered.')
    }
    const cell = cellById.get(glyphId)
    if (!cell) {
      return
    }
    cell.spreadFlashRemainingMs = durationMs
    cell.spreadFeedbackVisualRoleId = visualRoleId
  }

  function stepMaterial(
    glyphId: number,
    deltaMs: number,
    material: GlyphMaterialDefinition,
    allowUnboundedOffset = false,
  ): void {
    const cell = cellById.get(glyphId)
    if (!cell) {
      return
    }

    const deltaSeconds = deltaMs / 1_000
    cell.velocityX -= cell.offsetX * material.springStrength * deltaSeconds
    cell.velocityY -= cell.offsetY * material.springStrength * deltaSeconds
    const dampingFactor = Math.exp(-material.damping * deltaSeconds)
    cell.velocityX *= dampingFactor
    cell.velocityY *= dampingFactor
    cell.offsetX += cell.velocityX * deltaSeconds
    cell.offsetY += cell.velocityY * deltaSeconds

    const offsetLength = Math.hypot(cell.offsetX, cell.offsetY)
    if (!allowUnboundedOffset && offsetLength > material.maximumOffset) {
      const scale = material.maximumOffset / offsetLength
      cell.offsetX *= scale
      cell.offsetY *= scale
    }

    if (cell.hitFlashRemainingMs > 0) {
      cell.hitFlashRemainingMs = Math.max(0, cell.hitFlashRemainingMs - deltaMs)
      if (cell.hitFlashRemainingMs === 0) {
        cell.tint = cell.baseTint
      }
    }
    if (cell.spreadFlashRemainingMs > 0) {
      cell.spreadFlashRemainingMs = Math.max(
        0,
        cell.spreadFlashRemainingMs - deltaMs,
      )
      if (cell.spreadFlashRemainingMs === 0) {
        cell.spreadFeedbackVisualRoleId = null
      }
    }

    if (
      Math.abs(cell.offsetX) < 0.001 &&
      Math.abs(cell.offsetY) < 0.001 &&
      Math.abs(cell.velocityX) < 0.001 &&
      Math.abs(cell.velocityY) < 0.001
    ) {
      cell.offsetX = 0
      cell.offsetY = 0
      cell.velocityX = 0
      cell.velocityY = 0
    }
  }

  function setGlyphLocalPosition(
    glyphId: number,
    localX: number,
    localY: number,
  ): void {
    updateGlyphLocalPosition(cellById.get(glyphId), localX, localY)
  }

  function setGlyphBodyMotion(
    glyphId: number,
    offsetX: number,
    offsetY: number,
    rotation: number,
  ): void {
    updateGlyphBodyMotion(
      cellById.get(glyphId),
      offsetX,
      offsetY,
      rotation,
    )
  }

  function transferGlyph(glyphId: number, newOwnerId: number): void {
    requirePositiveSafeInteger(newOwnerId, 'newOwnerId')
    const cell = cellById.get(glyphId)
    if (!cell || cell.ownerId === newOwnerId) {
      return
    }

    const oldOwnerId = cell.ownerId
    const oldOwnerCells = cellsByOwner.get(oldOwnerId)
    const oldDurability = durabilityByOwner.get(oldOwnerId)
    if (!oldOwnerCells || !oldDurability) {
      throw new Error(`Glyph ${glyphId} has an incomplete owner index.`)
    }

    const oldIndex = oldOwnerCells.indexOf(cell)
    if (oldIndex < 0) {
      throw new Error(`Glyph ${glyphId} is missing from owner ${oldOwnerId}.`)
    }
    const lastOldCell = oldOwnerCells.pop()
    if (lastOldCell && oldIndex < oldOwnerCells.length) {
      oldOwnerCells[oldIndex] = lastOldCell
    }
    oldDurability.currentDurability -= cell.currentDurability
    oldDurability.maxDurability -= cell.maxDurability
    oldDurability.glyphCount -= 1
    if (isGlyphLivingState(cell.state)) {
      oldDurability.livingGlyphCount -= 1
    }

    if (oldDurability.glyphCount === 0) {
      cellsByOwner.delete(oldOwnerId)
      durabilityByOwner.delete(oldOwnerId)
      recycledOwnerCells.push(oldOwnerCells)
    }

    const newOwnerCells = cellsByOwner.get(newOwnerId)
    if (newOwnerCells) {
      newOwnerCells.push(cell)
    } else {
      const createdOwnerCells = recycledOwnerCells.pop() ?? []
      createdOwnerCells.push(cell)
      cellsByOwner.set(newOwnerId, createdOwnerCells)
    }

    const newDurability = durabilityByOwner.get(newOwnerId)
    if (newDurability) {
      newDurability.currentDurability += cell.currentDurability
      newDurability.maxDurability += cell.maxDurability
      newDurability.glyphCount += 1
      if (isGlyphLivingState(cell.state)) {
        newDurability.livingGlyphCount += 1
      }
    } else {
      durabilityByOwner.set(newOwnerId, {
        currentDurability: cell.currentDurability,
        maxDurability: cell.maxDurability,
        glyphCount: 1,
        livingGlyphCount: isGlyphLivingState(cell.state) ? 1 : 0,
      })
    }
    cell.ownerId = newOwnerId
  }

  function setGlyphCompiledLayout(
    glyphId: number,
    topologyX: number,
    topologyY: number,
    localX: number,
    localY: number,
    offsetX: number,
    offsetY: number,
  ): void {
    updateGlyphCompiledLayout(
      cellById.get(glyphId),
      topologyX,
      topologyY,
      localX,
      localY,
      offsetX,
      offsetY,
    )
  }

  function setGlyphPresentation(
    glyphId: number,
    role: GlyphBodySlotRole,
  ): void {
    updateGlyphRolePresentation(cellById.get(glyphId), role, visualTheme)
  }

  return Object.freeze({
    get cells() {
      return cells
    },
    get poolMisses() {
      return poolMisses
    },
    createGlyph,
    getById(glyphId: number) {
      return cellById.get(glyphId)
    },
    getOwnerGlyphs(ownerId: number) {
      return cellsByOwner.get(ownerId) ?? emptyOwnerCells
    },
    getOwnerDurability(ownerId: number) {
      return durabilityByOwner.get(ownerId)
    },
    isOwnerDepleted(ownerId: number) {
      const ownerDurability = durabilityByOwner.get(ownerId)
      return (
        ownerDurability !== undefined &&
        ownerDurability.glyphCount > 0 &&
        ownerDurability.livingGlyphCount === 0
      )
    },
    applyDamage,
    applyCracked,
    consumeCracked,
    applyDisconnectedLatch,
    clearDisconnectedLatches,
    applyMaterialHit,
    applySpreadFeedback,
    stepMaterial,
    setGlyphLocalPosition,
    setGlyphBodyMotion,
    transferGlyph,
    setGlyphCompiledLayout,
    setGlyphPresentation,
    removeOwner,
  })
}
