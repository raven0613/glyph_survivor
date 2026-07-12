import type { GlyphMaterialDefinition, GlyphMaterialId } from './glyphMaterial.ts'

export const GLYPH_CELL_STATE = Object.freeze({
  ALIVE: 'ALIVE',
  DESTROYED: 'DESTROYED',
} as const)

export type GlyphCellState =
  (typeof GLYPH_CELL_STATE)[keyof typeof GLYPH_CELL_STATE]

export { GLYPH_MATERIAL } from './glyphMaterial.ts'
export type { GlyphMaterialId } from './glyphMaterial.ts'

export interface GlyphCell {
  readonly id: number
  readonly ownerId: number
  readonly bodySlotId: number
  readonly character: string
  readonly glyphFrame: number
  readonly localX: number
  readonly localY: number
  readonly currentDurability: number
  readonly maxDurability: number
  readonly collisionRadius: number
  readonly alpha: number
  readonly baseTint: number
  readonly tint: number
  readonly hitFlashRemainingMs: number
  readonly material: GlyphMaterialId
  readonly state: GlyphCellState
  readonly rotation: number
  readonly offsetX: number
  readonly offsetY: number
  readonly velocityX: number
  readonly velocityY: number
  readonly scale: number
  readonly flags: number
}

export interface OwnerDurability {
  readonly currentDurability: number
  readonly maxDurability: number
  readonly aliveGlyphCount: number
  readonly glyphCount: number
}

export interface CreateGlyphInput {
  readonly ownerId: number
  readonly bodySlotId: number
  readonly character: string
  readonly glyphFrame: number
  readonly maxDurability: number
  readonly collisionRadius: number
  readonly scale: number
  readonly material: GlyphMaterialId
  readonly baseTint: number
  readonly localX?: number
  readonly localY?: number
}

export interface GlyphStore {
  readonly cells: readonly GlyphCell[]
  readonly poolMisses: number
  createGlyph(input: CreateGlyphInput): GlyphCell
  getById(glyphId: number): GlyphCell | undefined
  getOwnerGlyphs(ownerId: number): readonly GlyphCell[]
  getOwnerDurability(ownerId: number): Readonly<OwnerDurability> | undefined
  isOwnerDestroyed(ownerId: number): boolean
  applyDamage(glyphId: number, amount: number): number
  applyMaterialHit(
    glyphId: number,
    directionX: number,
    directionY: number,
    material: GlyphMaterialDefinition,
    baseTint: number,
  ): void
  stepMaterial(
    glyphId: number,
    deltaMs: number,
    material: GlyphMaterialDefinition,
  ): void
  setGlyphLocalPosition(glyphId: number, localX: number, localY: number): void
  removeOwner(ownerId: number): void
}

export interface CreateGlyphStoreOptions {
  readonly onPoolMiss?: () => void
}

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
      state: GLYPH_CELL_STATE.ALIVE,
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
      ownerDurability.aliveGlyphCount += 1
      ownerDurability.glyphCount += 1
    } else {
      durabilityByOwner.set(input.ownerId, {
        currentDurability: input.maxDurability,
        maxDurability: input.maxDurability,
        aliveGlyphCount: 1,
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

    if (cell.state === GLYPH_CELL_STATE.DESTROYED) {
      return 0
    }

    const ownerDurability = durabilityByOwner.get(cell.ownerId)
    if (!ownerDurability) {
      throw new Error(`Glyph ${glyphId} has no owner durability aggregate.`)
    }

    const appliedDamage = Math.min(amount, cell.currentDurability)
    cell.currentDurability -= appliedDamage
    cell.alpha = cell.currentDurability / cell.maxDurability
    ownerDurability.currentDurability -= appliedDamage
    const destroyed = cell.currentDurability === 0

    if (destroyed) {
      cell.state = GLYPH_CELL_STATE.DESTROYED
      ownerDurability.aliveGlyphCount -= 1
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
    baseTint: number,
  ): void {
    const cell = cellById.get(glyphId)
    if (!cell || cell.state === GLYPH_CELL_STATE.DESTROYED) {
      return
    }

    cell.velocityX += directionX * material.knockbackImpulse
    cell.velocityY += directionY * material.knockbackImpulse
    cell.baseTint = baseTint
    cell.tint = material.hitTint
    cell.hitFlashRemainingMs = material.hitFlashDurationMs
  }

  function stepMaterial(
    glyphId: number,
    deltaMs: number,
    material: GlyphMaterialDefinition,
  ): void {
    const cell = cellById.get(glyphId)
    if (!cell || cell.state === GLYPH_CELL_STATE.DESTROYED) {
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
    if (offsetLength > material.maximumOffset) {
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
    isOwnerDestroyed(ownerId: number) {
      const ownerDurability = durabilityByOwner.get(ownerId)
      return (
        ownerDurability !== undefined &&
        ownerDurability.glyphCount > 0 &&
        ownerDurability.aliveGlyphCount === 0
      )
    },
    applyDamage,
    applyMaterialHit,
    stepMaterial,
    setGlyphLocalPosition,
    removeOwner,
  })
}
