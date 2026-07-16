import { assign, setup } from 'xstate'
import type {
  RunModifierChoiceReference,
  RunModifierOfferOrigin,
} from './runModifierState.ts'
import {
  copyModifierChoices,
  INVALID_MODIFIER_OFFER_ERROR,
  INVALID_MODIFIER_SELECTION_ERROR,
  isValidBossModifierOffer,
  isValidModifierOffer,
  isValidRunStartModifierOffer,
  type ModifierCommittedEvent,
  type ModifierOfferedEvent,
  type StartRunWithModifierOfferEvent,
} from './runModifierMachineContract.ts'
import {
  copyUpgradeChoices,
  INVALID_UPGRADE_OFFER_ERROR,
  INVALID_UPGRADE_SELECTION_ERROR,
  isValidUpgradeOffer,
  type UpgradeChoice,
  type UpgradeCommittedEvent,
  type UpgradeOfferedEvent,
} from './upgradeMachineContract.ts'

export type { UpgradeChoice } from './upgradeMachineContract.ts'

export const GAME_PHASE = Object.freeze({
  BOOT: 'BOOT',
  LOADING: 'LOADING',
  READY: 'READY',
  RUNNING: 'RUNNING',
  PAUSED_MENU: 'PAUSED_MENU',
  PAUSED_UPGRADE: 'PAUSED_UPGRADE',
  PAUSED_MODIFIER: 'PAUSED_MODIFIER',
  DEATH_REVIEW: 'DEATH_REVIEW',
  GAME_OVER: 'GAME_OVER',
  DISPOSED: 'DISPOSED',
})

export type GamePhase = (typeof GAME_PHASE)[keyof typeof GAME_PHASE]

export function isGameplayPausePhase(phase: GamePhase): boolean {
  return (
    phase === GAME_PHASE.PAUSED_MENU ||
    phase === GAME_PHASE.PAUSED_UPGRADE ||
    phase === GAME_PHASE.PAUSED_MODIFIER
  )
}

export function didResumeGameplayFromPause(
  previousPhase: GamePhase,
  currentPhase: GamePhase,
): boolean {
  return (
    isGameplayPausePhase(previousPhase) && currentPhase === GAME_PHASE.RUNNING
  )
}

const LOAD_FAILURE_FALLBACK_ERROR = 'Game initialization failed.'

export interface GameMachineContext {
  readonly seed: string | number | null
  readonly upgradeChoices: readonly Readonly<UpgradeChoice>[]
  readonly pendingUpgradeCount: number
  readonly activeUpgradeOfferId: string | null
  readonly modifierChoices: readonly Readonly<RunModifierChoiceReference>[]
  readonly activeModifierOfferId: string | null
  readonly activeModifierOfferOrigin: RunModifierOfferOrigin | null
  readonly recoverableError: string | null
  readonly canEnterRunResult: boolean
}

type UpgradeCommandRejectedEvent = {
  readonly type: 'UPGRADE_COMMAND_REJECTED'
  readonly error: string
}

export type GameMachineEvent =
  | { readonly type: 'INITIALIZE' }
  | { readonly type: 'LOAD_SUCCEEDED' }
  | { readonly type: 'LOAD_FAILED'; readonly error: unknown }
  | { readonly type: 'START_RUN'; readonly seed: string | number }
  | StartRunWithModifierOfferEvent
  | { readonly type: 'PAUSE_REQUESTED' }
  | { readonly type: 'RESUME_REQUESTED' }
  | UpgradeOfferedEvent
  | UpgradeCommittedEvent
  | UpgradeCommandRejectedEvent
  | ModifierOfferedEvent
  | ModifierCommittedEvent
  | { readonly type: 'MODIFIER_COMMAND_REJECTED'; readonly error: string }
  | { readonly type: 'PLAYER_DIED' }
  | { readonly type: 'DEATH_REVIEW_READY' }
  | { readonly type: 'ENTER_RUN_RESULT' }
  | { readonly type: 'RESTART'; readonly seed?: string | number }
  | { readonly type: 'RETURN_TO_MAIN_MENU' }
  | { readonly type: 'DISPOSE' }

function createInitialContext(): GameMachineContext {
  return {
    seed: null,
    upgradeChoices: Object.freeze([]),
    pendingUpgradeCount: 0,
    activeUpgradeOfferId: null,
    modifierChoices: Object.freeze([]),
    activeModifierOfferId: null,
    activeModifierOfferOrigin: null,
    recoverableError: null,
    canEnterRunResult: false,
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

function isOfferedChoice(
  context: GameMachineContext,
  event: GameMachineEvent,
): event is UpgradeCommittedEvent {
  return (
    event.type === 'UPGRADE_COMMITTED' &&
    typeof event.choiceId === 'string' &&
    context.upgradeChoices.some((choice) => choice.id === event.choiceId)
  )
}

function isOfferedModifierChoice(
  context: GameMachineContext,
  event: GameMachineEvent,
): event is ModifierCommittedEvent {
  return (
    event.type === 'MODIFIER_COMMITTED' &&
    context.modifierChoices.some((choice) => choice.id === event.choiceId)
  )
}

const gameMachineSetup = setup({
  types: {} as {
    context: GameMachineContext
    events: GameMachineEvent
  },
  actions: {
    assignInvalidUpgradeOfferError: assign({
      recoverableError: () => INVALID_UPGRADE_OFFER_ERROR,
    }),
    assignInvalidUpgradeSelectionError: assign({
      recoverableError: () => INVALID_UPGRADE_SELECTION_ERROR,
    }),
    assignInvalidModifierOfferError: assign({
      recoverableError: () => INVALID_MODIFIER_OFFER_ERROR,
    }),
    assignInvalidModifierSelectionError: assign({
      recoverableError: () => INVALID_MODIFIER_SELECTION_ERROR,
    }),
    assignUpgradeCommandError: assign(({ event }) => ({
      recoverableError:
        event.type === 'UPGRADE_COMMAND_REJECTED' && event.error.trim()
          ? event.error
          : INVALID_UPGRADE_SELECTION_ERROR,
    })),
    assignModifierCommandError: assign(({ event }) => ({
      recoverableError:
        event.type === 'MODIFIER_COMMAND_REJECTED' && event.error.trim()
          ? event.error
          : INVALID_MODIFIER_SELECTION_ERROR,
    })),
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
        activeUpgradeOfferId: event.offerId,
        recoverableError: null,
      }
    }),
    assignModifierOffer: assign(({ event }) => {
      if (!isValidModifierOffer(event)) {
        return {}
      }

      return {
        modifierChoices: copyModifierChoices(event.choices),
        activeModifierOfferId: event.offerId,
        activeModifierOfferOrigin: event.origin,
        recoverableError: null,
      }
    }),
    clearCompletedUpgrade: assign({
      upgradeChoices: () => Object.freeze([]),
      pendingUpgradeCount: () => 0,
      activeUpgradeOfferId: () => null,
      recoverableError: () => null,
    }),
    clearCompletedModifier: assign({
      modifierChoices: () => Object.freeze([]),
      activeModifierOfferId: () => null,
      activeModifierOfferOrigin: () => null,
      recoverableError: () => null,
    }),
    clearModifierAndAssignUpgrade: assign(({ event }) => {
      if (
        event.type !== 'MODIFIER_COMMITTED' ||
        !event.nextUpgradeOffer
      ) {
        return {}
      }
      return {
        modifierChoices: Object.freeze([]),
        activeModifierOfferId: null,
        activeModifierOfferOrigin: null,
        upgradeChoices: copyUpgradeChoices(
          event.nextUpgradeOffer.choices,
        ),
        pendingUpgradeCount:
          event.nextUpgradeOffer.pendingUpgradeCount,
        activeUpgradeOfferId: event.nextUpgradeOffer.offerId,
        recoverableError: null,
      }
    }),
    clearRecoverableError: assign({
      recoverableError: () => null,
    }),
    consumeQueuedUpgrade: assign(({ context }) => ({
      upgradeChoices: Object.freeze([]),
      pendingUpgradeCount: context.pendingUpgradeCount - 1,
      activeUpgradeOfferId: null,
      recoverableError: null,
    })),
    resetRunContext: assign(({ event }) => {
      const seed =
        event.type === 'START_RUN' ||
        event.type === 'START_RUN_WITH_MODIFIER_OFFER' ||
        event.type === 'RESTART'
          ? (event.seed ?? null)
          : null

      return {
        seed,
        upgradeChoices: Object.freeze([]),
        pendingUpgradeCount: 0,
        activeUpgradeOfferId: null,
        modifierChoices: Object.freeze([]),
        activeModifierOfferId: null,
        activeModifierOfferOrigin: null,
        recoverableError: null,
        canEnterRunResult: false,
      }
    }),
    beginDeathReview: assign({
      upgradeChoices: () => Object.freeze([]),
      pendingUpgradeCount: () => 0,
      activeUpgradeOfferId: () => null,
      modifierChoices: () => Object.freeze([]),
      activeModifierOfferId: () => null,
      activeModifierOfferOrigin: () => null,
      recoverableError: () => null,
      canEnterRunResult: () => false,
    }),
    markDeathReviewReady: assign({
      canEnterRunResult: () => true,
    }),
    clearDeathReviewReadiness: assign({
      canEnterRunResult: () => false,
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
    isValidRunStartModifierOffer: ({ event }) =>
      isValidRunStartModifierOffer(event),
    isValidBossModifierOffer: ({ event }) => isValidBossModifierOffer(event),
    isOfferedModifierChoice: ({ context, event }) =>
      isOfferedModifierChoice(context, event) &&
      event.nextUpgradeOffer === undefined,
    hasValidUpgradeAfterModifier: ({ context, event }) =>
      isOfferedModifierChoice(context, event) &&
      event.nextUpgradeOffer !== undefined &&
      isValidUpgradeOffer({
        type: 'UPGRADE_OFFERED',
        ...event.nextUpgradeOffer,
      }),
    canEnterRunResult: ({ context }) => context.canEnterRunResult,
  },
})

/**
 * Top-level lifecycle machine for one game run.
 *
 * World entities and fixed-step simulation data deliberately remain outside
 * this machine. GameHost selects the phase-specific fixed-step scheduler and
 * keeps authoritative world mutation outside this lifecycle state machine.
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
        START_RUN_WITH_MODIFIER_OFFER: [
          {
            guard: 'isValidRunStartModifierOffer',
            target: GAME_PHASE.PAUSED_MODIFIER,
            actions: ['resetRunContext', 'assignModifierOffer'],
          },
          {
            actions: 'assignInvalidModifierOfferError',
          },
        ],
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
        MODIFIER_OFFERED: [
          {
            guard: 'isValidBossModifierOffer',
            target: GAME_PHASE.PAUSED_MODIFIER,
            actions: 'assignModifierOffer',
          },
          {
            actions: 'assignInvalidModifierOfferError',
          },
        ],
        PLAYER_DIED: {
          target: GAME_PHASE.DEATH_REVIEW,
          actions: 'beginDeathReview',
        },
      },
    },
    [GAME_PHASE.PAUSED_MENU]: {
      on: {
        RESUME_REQUESTED: GAME_PHASE.RUNNING,
      },
    },
    [GAME_PHASE.PAUSED_UPGRADE]: {
      on: {
        UPGRADE_COMMITTED: [
          {
            guard: 'hasQueuedUpgradeAfterSelection',
            actions: 'consumeQueuedUpgrade',
          },
          {
            guard: 'isOfferedUpgradeChoice',
            target: GAME_PHASE.RUNNING,
            actions: 'clearCompletedUpgrade',
          },
          {
            actions: 'assignInvalidUpgradeSelectionError',
          },
        ],
        UPGRADE_COMMAND_REJECTED: {
          actions: 'assignUpgradeCommandError',
        },
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
    [GAME_PHASE.PAUSED_MODIFIER]: {
      on: {
        MODIFIER_COMMITTED: [
          {
            guard: 'hasValidUpgradeAfterModifier',
            target: GAME_PHASE.PAUSED_UPGRADE,
            actions: 'clearModifierAndAssignUpgrade',
          },
          {
            guard: 'isOfferedModifierChoice',
            target: GAME_PHASE.RUNNING,
            actions: 'clearCompletedModifier',
          },
          {
            actions: 'assignInvalidModifierSelectionError',
          },
        ],
        MODIFIER_COMMAND_REJECTED: {
          actions: 'assignModifierCommandError',
        },
      },
    },
    [GAME_PHASE.DEATH_REVIEW]: {
      on: {
        DEATH_REVIEW_READY: {
          actions: 'markDeathReviewReady',
        },
        ENTER_RUN_RESULT: {
          guard: 'canEnterRunResult',
          target: GAME_PHASE.GAME_OVER,
          actions: 'clearDeathReviewReadiness',
        },
      },
    },
    [GAME_PHASE.GAME_OVER]: {
      on: {
        RETURN_TO_MAIN_MENU: {
          target: GAME_PHASE.READY,
          actions: 'resetRunContext',
        },
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
