export interface OverloadPresentationEvent {
  id: number
  glyphId: number
  directionX: number
  directionY: number
  remainingMs: number
  durationMs: number
}

export interface OverloadPresentationState {
  readonly activeEvents: OverloadPresentationEvent[]
  readonly eventPool: OverloadPresentationEvent[]
  readonly latestEventByGlyphId: Map<number, OverloadPresentationEvent>
  nextEventId: number
}

export function createOverloadPresentationState(): OverloadPresentationState {
  return {
    activeEvents: [],
    eventPool: [],
    latestEventByGlyphId: new Map(),
    nextEventId: 1,
  }
}

export function startOverloadPresentation(
  state: OverloadPresentationState,
  glyphId: number,
  directionX: number,
  directionY: number,
  durationMs: number,
): { readonly event: OverloadPresentationEvent; readonly poolMiss: boolean } {
  const directionLength = Math.hypot(directionX, directionY)
  const fallbackAngle = glyphId * 2.399963229728653
  const normalizedX =
    directionLength > 0 ? directionX / directionLength : Math.cos(fallbackAngle)
  const normalizedY =
    directionLength > 0 ? directionY / directionLength : Math.sin(fallbackAngle)
  const recycledEvent = state.eventPool.pop()
  const event = recycledEvent ?? ({} as OverloadPresentationEvent)
  Object.assign(event, {
    id: state.nextEventId,
    glyphId,
    directionX: normalizedX,
    directionY: normalizedY,
    remainingMs: durationMs,
    durationMs,
  })
  state.nextEventId += 1
  state.activeEvents.push(event)
  state.latestEventByGlyphId.set(glyphId, event)
  return { event, poolMiss: recycledEvent === undefined }
}

export function stepOverloadPresentation(
  state: OverloadPresentationState,
  deltaMs: number,
): void {
  let writeIndex = 0
  for (const event of state.activeEvents) {
    event.remainingMs = Math.max(0, event.remainingMs - deltaMs)
    if (event.remainingMs === 0) {
      if (state.latestEventByGlyphId.get(event.glyphId) === event) {
        state.latestEventByGlyphId.delete(event.glyphId)
      }
      state.eventPool.push(event)
      continue
    }
    state.activeEvents[writeIndex] = event
    writeIndex += 1
  }
  state.activeEvents.length = writeIndex
}
