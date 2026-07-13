import { getPrintableAsciiGlyphFrame } from './glyphFrame.ts'
import type { GlyphBodySlotRole } from './glyphLayout.ts'
import {
  getGlyphDurabilityTint,
  getGlyphMaterialDefinition,
  type GlyphMaterialDefinition,
} from './glyphMaterial.ts'
import {
  GLYPH_CELL_STATE,
  isGlyphLivingState,
  type CreateGlyphInput,
  type CreateGlyphStoreOptions,
  type GlyphCell,
  type GlyphStore,
  type OwnerDurability,
} from './glyphCell.ts'

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

function requirePositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`)
  }
}

function requireFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`)
  }
}

function requireNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`)
  }
}

/** Owns all mutable Glyph Cell life state and derived owner aggregates. */
export function createGlyphStore({
  onPoolMiss,
}: CreateGlyphStoreOptions = {}): GlyphStore {
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
      currentDurability: input.maxDurability,
      maxDurability: input.maxDurability,
      collisionRadius: input.collisionRadius,
      alpha: 1,
      baseTint: input.baseTint,
      tint: input.baseTint,
      hitFlashRemainingMs: 0,
      material: input.material,
      state: GLYPH_CELL_STATE.HEALTHY,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
      velocityX: 0,
      velocityY: 0,
      scale: input.scale,
      flags: 0,
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

    const appliedDamage = Math.min(amount, cell.currentDurability)
    cell.currentDurability -= appliedDamage
    ownerDurability.currentDurability -= appliedDamage
    const material = getGlyphMaterialDefinition(cell.material)

    if (cell.currentDurability === 0) {
      cell.state = GLYPH_CELL_STATE.HUSK
      cell.alpha = material.huskAlpha
      ownerDurability.livingGlyphCount -= 1
    } else {
      cell.state = GLYPH_CELL_STATE.DAMAGED
      cell.alpha = cell.currentDurability / cell.maxDurability
    }
    cell.baseTint = getGlyphDurabilityTint(
      material,
      cell.currentDurability,
      cell.role,
    )
    if (cell.hitFlashRemainingMs === 0) {
      cell.tint = cell.baseTint
    }

    return appliedDamage
  }

  function removeOwner(ownerId: number): void {
    const ownerCells = cellsByOwner.get(ownerId)
    if (!ownerCells) {
      return
    }

    for (const cell of ownerCells) {
      const cellIndex = cellIndexById.get(cell.id)
      if (cellIndex === undefined || cellById.get(cell.id) !== cell) {
        throw new Error(`Glyph ${cell.id} is missing from its owned store.`)
      }

      const lastCell = cells.pop()
      if (!lastCell) {
        throw new Error('Glyph Store active cell index is inconsistent.')
      }

      if (cellIndex < cells.length) {
        cells[cellIndex] = lastCell
        cellIndexById.set(lastCell.id, cellIndex)
      }

      cellById.delete(cell.id)
      cellIndexById.delete(cell.id)
      recycledCells.push(cell)
    }

    cellsByOwner.delete(ownerId)
    ownerCells.length = 0
    recycledOwnerCells.push(ownerCells)
    durabilityByOwner.delete(ownerId)
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
    cell.tint = material.hitTint
    cell.hitFlashRemainingMs = material.hitFlashDurationMs
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
    requireFiniteNumber(localX, 'localX')
    requireFiniteNumber(localY, 'localY')
    const cell = cellById.get(glyphId)
    if (!cell) {
      return
    }
    cell.localX = localX
    cell.localY = localY
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
    const values = { topologyX, topologyY, localX, localY, offsetX, offsetY }
    for (const [name, value] of Object.entries(values)) {
      requireFiniteNumber(value, name)
    }
    const cell = cellById.get(glyphId)
    if (!cell) {
      return
    }
    Object.assign(cell, {
      topologyX,
      topologyY,
      layoutBaseX: localX,
      layoutBaseY: localY,
      localX,
      localY,
      offsetX,
      offsetY,
    })
  }

  function setGlyphPresentation(
    glyphId: number,
    role: GlyphBodySlotRole,
  ): void {
    const cell = cellById.get(glyphId)
    if (!cell) {
      return
    }
    cell.role = role
    cell.character = role === 'EYE' ? 'O' : cell.baseCharacter
    cell.glyphFrame =
      role === 'EYE'
        ? getPrintableAsciiGlyphFrame('O')
        : cell.baseGlyphFrame
    cell.baseTint = getGlyphDurabilityTint(
      getGlyphMaterialDefinition(cell.material),
      cell.currentDurability,
      role,
    )
    if (cell.hitFlashRemainingMs === 0) {
      cell.tint = cell.baseTint
    }
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
    applyMaterialHit,
    stepMaterial,
    setGlyphLocalPosition,
    transferGlyph,
    setGlyphCompiledLayout,
    setGlyphPresentation,
    removeOwner,
  })
}
