import { assign, setup } from 'xstate'

export const GAME_PHASE = Object.freeze({
  BOOT: 'BOOT',
  LOADING: 'LOADING',
  READY: 'READY',
  RUNNING: 'RUNNING',
  PAUSED_MENU: 'PAUSED_MENU',
  PAUSED_UPGRADE: 'PAUSED_UPGRADE',
  GAME_OVER: 'GAME_OVER',
  DISPOSED: 'DISPOSED',
})

export type GamePhase = (typeof GAME_PHASE)[keyof typeof GAME_PHASE]

const REQUIRED_UPGRADE_CHOICE_COUNT = 3
const INVALID_UPGRADE_OFFER_ERROR =
  'Invalid upgrade offer: expected three choices with unique, non-empty IDs.'
const INVALID_UPGRADE_SELECTION_ERROR =
  'Invalid upgrade selection: the choice is not part of the active offer.'
const LOAD_FAILURE_FALLBACK_ERROR = 'Game initialization failed.'

/** A UI-sized reference to an authoritative runtime upgrade definition. */
export interface UpgradeChoice {
  readonly id: string
  readonly title?: string
  readonly description?: string
}

export interface GameMachineContext {
  readonly seed: string | number | null
  readonly upgradeChoices: readonly Readonly<UpgradeChoice>[]
  readonly pendingUpgradeCount: number
  readonly recoverableError: string | null
}

type UpgradeOfferedEvent = {
  readonly type: 'UPGRADE_OFFERED'
  readonly choices: readonly UpgradeChoice[]
  readonly pendingUpgradeCount?: number
}

type SelectUpgradeEvent = {
  readonly type: 'SELECT_UPGRADE'
  readonly choiceId: string
}

export type GameMachineEvent =
  | { readonly type: 'INITIALIZE' }
  | { readonly type: 'LOAD_SUCCEEDED' }
  | { readonly type: 'LOAD_FAILED'; readonly error: unknown }
  | { readonly type: 'START_RUN'; readonly seed: string | number }
  | { readonly type: 'PAUSE_REQUESTED' }
  | { readonly type: 'RESUME_REQUESTED' }
  | UpgradeOfferedEvent
  | SelectUpgradeEvent
  | { readonly type: 'PLAYER_DIED' }
  | { readonly type: 'RESTART'; readonly seed?: string | number }
  | { readonly type: 'DISPOSE' }

function createInitialContext(): GameMachineContext {
  return {
    seed: null,
    upgradeChoices: Object.freeze([]),
    pendingUpgradeCount: 0,
    recoverableError: null,
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return LOAD_FAILURE_FALLBACK_ERROR
}

function hasValidChoiceId(choice: unknown): choice is UpgradeChoice {
  return (
    choice !== null &&
    typeof choice === 'object' &&
    'id' in choice &&
    typeof choice.id === 'string' &&
    choice.id.trim().length > 0
  )
}

function hasValidUpgradeChoices(
  choices: unknown,
): choices is readonly UpgradeChoice[] {
  if (!Array.isArray(choices) || choices.length !== REQUIRED_UPGRADE_CHOICE_COUNT) {
    return false
  }

  if (!choices.every(hasValidChoiceId)) {
    return false
  }

  return new Set(choices.map((choice) => choice.id)).size === choices.length
}

function hasValidPendingUpgradeCount(
  pendingUpgradeCount: unknown,
): pendingUpgradeCount is number | undefined {
  return (
    pendingUpgradeCount === undefined ||
    (typeof pendingUpgradeCount === 'number' &&
      Number.isInteger(pendingUpgradeCount) &&
      pendingUpgradeCount > 0)
  )
}

function isValidUpgradeOffer(
  event: GameMachineEvent,
): event is UpgradeOfferedEvent {
  return (
    event.type === 'UPGRADE_OFFERED' &&
    hasValidUpgradeChoices(event.choices) &&
    hasValidPendingUpgradeCount(event.pendingUpgradeCount)
  )
}

function isOfferedChoice(
  context: GameMachineContext,
  event: GameMachineEvent,
): event is SelectUpgradeEvent {
  return (
    event.type === 'SELECT_UPGRADE' &&
    typeof event.choiceId === 'string' &&
    context.upgradeChoices.some((choice) => choice.id === event.choiceId)
  )
}

function copyUpgradeChoices(
  choices: readonly UpgradeChoice[],
): readonly Readonly<UpgradeChoice>[] {
  return Object.freeze(
    choices.map((choice) => Object.freeze({ ...choice })),
  )
}

const gameMachineSetup = setup({
  types: {} as {
    context: GameMachineContext
    events: GameMachineEvent
  },
  actions: {
    // GameHost replaces this named action with the authoritative upgrade port.
    applySelectedUpgrade: () => {},
    assignInvalidUpgradeOfferError: assign({
      recoverableError: () => INVALID_UPGRADE_OFFER_ERROR,
    }),
    assignInvalidUpgradeSelectionError: assign({
      recoverableError: () => INVALID_UPGRADE_SELECTION_ERROR,
    }),
    assignLoadFailure: assign(({ event }) => {
      if (event.type !== 'LOAD_FAILED') {
        return {}
      }

      return { recoverableError: getErrorMessage(event.error) }
    }),
    assignUpgradeOffer: assign(({ event }) => {
      if (!isValidUpgradeOffer(event)) {
        return {}
      }

      return {
        upgradeChoices: copyUpgradeChoices(event.choices),
        pendingUpgradeCount: event.pendingUpgradeCount ?? 1,
        recoverableError: null,
      }
    }),
    clearCompletedUpgrade: assign({
      upgradeChoices: () => Object.freeze([]),
      pendingUpgradeCount: () => 0,
      recoverableError: () => null,
    }),
    clearRecoverableError: assign({
      recoverableError: () => null,
    }),
    consumeQueuedUpgrade: assign(({ context }) => ({
      upgradeChoices: Object.freeze([]),
      pendingUpgradeCount: context.pendingUpgradeCount - 1,
      recoverableError: null,
    })),
    resetRunContext: assign(({ event }) => {
      const seed =
        event.type === 'START_RUN' || event.type === 'RESTART'
          ? (event.seed ?? null)
          : null

      return {
        seed,
        upgradeChoices: Object.freeze([]),
        pendingUpgradeCount: 0,
        recoverableError: null,
      }
    }),
  },
  guards: {
    canAcceptNextUpgradeOffer: ({ context, event }) =>
      context.upgradeChoices.length === 0 && isValidUpgradeOffer(event),
    hasQueuedUpgradeAfterSelection: ({ context, event }) =>
      context.pendingUpgradeCount > 1 && isOfferedChoice(context, event),
    isOfferedUpgradeChoice: ({ context, event }) =>
      isOfferedChoice(context, event),
    isValidUpgradeOffer: ({ event }) => isValidUpgradeOffer(event),
  },
})

/**
 * Top-level lifecycle machine for one game run.
 *
 * World entities and fixed-step simulation data deliberately remain outside
 * this machine. GameHost should gate simulation steps on the RUNNING phase and
 * provide the `applySelectedUpgrade` action when wiring the runtime.
 */
export const gameMachine = gameMachineSetup.createMachine({
  id: 'game',
  initial: GAME_PHASE.BOOT,
  context: createInitialContext,
  on: {
    DISPOSE: {
      target: `.${GAME_PHASE.DISPOSED}`,
    },
  },
  states: {
    [GAME_PHASE.BOOT]: {
      on: {
        INITIALIZE: GAME_PHASE.LOADING,
      },
    },
    [GAME_PHASE.LOADING]: {
      on: {
        LOAD_SUCCEEDED: {
          target: GAME_PHASE.READY,
          actions: 'clearRecoverableError',
        },
        LOAD_FAILED: {
          actions: 'assignLoadFailure',
        },
      },
    },
    [GAME_PHASE.READY]: {
      on: {
        START_RUN: {
          target: GAME_PHASE.RUNNING,
          actions: 'resetRunContext',
        },
      },
    },
    [GAME_PHASE.RUNNING]: {
      on: {
        PAUSE_REQUESTED: GAME_PHASE.PAUSED_MENU,
        UPGRADE_OFFERED: [
          {
            guard: 'isValidUpgradeOffer',
            target: GAME_PHASE.PAUSED_UPGRADE,
            actions: 'assignUpgradeOffer',
          },
          {
            actions: 'assignInvalidUpgradeOfferError',
          },
        ],
        PLAYER_DIED: GAME_PHASE.GAME_OVER,
      },
    },
    [GAME_PHASE.PAUSED_MENU]: {
      on: {
        RESUME_REQUESTED: GAME_PHASE.RUNNING,
      },
    },
    [GAME_PHASE.PAUSED_UPGRADE]: {
      on: {
        SELECT_UPGRADE: [
          {
            guard: 'hasQueuedUpgradeAfterSelection',
            actions: ['applySelectedUpgrade', 'consumeQueuedUpgrade'],
          },
          {
            guard: 'isOfferedUpgradeChoice',
            target: GAME_PHASE.RUNNING,
            actions: ['applySelectedUpgrade', 'clearCompletedUpgrade'],
          },
          {
            actions: 'assignInvalidUpgradeSelectionError',
          },
        ],
        UPGRADE_OFFERED: [
          {
            guard: 'canAcceptNextUpgradeOffer',
            actions: 'assignUpgradeOffer',
          },
          {
            actions: 'assignInvalidUpgradeOfferError',
          },
        ],
      },
    },
    [GAME_PHASE.GAME_OVER]: {
      on: {
        RESTART: {
          target: GAME_PHASE.RUNNING,
          actions: 'resetRunContext',
        },
      },
    },
    [GAME_PHASE.DISPOSED]: {
      type: 'final',
    },
  },
})
