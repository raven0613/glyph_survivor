import { useState } from 'react'
import './App.css'

function App() {
  const [hasStarted, setHasStarted] = useState(false)

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
          onClick={() => setHasStarted(true)}
        >
          Play <span aria-hidden="true">↗</span>
        </button>
      </header>

      <main className="game-stage" aria-label="Glyph Survivor game">
        <canvas
          className="game-canvas"
          width="1280"
          height="720"
          aria-label="Game canvas"
        />

        {!hasStarted && (
          <div className="canvas-status" aria-hidden="true">
            <span>Everything is text.</span>
            <span className="canvas-status__state">Ready_</span>
          </div>
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
