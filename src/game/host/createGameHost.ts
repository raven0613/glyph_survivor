import { createActor } from 'xstate'
import {
  INITIAL_UI_SNAPSHOT,
  createUiSnapshot,
  type UiSnapshot,
} from '../bridge/uiSnapshot.ts'
import { gameMachine } from '../runtime/gameMachine.ts'

export interface CanvasPort {
  getContext(...args: never[]): unknown
}

export interface StartRunOptions {
  readonly seed: string | number
}

export type UiSnapshotListener = (snapshot: Readonly<UiSnapshot>) => void

export interface GameHost {
  startRun(options: StartRunOptions): void
  subscribeUi(listener: UiSnapshotListener): () => void
  getUiSnapshot(): Readonly<UiSnapshot>
  dispose(): void
}

function isValidSeed(seed: unknown): seed is string | number {
  return (
    (typeof seed === 'string' && seed.length > 0) ||
    (typeof seed === 'number' && Number.isFinite(seed))
  )
}

/**
 * Owns the lifecycle actor and exposes only commands plus immutable UI snapshots.
 * Pixi initialization will be added behind this boundary in a later slice.
 */
export function createGameHost({ canvas }: { readonly canvas: CanvasPort }): GameHost {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new TypeError('createGameHost requires a canvas-like object.')
  }

  const uiListeners = new Set<UiSnapshotListener>()
  const gameActor = createActor(gameMachine)
  let currentUiSnapshot = INITIAL_UI_SNAPSHOT
  let isDisposed = false

  const actorSubscription = gameActor.subscribe((machineSnapshot) => {
    currentUiSnapshot = createUiSnapshot(machineSnapshot)
    uiListeners.forEach((listener) => listener(currentUiSnapshot))
  })

  gameActor.start()
  gameActor.send({ type: 'INITIALIZE' })
  gameActor.send({ type: 'LOAD_SUCCEEDED' })

  return Object.freeze({
    startRun({ seed }: StartRunOptions) {
      if (isDisposed) {
        return
      }

      if (!isValidSeed(seed)) {
        throw new TypeError('startRun requires a non-empty string or finite number seed.')
      }

      gameActor.send({ type: 'START_RUN', seed })
    },

    subscribeUi(listener: UiSnapshotListener) {
      if (typeof listener !== 'function') {
        throw new TypeError('subscribeUi requires a listener function.')
      }

      if (isDisposed) {
        listener(currentUiSnapshot)
        return () => {}
      }

      uiListeners.add(listener)
      listener(currentUiSnapshot)

      return () => {
        uiListeners.delete(listener)
      }
    },

    getUiSnapshot() {
      return currentUiSnapshot
    },

    dispose() {
      if (isDisposed) {
        return
      }

      gameActor.send({ type: 'DISPOSE' })
      actorSubscription.unsubscribe()
      gameActor.stop()
      uiListeners.clear()
      isDisposed = true
    },
  })
}
