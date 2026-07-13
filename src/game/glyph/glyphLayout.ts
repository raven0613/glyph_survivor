import { getPrintableAsciiGlyphFrame } from './glyphFrame.ts'
import type { GlyphMaterialId } from './glyphMaterial.ts'

export type GlyphBodySlotRole = 'BODY' | 'EYE'

export interface GlyphBodySlotInput {
  readonly slotId: number
  readonly role: GlyphBodySlotRole
  readonly character: string
  readonly baseCharacter?: string
  readonly topologyX: number
  readonly topologyY: number
  readonly localX: number
  readonly localY: number
  readonly maxDurability: number
  readonly collisionRadius: number
  readonly scale: number
  readonly material: GlyphMaterialId
}

export interface GlyphPoseAnchorInput {
  readonly slotId: number
  readonly localX: number
  readonly localY: number
}

export interface GlyphBodyPoseInput {
  readonly id: string
  readonly anchors: readonly GlyphPoseAnchorInput[]
}

export interface GlyphBodyInput {
  readonly id: string
  readonly expectedGlyphCount: number
  readonly slots: readonly GlyphBodySlotInput[]
  readonly poses?: readonly GlyphBodyPoseInput[]
}

export interface GlyphBodySlotDefinition extends GlyphBodySlotInput {
  readonly glyphFrame: number
  readonly baseCharacter: string
  readonly baseGlyphFrame: number
}

export type GlyphPoseAnchor = Readonly<GlyphPoseAnchorInput>

export interface GlyphBodyPoseDefinition {
  readonly id: string
  readonly anchorsBySlotId: Readonly<Record<number, Readonly<GlyphPoseAnchor>>>
}

export interface GlyphBodyDefinition {
  readonly id: string
  readonly slots: readonly Readonly<GlyphBodySlotDefinition>[]
  readonly poses: Readonly<Record<string, Readonly<GlyphBodyPoseDefinition>>>
  readonly broadPhaseRadius: number
}

function requireFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`)
  }
}

function requirePositiveNumber(value: number, name: string): void {
  requireFiniteNumber(value, name)
  if (value <= 0) {
    throw new RangeError(`${name} must be greater than zero.`)
  }
}

function requireNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`)
  }
}

function compilePose(
  bodyId: string,
  pose: GlyphBodyPoseInput,
  expectedSlotIds: ReadonlySet<number>,
): GlyphBodyPoseDefinition {
  if (pose.id.trim().length === 0) {
    throw new TypeError(`Glyph body ${bodyId} has an empty pose id.`)
  }
  if (pose.anchors.length !== expectedSlotIds.size) {
    throw new RangeError(
      `Glyph body ${bodyId} pose ${pose.id} must contain ${expectedSlotIds.size} anchors.`,
    )
  }

  const anchorsBySlotId: Record<number, Readonly<GlyphPoseAnchor>> = {}
  for (const anchor of pose.anchors) {
    if (!expectedSlotIds.has(anchor.slotId)) {
      throw new Error(
        `Glyph body ${bodyId} pose ${pose.id} references unknown slotId ${anchor.slotId}.`,
      )
    }
    if (anchorsBySlotId[anchor.slotId]) {
      throw new Error(
        `Glyph body ${bodyId} pose ${pose.id} duplicates slotId ${anchor.slotId}.`,
      )
    }
    requireFiniteNumber(anchor.localX, 'pose localX')
    requireFiniteNumber(anchor.localY, 'pose localY')
    anchorsBySlotId[anchor.slotId] = Object.freeze({ ...anchor })
  }

  return Object.freeze({
    id: pose.id,
    anchorsBySlotId: Object.freeze(anchorsBySlotId),
  })
}

export function defineGlyphBody(input: GlyphBodyInput): GlyphBodyDefinition {
  if (input.id.trim().length === 0) {
    throw new TypeError('Glyph body id must not be empty.')
  }
  if (
    !Number.isSafeInteger(input.expectedGlyphCount) ||
    input.expectedGlyphCount <= 0
  ) {
    throw new RangeError('expectedGlyphCount must be a positive safe integer.')
  }
  if (input.slots.length !== input.expectedGlyphCount) {
    throw new RangeError(
      `Glyph body ${input.id} expected ${input.expectedGlyphCount} slots but received ${input.slots.length}.`,
    )
  }

  const occupiedCoordinates = new Set<string>()
  const occupiedTopologyCoordinates = new Set<string>()
  const slotIds = new Set<number>()
  let broadPhaseRadius = 0
  const slots = input.slots.map((slot) => {
    requireNonNegativeSafeInteger(slot.slotId, 'slotId')
    if (slotIds.has(slot.slotId)) {
      throw new Error(`Glyph body ${input.id} has duplicate slotId ${slot.slotId}.`)
    }
    slotIds.add(slot.slotId)

    requireFiniteNumber(slot.localX, 'localX')
    requireFiniteNumber(slot.localY, 'localY')
    requireFiniteNumber(slot.topologyX, 'topologyX')
    requireFiniteNumber(slot.topologyY, 'topologyY')
    const topologyCoordinateKey = `${slot.topologyX},${slot.topologyY}`
    if (occupiedTopologyCoordinates.has(topologyCoordinateKey)) {
      throw new Error(
        `Glyph body ${input.id} has duplicate topology coordinate ${topologyCoordinateKey}.`,
      )
    }
    occupiedTopologyCoordinates.add(topologyCoordinateKey)
    const coordinateKey = `${slot.localX},${slot.localY}`
    if (occupiedCoordinates.has(coordinateKey)) {
      throw new Error(
        `Glyph body ${input.id} has duplicate occupied coordinate ${coordinateKey}.`,
      )
    }
    occupiedCoordinates.add(coordinateKey)

    if (!Number.isSafeInteger(slot.maxDurability) || slot.maxDurability <= 0) {
      throw new RangeError('maxDurability must be a positive safe integer.')
    }
    requirePositiveNumber(slot.collisionRadius, 'collisionRadius')
    requirePositiveNumber(slot.scale, 'scale')
    broadPhaseRadius = Math.max(
      broadPhaseRadius,
      Math.hypot(slot.localX, slot.localY) + slot.collisionRadius,
    )

    const baseCharacter = slot.baseCharacter ?? slot.character
    return Object.freeze({
      ...slot,
      glyphFrame: getPrintableAsciiGlyphFrame(slot.character),
      baseCharacter,
      baseGlyphFrame: getPrintableAsciiGlyphFrame(baseCharacter),
    })
  })

  const neutralPose: GlyphBodyPoseInput = {
    id: 'neutral',
    anchors: slots.map((slot) => ({
      slotId: slot.slotId,
      localX: slot.localX,
      localY: slot.localY,
    })),
  }
  const poses: Record<string, Readonly<GlyphBodyPoseDefinition>> = {}
  for (const pose of [neutralPose, ...(input.poses ?? [])]) {
    if (poses[pose.id]) {
      throw new Error(`Glyph body ${input.id} has duplicate pose id ${pose.id}.`)
    }
    poses[pose.id] = compilePose(input.id, pose, slotIds)
  }

  for (const pose of Object.values(poses)) {
    for (const slot of slots) {
      const anchor = pose.anchorsBySlotId[slot.slotId]
      broadPhaseRadius = Math.max(
        broadPhaseRadius,
        Math.hypot(anchor.localX, anchor.localY) + slot.collisionRadius,
      )
    }
  }

  return Object.freeze({
    id: input.id,
    slots: Object.freeze(slots),
    poses: Object.freeze(poses),
    broadPhaseRadius,
  })
}
