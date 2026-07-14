import assert from 'node:assert/strict'
import test from 'node:test'
import { createActor } from 'xstate'
import { GAME_PHASE, gameMachine } from '../../src/game/runtime/gameMachine.ts'

const upgradeChoices = [
  { id: 'color-fire-red', kind: 'MODULE' as const, definitionId: 'module.fire', title: 'Color: Fire Red' },
  { id: 'size-200', kind: 'MODULE' as const, definitionId: 'module.size', title: 'Size: 200%' },
  { id: 'weight-bold', kind: 'MODULE' as const, definitionId: 'module.weight', title: 'Weight: Bold' },
]

function startRunningActor(machine: typeof gameMachine = gameMachine) {
  const actor = createActor(machine).start()
  actor.send({ type: 'INITIALIZE' })
  actor.send({ type: 'LOAD_SUCCEEDED' })
  actor.send({ type: 'START_RUN', seed: 'test-seed' })
  return actor
}

test('waits in ready after loading and starts only after the play command', () => {
  const actor = createActor(gameMachine).start()

  assert.equal(actor.getSnapshot().value, GAME_PHASE.BOOT)

  actor.send({ type: 'INITIALIZE' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.LOADING)

  actor.send({ type: 'START_RUN', seed: 'too-early' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.LOADING)

  actor.send({ type: 'LOAD_SUCCEEDED' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.READY)
  assert.equal(actor.getSnapshot().context.seed, null)

  actor.send({ type: 'START_RUN', seed: 'run-001' })
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

test('pauses for an upgrade and resumes only after an offered choice commits', () => {
  const actor = startRunningActor()

  actor.send({ type: 'UPGRADE_OFFERED', offerId: 'offer-1', choices: upgradeChoices })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.PAUSED_UPGRADE)

  actor.send({ type: 'RESUME_REQUESTED' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.PAUSED_UPGRADE)

  actor.send({ type: 'UPGRADE_COMMITTED', choiceId: 'not-offered' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.PAUSED_UPGRADE)

  actor.send({ type: 'UPGRADE_COMMITTED', choiceId: 'size-200' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)
})

test('keeps gameplay paused while queued level-ups still need a choice', () => {
  const actor = startRunningActor()
  actor.send({
    type: 'UPGRADE_OFFERED',
    offerId: 'offer-1',
    choices: upgradeChoices,
    pendingUpgradeCount: 2,
  })

  actor.send({ type: 'UPGRADE_COMMITTED', choiceId: 'color-fire-red' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.PAUSED_UPGRADE)
  assert.equal(actor.getSnapshot().context.pendingUpgradeCount, 1)
  assert.deepEqual(actor.getSnapshot().context.upgradeChoices, [])

  actor.send({ type: 'UPGRADE_OFFERED', offerId: 'offer-2', choices: upgradeChoices })
  actor.send({ type: 'UPGRADE_COMMITTED', choiceId: 'weight-bold' })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)
})

test('keeps the active offer paused after an authoritative command rejection', () => {
  const actor = startRunningActor()
  actor.send({
    type: 'UPGRADE_OFFERED',
    offerId: 'offer-rejected',
    choices: upgradeChoices,
  })

  actor.send({
    type: 'UPGRADE_COMMAND_REJECTED',
    error: 'A replacement slot is required.',
  })

  assert.equal(actor.getSnapshot().value, GAME_PHASE.PAUSED_UPGRADE)
  assert.equal(
    actor.getSnapshot().context.activeUpgradeOfferId,
    'offer-rejected',
  )
  assert.equal(
    actor.getSnapshot().context.recoverableError,
    'A replacement slot is required.',
  )
})

test('rejects malformed upgrade offers without pausing gameplay', () => {
  const actor = startRunningActor()
  actor.send({
    type: 'UPGRADE_OFFERED',
    offerId: 'offer-invalid',
    choices: [upgradeChoices[0], upgradeChoices[0], upgradeChoices[2]],
  })

  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)
  const recoverableError = actor.getSnapshot().context.recoverableError
  assert.ok(recoverableError)
  assert.match(recoverableError, /upgrade offer/i)

  actor.send({
    type: 'UPGRADE_OFFERED',
    offerId: 'offer-invalid-2',
    choices: [
      upgradeChoices[0],
      { id: '   ', kind: 'MODULE', definitionId: 'module.invalid' },
      upgradeChoices[2],
    ],
  })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)

  actor.send({
    type: 'UPGRADE_OFFERED',
    offerId: 'offer-invalid-3',
    choices: upgradeChoices,
    pendingUpgradeCount: 0,
  })
  assert.equal(actor.getSnapshot().value, GAME_PHASE.RUNNING)
})

test('copies upgrade choices at the command boundary', () => {
  const actor = startRunningActor()
  const mutableTargetPreview = {
    weaponInstanceId: 1,
    summary: 'Target 700 → 805 / Travel 1116 → 1283',
  }
  const mutableChoices = upgradeChoices.map((choice, index) => ({
    ...choice,
    weaponTargetPreviews:
      index === 0 ? [mutableTargetPreview] : undefined,
  }))
  actor.send({ type: 'UPGRADE_OFFERED', offerId: 'offer-copy', choices: mutableChoices })

  mutableChoices[0].title = 'mutated externally'
  mutableTargetPreview.summary = 'mutated externally'
  mutableChoices.push({
    id: 'extra',
    kind: 'MODULE',
    definitionId: 'module.extra',
    title: 'Extra',
    weaponTargetPreviews: undefined,
  })

  assert.equal(actor.getSnapshot().context.upgradeChoices.length, 3)
  assert.equal(
    actor.getSnapshot().context.upgradeChoices[0].title,
    'Color: Fire Red',
  )
  assert.equal(
    actor.getSnapshot().context.upgradeChoices[0].weaponTargetPreviews?.[0]
      .summary,
    'Target 700 → 805 / Travel 1116 → 1283',
  )
  assert.equal(
    Object.isFrozen(
      actor.getSnapshot().context.upgradeChoices[0].weaponTargetPreviews?.[0],
    ),
    true,
  )
})

test('enters game over before accepting further upgrade offers and can restart', () => {
  const actor = startRunningActor()
  actor.send({ type: 'PLAYER_DIED' })
  actor.send({ type: 'UPGRADE_OFFERED', offerId: 'offer-late', choices: upgradeChoices })

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
