export interface VolatileExplosionEvent {
  id: number
  sourceGlyphId: number
  ownerId: number
  sourceMaxDurability: number
  rootAttackEventId: number
  sourceWeaponInstanceId: number
  causingApplicationId: number
  waveDepth: number
}

export interface VolatileReactionChain {
  id: number
  ownerId: number
  rootAttackEventId: number
  sourceWeaponInstanceId: number
  currentWave: VolatileExplosionEvent[]
  currentWaveIndex: number
  nextWave: VolatileExplosionEvent[]
  waveDepth: number
  waveIntervalRemainingMs: number | null
}

export interface VolatilePresentationEvent {
  id: number
  sourceGlyphId: number
  ownerId: number
  waveDepth: number
  durationMs: number
  remainingMs: number
  readonly neighborGlyphIds: number[]
  readonly neighborDirectionXs: number[]
  readonly neighborDirectionYs: number[]
  readonly joltedGlyphIds: number[]
}

export interface VolatileState {
  readonly activeChains: VolatileReactionChain[]
  readonly chainById: Map<number, VolatileReactionChain>
  readonly chainPool: VolatileReactionChain[]
  readonly explosionEventPool: VolatileExplosionEvent[]
  readonly emittedSourceGlyphIds: Set<number>
  readonly activePresentationEvents: VolatilePresentationEvent[]
  readonly presentationEventPool: VolatilePresentationEvent[]
  readonly latestSourceEventByGlyphId: Map<number, VolatilePresentationEvent>
  readonly latestJoltEventByGlyphId: Map<number, VolatilePresentationEvent>
  nextChainId: number
  nextExplosionEventId: number
  nextPresentationEventId: number
  nextChainIdForResolution: number | null
  schedulerPoolMissCount: number
  presentationPoolMissCount: number
}

export interface EnqueueVolatileSourceInput {
  readonly sourceGlyphId: number
  readonly ownerId: number
  readonly sourceMaxDurability: number
  readonly rootAttackEventId: number
  readonly sourceWeaponInstanceId: number
  readonly causingApplicationId: number
  readonly reactionChainId: number | null
  readonly appendToNextWave: boolean
}

export function createVolatileState(): VolatileState {
  return {
    activeChains: [],
    chainById: new Map(),
    chainPool: [],
    explosionEventPool: [],
    emittedSourceGlyphIds: new Set(),
    activePresentationEvents: [],
    presentationEventPool: [],
    latestSourceEventByGlyphId: new Map(),
    latestJoltEventByGlyphId: new Map(),
    nextChainId: 1,
    nextExplosionEventId: 1,
    nextPresentationEventId: 1,
    nextChainIdForResolution: null,
    schedulerPoolMissCount: 0,
    presentationPoolMissCount: 0,
  }
}

export function hasPendingVolatileSourcesForOwner(
  state: Readonly<VolatileState>,
  ownerId: number,
): boolean {
  return state.activeChains.some((chain) => chain.ownerId === ownerId)
}

export function createVolatileReactionChain(
  state: VolatileState,
  ownerId: number,
  rootAttackEventId: number,
  sourceWeaponInstanceId: number,
): VolatileReactionChain {
  const pooledChain = state.chainPool.pop()
  if (!pooledChain) {
    state.schedulerPoolMissCount += 1
  }
  const chain = pooledChain ?? ({} as VolatileReactionChain)
  Object.assign(chain, {
    id: state.nextChainId,
    ownerId,
    rootAttackEventId,
    sourceWeaponInstanceId,
    currentWave: chain.currentWave ?? [],
    currentWaveIndex: 0,
    nextWave: chain.nextWave ?? [],
    waveDepth: 0,
    waveIntervalRemainingMs: null,
  })
  chain.currentWave.length = 0
  chain.nextWave.length = 0
  state.nextChainId += 1
  state.activeChains.push(chain)
  state.chainById.set(chain.id, chain)
  return chain
}

export function enqueueVolatileSource(
  state: VolatileState,
  input: Readonly<EnqueueVolatileSourceInput>,
): number | null {
  if (state.emittedSourceGlyphIds.has(input.sourceGlyphId)) {
    return null
  }
  let chain =
    input.reactionChainId === null
      ? null
      : state.chainById.get(input.reactionChainId) ?? null
  if (!chain) {
    chain = createVolatileReactionChain(
      state,
      input.ownerId,
      input.rootAttackEventId,
      input.sourceWeaponInstanceId,
    )
  }
  if (
    chain.ownerId !== input.ownerId ||
    chain.rootAttackEventId !== input.rootAttackEventId
  ) {
    throw new Error('VOLATILE reaction source does not match its causal chain.')
  }

  const pooledEvent = state.explosionEventPool.pop()
  if (!pooledEvent) {
    state.schedulerPoolMissCount += 1
  }
  const event = pooledEvent ?? ({} as VolatileExplosionEvent)
  Object.assign(event, {
    id: state.nextExplosionEventId,
    sourceGlyphId: input.sourceGlyphId,
    ownerId: input.ownerId,
    sourceMaxDurability: input.sourceMaxDurability,
    rootAttackEventId: input.rootAttackEventId,
    sourceWeaponInstanceId: input.sourceWeaponInstanceId,
    causingApplicationId: input.causingApplicationId,
    waveDepth: input.appendToNextWave ? chain.waveDepth + 1 : chain.waveDepth,
  })
  state.nextExplosionEventId += 1
  state.emittedSourceGlyphIds.add(input.sourceGlyphId)
  if (input.appendToNextWave) {
    chain.nextWave.push(event)
  } else {
    chain.currentWave.push(event)
  }
  return chain.id
}

export function startVolatilePresentation(
  state: VolatileState,
  sourceGlyphId: number,
  ownerId: number,
  waveDepth: number,
  durationMs: number,
  neighbors: readonly Readonly<{
    id: number
    directionX: number
    directionY: number
  }>[],
  joltedGlyphIds: readonly number[],
): void {
  const pooledEvent = state.presentationEventPool.pop()
  if (!pooledEvent) {
    state.presentationPoolMissCount += 1
  }
  const event =
    pooledEvent ??
    ({
      id: 0,
      sourceGlyphId: 0,
      ownerId: 0,
      waveDepth: 0,
      durationMs: 0,
      remainingMs: 0,
      neighborGlyphIds: [],
      neighborDirectionXs: [],
      neighborDirectionYs: [],
      joltedGlyphIds: [],
    } satisfies VolatilePresentationEvent)
  Object.assign(event, {
    id: state.nextPresentationEventId,
    sourceGlyphId,
    ownerId,
    waveDepth,
    durationMs,
    remainingMs: durationMs,
  })
  state.nextPresentationEventId += 1
  event.neighborGlyphIds.length = 0
  event.neighborDirectionXs.length = 0
  event.neighborDirectionYs.length = 0
  event.joltedGlyphIds.length = 0
  for (const neighbor of neighbors) {
    event.neighborGlyphIds.push(neighbor.id)
    event.neighborDirectionXs.push(neighbor.directionX)
    event.neighborDirectionYs.push(neighbor.directionY)
  }
  event.joltedGlyphIds.push(...joltedGlyphIds)
  state.activePresentationEvents.push(event)
  state.latestSourceEventByGlyphId.set(sourceGlyphId, event)
  for (const glyphId of joltedGlyphIds) {
    state.latestJoltEventByGlyphId.set(glyphId, event)
  }
}

export function stepVolatilePresentation(
  state: VolatileState,
  deltaMs: number,
): void {
  for (let index = state.activePresentationEvents.length - 1; index >= 0; index -= 1) {
    const event = state.activePresentationEvents[index]
    event.remainingMs = Math.max(0, event.remainingMs - deltaMs)
    if (event.remainingMs > 0) {
      continue
    }
    if (state.latestSourceEventByGlyphId.get(event.sourceGlyphId) === event) {
      state.latestSourceEventByGlyphId.delete(event.sourceGlyphId)
    }
    for (const glyphId of event.joltedGlyphIds) {
      if (state.latestJoltEventByGlyphId.get(glyphId) === event) {
        state.latestJoltEventByGlyphId.delete(glyphId)
      }
    }
    state.activePresentationEvents.splice(index, 1)
    state.presentationEventPool.push(event)
  }
}
