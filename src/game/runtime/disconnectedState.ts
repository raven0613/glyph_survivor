import type { DisconnectedOwnerTopologySnapshot } from '../glyph/disconnectedTopology.ts'

export interface DisconnectedHitPresentationEvent {
  id: number
  componentId: number
  glyphIds: readonly number[]
  severity: number
  directionX: number
  directionY: number
  durationMs: number
  remainingMs: number
}

export interface DisconnectedState {
  readonly topologyByOwnerId: Map<
    number,
    Readonly<DisconnectedOwnerTopologySnapshot>
  >
  readonly activeHitEvents: DisconnectedHitPresentationEvent[]
  readonly hitEventPool: DisconnectedHitPresentationEvent[]
  readonly latestHitEventByGlyphId: Map<
    number,
    DisconnectedHitPresentationEvent
  >
  nextHitEventId: number
  nextReassemblyEpisodeId: number
}

export function createDisconnectedState(): DisconnectedState {
  return {
    topologyByOwnerId: new Map(),
    activeHitEvents: [],
    hitEventPool: [],
    latestHitEventByGlyphId: new Map(),
    nextHitEventId: 1,
    nextReassemblyEpisodeId: 1,
  }
}

export function startDisconnectedHitPresentation(
  state: DisconnectedState,
  componentId: number,
  glyphIds: readonly number[],
  severity: number,
  directionX: number,
  directionY: number,
  durationMs: number,
): { readonly poolMiss: boolean } {
  const directionLength = Math.hypot(directionX, directionY)
  const fallbackAngle = componentId * 2.399963229728653
  const event =
    state.hitEventPool.pop() ?? ({} as DisconnectedHitPresentationEvent)
  const poolMiss = event.id === undefined
  Object.assign(event, {
    id: state.nextHitEventId,
    componentId,
    glyphIds,
    severity,
    directionX:
      directionLength > 0
        ? directionX / directionLength
        : Math.cos(fallbackAngle),
    directionY:
      directionLength > 0
        ? directionY / directionLength
        : Math.sin(fallbackAngle),
    durationMs,
    remainingMs: durationMs,
  })
  state.nextHitEventId += 1
  state.activeHitEvents.push(event)
  for (const glyphId of glyphIds) {
    state.latestHitEventByGlyphId.set(glyphId, event)
  }
  return { poolMiss }
}

export function stepDisconnectedHitPresentation(
  state: DisconnectedState,
  deltaMs: number,
): void {
  let writeIndex = 0
  for (const event of state.activeHitEvents) {
    event.remainingMs = Math.max(0, event.remainingMs - deltaMs)
    if (event.remainingMs === 0) {
      for (const glyphId of event.glyphIds) {
        if (state.latestHitEventByGlyphId.get(glyphId) === event) {
          state.latestHitEventByGlyphId.delete(glyphId)
        }
      }
      state.hitEventPool.push(event)
      continue
    }
    state.activeHitEvents[writeIndex] = event
    writeIndex += 1
  }
  state.activeHitEvents.length = writeIndex
}
