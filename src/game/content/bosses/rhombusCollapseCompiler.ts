import { hashSeed } from '../../core/seededRng.ts'

export interface RhombusCollapseSourceSlot {
  readonly slotId: number
  readonly topologyX: number
  readonly topologyY: number
}

export interface PreparedRhombusCollapseSlotPlan {
  readonly bodySlotId: number
  readonly laneOffset: -1 | 0 | 1
  readonly horizontalJitterRatio: number
  readonly stackStepRatio: number
  readonly fallDelayJitterRatio: number
  readonly rotationRatio: number
}

function stableUnit(seed: string, slotId: number, channel: string): number {
  return hashSeed(`${seed}:${slotId}:${channel}`) / 0x1_0000_0000
}

export function compileRhombusCollapseSlots(
  slots: readonly Readonly<RhombusCollapseSourceSlot>[],
  seed: string,
): readonly Readonly<PreparedRhombusCollapseSlotPlan>[] {
  if (seed.trim().length === 0) {
    throw new TypeError('RHOMBUS collapse-plan seed must not be empty.')
  }
  const slotIds = new Set<number>()
  const plans = slots.map((slot) => {
    if (!Number.isSafeInteger(slot.slotId) || slot.slotId < 0) {
      throw new TypeError('RHOMBUS collapse-plan slot IDs must be non-negative safe integers.')
    }
    if (slotIds.has(slot.slotId)) {
      throw new Error(`RHOMBUS collapse plan has duplicate slot ${slot.slotId}.`)
    }
    if (
      !Number.isSafeInteger(slot.topologyX) ||
      !Number.isSafeInteger(slot.topologyY)
    ) {
      throw new TypeError('RHOMBUS collapse-plan topology coordinates must be safe integers.')
    }
    slotIds.add(slot.slotId)
    const laneSelector = stableUnit(seed, slot.slotId, 'lane')
    return Object.freeze({
      bodySlotId: slot.slotId,
      laneOffset: (laneSelector < 1 / 3
        ? -1
        : laneSelector < 2 / 3
          ? 0
          : 1) as -1 | 0 | 1,
      horizontalJitterRatio:
        stableUnit(seed, slot.slotId, 'horizontal') * 2 - 1,
      stackStepRatio: stableUnit(seed, slot.slotId, 'stack'),
      fallDelayJitterRatio: stableUnit(seed, slot.slotId, 'delay'),
      rotationRatio: stableUnit(seed, slot.slotId, 'rotation') * 2 - 1,
    })
  })
  return Object.freeze(plans)
}
