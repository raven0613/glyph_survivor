import assert from 'node:assert/strict'
import test from 'node:test'
import { GAME_PHASE } from '../../src/game/runtime/gameMachine.ts'
import { createGameHost } from '../../src/game/host/createGameHost.ts'

function createCanvasStub() {
  return {
    getContext: () => null,
  }
}

test('publishes ready and enters running after the play command', () => {
  const gameHost = createGameHost({ canvas: createCanvasStub() })
  const publishedPhases: string[] = []
  const unsubscribe = gameHost.subscribeUi((uiSnapshot) => {
    publishedPhases.push(uiSnapshot.phase)
  })

  assert.equal(gameHost.getUiSnapshot().phase, GAME_PHASE.READY)
  assert.equal(Object.isFrozen(gameHost.getUiSnapshot()), true)

  gameHost.startRun({ seed: 'play-button-run' })

  assert.equal(gameHost.getUiSnapshot().phase, GAME_PHASE.RUNNING)
  assert.equal(gameHost.getUiSnapshot().seed, 'play-button-run')
  assert.deepEqual(publishedPhases, [GAME_PHASE.READY, GAME_PHASE.RUNNING])

  unsubscribe()
  gameHost.dispose()
})

test('keeps start and disposal idempotent', () => {
  const gameHost = createGameHost({ canvas: createCanvasStub() })

  gameHost.startRun({ seed: 'first-run' })
  gameHost.startRun({ seed: 'ignored-run' })

  assert.equal(gameHost.getUiSnapshot().phase, GAME_PHASE.RUNNING)
  assert.equal(gameHost.getUiSnapshot().seed, 'first-run')

  gameHost.dispose()
  gameHost.dispose()

  assert.equal(gameHost.getUiSnapshot().phase, GAME_PHASE.DISPOSED)
})
