import { useEffect, useRef, useState } from 'react'
import { INITIAL_UI_SNAPSHOT } from './game/bridge/uiSnapshot.ts'
import {
  createGameHost,
  type GameHost,
} from './game/host/createGameHost.ts'
import './App.scss'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameHostRef = useRef<GameHost | null>(null)
  const [uiSnapshot, setUiSnapshot] = useState(INITIAL_UI_SNAPSHOT)
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  )
  const isReady = uiSnapshot.phase === 'READY'
  const hasStarted = !['BOOT', 'LOADING', 'READY'].includes(uiSnapshot.phase)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const abortController = new AbortController()
    let mountedHost: GameHost | null = null
    let unsubscribeUi = () => {}

    // Deferring one microtask prevents React StrictMode's probe mount from
    // starting a second Pixi initialization on the same canvas.
    void Promise.resolve().then(async () => {
      if (abortController.signal.aborted) {
        return
      }

      try {
        const gameHost = await createGameHost({
          canvas,
          signal: abortController.signal,
        })

        if (abortController.signal.aborted) {
          gameHost.dispose()
          return
        }

        mountedHost = gameHost
        gameHostRef.current = gameHost
        unsubscribeUi = gameHost.subscribeUi(setUiSnapshot)
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          setInitializationError(error.message)
        }
      }
    })

    return () => {
      abortController.abort()
      unsubscribeUi()
      mountedHost?.dispose()

      if (gameHostRef.current === mountedHost) {
        gameHostRef.current = null
      }
    }
  }, [])

  function handlePlay() {
    gameHostRef.current?.startRun({ seed: Date.now() })
  }

  return (
    <div className={`game-page${hasStarted ? ' game-page--started' : ''}`}>
      <header className="site-header">
        <div className="wordmark" aria-label="Glyph Survivor">
          <span aria-hidden="true">[G]</span>
          <span>Glyph Survivor</span>
        </div>

        <button
          className="play-button"
          type="button"
          disabled={!isReady}
          onClick={handlePlay}
        >
          {isReady ? 'Play' : uiSnapshot.phase}{' '}
          <span aria-hidden="true">↗</span>
        </button>
      </header>

      <main className="game-stage" aria-label="Glyph Survivor game">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width="1280"
          height="720"
          aria-label="Game canvas"
        />

        {!hasStarted && (
          <div className="canvas-status" aria-hidden="true">
            <span>Everything is text.</span>
            <span className="canvas-status__state">
              {initializationError ?? (
                <>
                  {uiSnapshot.phase.charAt(0)}
                  {uiSnapshot.phase.slice(1).toLowerCase()}_
                </>
              )}
            </span>
          </div>
        )}

        {hasStarted && (
          <aside className="game-hud" aria-label="Run status">
            <span>LV.{uiSnapshot.level}</span>
            <span>XP {uiSnapshot.xp}</span>
            <span>ENEMIES {uiSnapshot.enemyCount}</span>
            <span>{Math.floor(uiSnapshot.runTimeMs / 1_000)}s</span>
          </aside>
        )}
      </main>

      <footer className="site-footer">
        <p>© 2026 Glyph Survivor</p>
        <p>Support / Links</p>
      </footer>
    </div>
  )
}

export default App
