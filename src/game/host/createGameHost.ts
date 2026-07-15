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
import { clearRenderSnapshot } from '../bridge/renderSnapshotLifecycle.ts'
import {
  prepareGameContent,
  type PreparedGameContent,
} from '../content/gameContent.ts'
import { createRenderAdapter } from '../rendering/createRenderAdapter.ts'
import { createGameLoop } from '../runtime/createGameLoop.ts'
import { GAME_PHASE, gameMachine } from '../runtime/gameMachine.ts'
import {
  SIMULATION_STEP_RESULT,
  runSimulationStep,
} from '../runtime/runSimulationStep.ts'
import type { UpgradeOffer } from '../runtime/upgradeState.ts'
import { createWorldState, type WorldState } from '../runtime/worldState.ts'
import { getXpToNextLevel } from '../content/upgrades/levelProgression.ts'
import {
  installModuleFromOffer,
  type InstallModuleCommand,
} from '../systems/moduleInstallation.ts'
import {
  acquireWeaponFromOffer,
  type AcquireWeaponCommand,
} from '../systems/weaponAcquisition.ts'
import { createInputAdapter } from './createInputAdapter.ts'
import {
  getUnlockedInitialWeaponDefinition,
  prepareRunWeaponUnlocks,
  requireEligibleFirstOfferWeapon,
  type RunWeaponUnlocks,
} from './runWeaponUnlocks.ts'
import { createLoadoutUiSummaries } from './createLoadoutUiSummaries.ts'

export interface StartRunOptions {
  readonly seed: string | number
  readonly initialWeaponDefinitionId: string
}

export type UiSnapshotListener = (snapshot: Readonly<UiSnapshot>) => void

export interface GameHost {
  startRun(options: StartRunOptions): void
  acquireWeapon(options: AcquireWeaponCommand): void
  installModule(options: InstallModuleCommand): void
  returnToMainMenu(): void
  subscribeUi(listener: UiSnapshotListener): () => void
  getUiSnapshot(): Readonly<UiSnapshot>
  dispose(): void
}

export interface CreateGameHostOptions {
  readonly canvas: HTMLCanvasElement
  readonly unlockedWeaponDefinitionIds: readonly string[]
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
        currentHealth: world.player.survival.currentHealth,
        maximumHealth: world.player.survival.maximumHealth,
        currentShieldLayers: world.player.survival.currentShieldLayers,
        maximumShieldLayers: world.player.survival.maximumShieldLayers,
        runResult: world.runResult,
        xp: world.player.xpIntoLevel,
        xpToNext: getXpToNextLevel(
          world.content.levelProgression,
          world.player.level,
        ),
        level: world.player.level,
        runTimeMs: world.runTimeMs,
        enemyCount: world.enemies.length,
      }
    : {
        currentHealth: 0,
        maximumHealth: 0,
        currentShieldLayers: 0,
        maximumShieldLayers: 0,
        runResult: null,
        xp: 0,
        xpToNext: 5,
        level: 1,
        runTimeMs: 0,
        enemyCount: 0,
      }
}

/** Owns browser adapters, authoritative runtime state, and lifecycle commands. */
export async function createGameHost({
  canvas,
  unlockedWeaponDefinitionIds,
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
  let runWeaponUnlocks: Readonly<RunWeaponUnlocks> | null = null

  function publishUi(): void {
    const machineSnapshot = gameActor.getSnapshot()
    currentUiSnapshot = createUiSnapshot(
      machineSnapshot,
      getGameplayUi(world),
      machineSnapshot.value === GAME_PHASE.READY
        ? runWeaponUnlocks?.initialWeaponChoices
        : undefined,
      world
        ? createLoadoutUiSummaries(world.content, world.weaponLoadout)
        : undefined,
      world?.weaponLoadout.maximumEquippedWeapons,
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
    runWeaponUnlocks = prepareRunWeaponUnlocks(
      gameContent,
      unlockedWeaponDefinitionIds,
    )
    renderAdapter = await createRenderAdapter(
      canvas,
      gameContent.combatVisualTheme,
      signal,
    )
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
      const stepResult = runSimulationStep(world, fixedStepMs)
      if (stepResult === SIMULATION_STEP_RESULT.PLAYER_DIED) {
        inputAdapter.clearMovement()
        world.input.horizontal = 0
        world.input.vertical = 0
        gameActor.send({ type: 'PLAYER_DIED' })
        publishUi()
        return
      }
      if (
        stepResult === SIMULATION_STEP_RESULT.UPGRADE_OFFERED &&
        world.upgradeState.activeOffer
      ) {
        inputAdapter.clearMovement()
        world.input.horizontal = 0
        world.input.vertical = 0
        gameActor.send({
          type: 'UPGRADE_OFFERED',
          offerId: world.upgradeState.activeOffer.id,
          choices: world.upgradeState.activeOffer.choices,
          pendingUpgradeCount: world.upgradeState.pendingUpgradeCount,
        })
        publishUi()
      }
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

  function publishUpgradeCommandResult(
    result:
      | {
          readonly ok: true
          readonly choiceId: string
          readonly nextOffer: Readonly<UpgradeOffer> | null
        }
      | { readonly ok: false; readonly error: string },
  ): void {
    if (!result.ok) {
      gameActor.send({
        type: 'UPGRADE_COMMAND_REJECTED',
        error: result.error,
      })
      publishUi()
      return
    }

    inputAdapter.clearMovement()
    gameActor.send({
      type: 'UPGRADE_COMMITTED',
      choiceId: result.choiceId,
    })
    if (result.nextOffer && world) {
      gameActor.send({
        type: 'UPGRADE_OFFERED',
        offerId: result.nextOffer.id,
        choices: result.nextOffer.choices,
        pendingUpgradeCount: world.upgradeState.pendingUpgradeCount,
      })
    }
    publishUi()
  }

  return Object.freeze({
    startRun({ seed, initialWeaponDefinitionId }: StartRunOptions) {
      if (isDisposed) {
        return
      }

      if (!isValidSeed(seed)) {
        throw new TypeError(
          'startRun requires a non-empty string or finite number seed.',
        )
      }

      const initialWeaponDefinition = getUnlockedInitialWeaponDefinition(
        gameContent,
        runWeaponUnlocks,
        initialWeaponDefinitionId,
      )
      requireEligibleFirstOfferWeapon(
        runWeaponUnlocks,
        initialWeaponDefinition.id,
      )

      if (gameActor.getSnapshot().value !== GAME_PHASE.READY) {
        return
      }

      const viewport = renderAdapter.getViewportSize()
      world = createWorldState(
        seed,
        viewport.width,
        viewport.height,
        gameContent,
        initialWeaponDefinition.id,
        runWeaponUnlocks.definitionIds,
      )
      gameActor.send({ type: 'START_RUN', seed })
    },

    acquireWeapon(options: AcquireWeaponCommand) {
      if (
        isDisposed ||
        !world ||
        gameActor.getSnapshot().value !== GAME_PHASE.PAUSED_UPGRADE
      ) {
        return
      }

      publishUpgradeCommandResult(acquireWeaponFromOffer(world, options))
    },

    installModule(options: InstallModuleCommand) {
      if (
        isDisposed ||
        !world ||
        gameActor.getSnapshot().value !== GAME_PHASE.PAUSED_UPGRADE
      ) {
        return
      }

      publishUpgradeCommandResult(installModuleFromOffer(world, options))
    },

    returnToMainMenu() {
      if (
        isDisposed ||
        !world ||
        gameActor.getSnapshot().value !== GAME_PHASE.GAME_OVER
      ) {
        return
      }

      inputAdapter.reset()
      clearRenderSnapshot(renderSnapshot)
      renderAdapter.clear()
      world = null
      lastUiPublishTimeMs = 0
      gameActor.send({ type: 'RETURN_TO_MAIN_MENU' })
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
