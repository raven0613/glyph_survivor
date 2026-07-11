import assert from 'node:assert/strict'
import test from 'node:test'
import { createActor } from 'xstate'
import { GAME_PHASE, gameMachine } from '../../src/game/runtime/gameMachine.ts'

const upgradeChoices = [
  { id: 'color-fire-red', title: 'Color: Fire Red' },
  { id: 'size-200', title: 'Size: 200%' },
  { id: 'weight-bold', title: 'Weight: Bold' },
]

function startRunningActor(machine: typeof gameMachine = gameMachine) {
  const actor = createActor(machine).start()
  actor.send({ type: 'INITIALIZE' })
  actor.send({ type: 'LOAD_SUCCEEDED', seed: 'test-seed' })
  return actor
}

test('starts a run only after initialization succeeds', () => {
  const actor = createActor(gameMachine).start()

  assert.equal(actor.getSnapshot().value, GAME_PHASE.BOOT)

  actor.send({ type: 'INITIALIZE' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.LOADING)

  actor.send({ type: 'LOAD_SUCCEEDED', seed: 'run-001' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)
  assert.equal(actor.getSnapshot().context.seed, 'run-001')
})

test('stays in loading and exposes a recoverable initialization error', () => {
  const actor = createActor(gameMachine).start()
  actor.send({ type: 'INITIALIZE' })
  actor.send({ type: 'LOAD_FAILED', error: new Error('atlas failed') })

  assert.equal(actor.getSnapshot().value, GAME_PHASE.LOADING)
  assert.equal(actor.getSnapshot().context.recoverableError, 'atlas failed')
})

test('normalizes non-Error initialization failures for the UI snapshot', () => {
  const actor = createActor(gameMachine).start()
  actor.send({ type: 'INITIALIZE' })

  actor.send({ type: 'LOAD_FAILED', error: 'manifest failed' })
  assert.equal(actor.getSnapshot().context.recoverableError, 'manifest failed')

  actor.send({ type: 'LOAD_FAILED', error: null })
  assert.equal(
    actor.getSnapshot().context.recoverableError,
    'Game initialization failed.',
  )
})

test('pauses and resumes a running game from the menu', () => {
  const actor = startRunningActor()

  actor.send({ type: 'PAUSE_REQUESTED' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.PAUSED_MENU)

  actor.send({ type: 'RESUME_REQUESTED' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)
})

test('pauses for an upgrade and resumes only after applying an offered choice', () => {
  const appliedUpgradeIds: string[] = []
  const actor = startRunningActor(
    gameMachine.provide({
      actions: {
        applySelectedUpgrade: ({ event }) => {
          if (event.type === 'SELECT_UPGRADE') {
            appliedUpgradeIds.push(event.choiceId)
          }
        },
      },
    }),
  )

  actor.send({ type: 'UPGRADE_OFFERED', choices: upgradeChoices })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.PAUSED_UPGRADE)

  actor.send({ type: 'RESUME_REQUESTED' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.PAUSED_UPGRADE)

  actor.send({ type: 'SELECT_UPGRADE', choiceId: 'not-offered' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.PAUSED_UPGRADE)
  assert.deepEqual(appliedUpgradeIds, [])

  actor.send({ type: 'SELECT_UPGRADE', choiceId: 'size-200' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)
  assert.deepEqual(appliedUpgradeIds, ['size-200'])
})

test('keeps gameplay paused while queued level-ups still need a choice', () => {
  const actor = startRunningActor()
  actor.send({
    type: 'UPGRADE_OFFERED',
    choices: upgradeChoices,
    pendingUpgradeCount: 2,
  })

  actor.send({ type: 'SELECT_UPGRADE', choiceId: 'color-fire-red' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.PAUSED_UPGRADE)
  assert.equal(actor.getSnapshot().context.pendingUpgradeCount, 1)
  assert.deepEqual(actor.getSnapshot().context.upgradeChoices, [])

  actor.send({ type: 'UPGRADE_OFFERED', choices: upgradeChoices })
  actor.send({ type: 'SELECT_UPGRADE', choiceId: 'weight-bold' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)
})

test('rejects malformed upgrade offers without pausing gameplay', () => {
  const actor = startRunningActor()
  actor.send({
    type: 'UPGRADE_OFFERED',
    choices: [upgradeChoices[0], upgradeChoices[0], upgradeChoices[2]],
  })

  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)
  const recoverableError = actor.getSnapshot().context.recoverableError
  assert.ok(recoverableError)
  assert.match(recoverableError, /upgrade offer/i)

  actor.send({
    type: 'UPGRADE_OFFERED',
    choices: [upgradeChoices[0], { id: '   ' }, upgradeChoices[2]],
  })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)

  actor.send({
    type: 'UPGRADE_OFFERED',
    choices: upgradeChoices,
    pendingUpgradeCount: 0,
  })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)
})

test('copies upgrade choices at the command boundary', () => {
  const actor = startRunningActor()
  const mutableChoices = upgradeChoices.map((choice) => ({ ...choice }))
  actor.send({ type: 'UPGRADE_OFFERED', choices: mutableChoices })

  mutableChoices[0].title = 'mutated externally'
  mutableChoices.push({ id: 'extra', title: 'Extra' })

  assert.equal(actor.getSnapshot().context.upgradeChoices.length, 3)
  assert.equal(
    actor.getSnapshot().context.upgradeChoices[0].title,
    'Color: Fire Red',
  )
})

test('enters game over before accepting further upgrade offers and can restart', () => {
  const actor = startRunningActor()
  actor.send({ type: 'PLAYER_DIED' })
  actor.send({ type: 'UPGRADE_OFFERED', choices: upgradeChoices })

  assert.equal(actor.getSnapshot().value, GAME_PHASE.GAME_OVER)

  actor.send({ type: 'RESTART', seed: 'run-002' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)
  assert.equal(actor.getSnapshot().context.seed, 'run-002')
})

test('dispose is final and idempotent from an active run', () => {
  const actor = startRunningActor()
  actor.send({ type: 'DISPOSE' })
  actor.send({ type: 'DISPOSE' })
  actor.send({ type: 'RESTART', seed: 'ignored' })

  assert.equal(actor.getSnapshot().value, GAME_PHASE.DISPOSED)
  assert.equal(actor.getSnapshot().status, 'done')
})
