import { createActor } from 'xstate'
import {
  INITIAL_UI_SNAPSHOT,
  createUiSnapshot,
  type GameplayUiData,
  type UiSnapshot,
} from '../bridge/uiSnapshot.ts'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../bridge/renderSnapshot.ts'
import {
  prepareGameContent,
  type PreparedGameContent,
} from '../content/gameContent.ts'
import { createRenderAdapter } from '../rendering/createRenderAdapter.ts'
import { createGameLoop } from '../runtime/createGameLoop.ts'
import { GAME_PHASE, gameMachine } from '../runtime/gameMachine.ts'
import { runSimulationStep } from '../runtime/runSimulationStep.ts'
import { createWorldState, type WorldState } from '../runtime/worldState.ts'
import { createInputAdapter } from './createInputAdapter.ts'

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

export interface CreateGameHostOptions {
  readonly canvas: HTMLCanvasElement
  readonly signal?: AbortSignal
}

const UI_PUBLISH_INTERVAL_MS = 250

function isValidSeed(seed: unknown): seed is string | number {
  return (
    (typeof seed === 'string' && seed.length > 0) ||
    (typeof seed === 'number' && Number.isFinite(seed))
  )
}

function getGameplayUi(world: WorldState | null): GameplayUiData {
  return world
    ? {
        xp: world.player.xp,
        level: world.player.level,
        runTimeMs: world.runTimeMs,
        enemyCount: world.enemies.length,
      }
    : { xp: 0, level: 1, runTimeMs: 0, enemyCount: 0 }
}

/** Owns browser adapters, authoritative runtime state, and lifecycle commands. */
export async function createGameHost({
  canvas,
  signal,
}: CreateGameHostOptions): Promise<GameHost> {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new TypeError('createGameHost requires an HTML canvas element.')
  }

  const uiListeners = new Set<UiSnapshotListener>()
  const gameActor = createActor(gameMachine)
  const renderSnapshot = createRenderSnapshot()
  let world: WorldState | null = null
  let currentUiSnapshot = INITIAL_UI_SNAPSHOT
  let isDisposed = false
  let lastUiPublishTimeMs = 0

  function publishUi(): void {
    currentUiSnapshot = createUiSnapshot(
      gameActor.getSnapshot(),
      getGameplayUi(world),
    )
    uiListeners.forEach((listener) => listener(currentUiSnapshot))
  }

  const actorSubscription = gameActor.subscribe(publishUi)
  gameActor.start()
  gameActor.send({ type: 'INITIALIZE' })

  let gameContent: PreparedGameContent
  let renderAdapter
  try {
    gameContent = prepareGameContent()
    renderAdapter = await createRenderAdapter(canvas, signal)
  } catch (error) {
    gameActor.send({ type: 'LOAD_FAILED', error })
    actorSubscription.unsubscribe()
    gameActor.stop()
    throw error
  }

  const inputAdapter = createInputAdapter(canvas, () =>
    renderAdapter.getViewportSize(),
  )
  const gameLoop = createGameLoop({
    shouldStep: () =>
      world !== null && gameActor.getSnapshot().value === GAME_PHASE.RUNNING,
    step: (fixedStepMs) => {
      if (!world) {
        return
      }

      inputAdapter.sample(world.input)
      runSimulationStep(world, fixedStepMs)
    },
    render: (interpolationAlpha) => {
      if (!world) {
        return
      }

      const viewport = renderAdapter.getViewportSize()
      world.viewportWidth = viewport.width
      world.viewportHeight = viewport.height
      writeRenderSnapshot(world, renderSnapshot, interpolationAlpha)
      renderAdapter.render(renderSnapshot)

      const nowMs = performance.now()
      if (nowMs - lastUiPublishTimeMs >= UI_PUBLISH_INTERVAL_MS) {
        lastUiPublishTimeMs = nowMs
        publishUi()
      }
    },
    recordDroppedTime: (droppedTimeMs) => {
      if (world) {
        world.diagnostics.droppedSimulationTimeMs += droppedTimeMs
      }
    },
  })

  gameActor.send({ type: 'LOAD_SUCCEEDED' })
  gameLoop.start()

  return Object.freeze({
    startRun({ seed }: StartRunOptions) {
      if (isDisposed) {
        return
      }

      if (!isValidSeed(seed)) {
        throw new TypeError(
          'startRun requires a non-empty string or finite number seed.',
        )
      }

      if (gameActor.getSnapshot().value !== GAME_PHASE.READY) {
        return
      }

      const viewport = renderAdapter.getViewportSize()
      world = createWorldState(
        seed,
        viewport.width,
        viewport.height,
        gameContent,
      )
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
      return () => uiListeners.delete(listener)
    },

    getUiSnapshot() {
      return currentUiSnapshot
    },

    dispose() {
      if (isDisposed) {
        return
      }

      isDisposed = true
      gameLoop.dispose()
      inputAdapter.dispose()
      renderAdapter.dispose()
      gameActor.send({ type: 'DISPOSE' })
      actorSubscription.unsubscribe()
      gameActor.stop()
      uiListeners.clear()
      world = null
    },
  })
}
