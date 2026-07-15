import { useEffect, useRef, useState } from 'react'
import { InitialWeaponScreen } from './app/screens/InitialWeaponScreen.tsx'
import { GameOverScreen } from './app/screens/GameOverScreen.tsx'
import { UpgradeScreen } from './app/screens/UpgradeScreen.tsx'
import { DeathReviewPrompt } from './app/screens/DeathReviewPrompt.tsx'
import type { UpgradeCommitCommand } from './app/screens/upgradeDecision.ts'
import { INITIAL_UI_SNAPSHOT } from './game/bridge/uiSnapshot.ts'
import {
  createGameHost,
  type GameHost,
} from './game/host/createGameHost.ts'
import { WEAPON_DEFINITION_ID } from './shared/weaponIds.ts'
import './App.scss'

// Persistence will provide this snapshot when permanent unlocks are added.
const PROTOTYPE_UNLOCKED_WEAPON_DEFINITION_IDS = Object.freeze([
  WEAPON_DEFINITION_ID.ASSISTED_O,
  WEAPON_DEFINITION_ID.FLAMETHROWER,
  WEAPON_DEFINITION_ID.ORBIT_ENERGY_BALL,
])

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameHostRef = useRef<GameHost | null>(null)
  const [uiSnapshot, setUiSnapshot] = useState(INITIAL_UI_SNAPSHOT)
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  )
  const isReady = uiSnapshot.phase === 'READY'
  const isUpgradePaused = uiSnapshot.phase === 'PAUSED_UPGRADE'
  const isDeathReview = uiSnapshot.phase === 'DEATH_REVIEW'
  const isGameOver = uiSnapshot.phase === 'GAME_OVER'
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
          unlockedWeaponDefinitionIds:
            PROTOTYPE_UNLOCKED_WEAPON_DEFINITION_IDS,
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

  function handleStartRun(initialWeaponDefinitionId: string): void {
    gameHostRef.current?.startRun({
      seed: Date.now(),
      initialWeaponDefinitionId,
    })
  }

  function handleUpgradeCommit(command: UpgradeCommitCommand): void {
    if (command.kind === 'WEAPON') {
      gameHostRef.current?.acquireWeapon({
        offerId: command.offerId,
        choiceId: command.choiceId,
        replacedWeaponInstanceId: command.replacedWeaponInstanceId,
      })
      return
    }

    gameHostRef.current?.installModule({
      offerId: command.offerId,
      choiceId: command.choiceId,
      weaponInstanceId: command.weaponInstanceId,
      replacedSlotIndex: command.replacedSlotIndex,
    })
  }

  function handleReturnToMainMenu(): void {
    gameHostRef.current?.returnToMainMenu()
  }

  function handleEnterRunResult(): void {
    gameHostRef.current?.enterRunResult()
  }

  return (
    <div className={`game-page${hasStarted ? ' game-page--started' : ''}`}>
      <header className="site-header">
        <div className="wordmark" aria-label="Glyph Survivor">
          <span aria-hidden="true">[G]</span>
          <span>Glyph Survivor</span>
        </div>

        <span className="run-state">
          {isReady ? 'Select weapon' : uiSnapshot.phase}
        </span>
      </header>

      <main className="game-stage" aria-label="Glyph Survivor game">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width="1280"
          height="720"
          aria-label="Game canvas"
        />

        {!hasStarted && !isReady && (
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

        {isReady && (
          <InitialWeaponScreen
            choices={uiSnapshot.initialWeaponChoices}
            onConfirm={handleStartRun}
          />
        )}

        {hasStarted && !isGameOver && (
          <aside className="game-hud" aria-label="Run status">
            <span>HP {uiSnapshot.currentHealth}/{uiSnapshot.maximumHealth}</span>
            <span>
              SHIELD {uiSnapshot.currentShieldLayers}/
              {uiSnapshot.maximumShieldLayers}
            </span>
            <span>LV.{uiSnapshot.level}</span>
            <span>XP {uiSnapshot.xp}/{uiSnapshot.xpToNext}</span>
            <span>ENEMIES {uiSnapshot.enemyCount}</span>
            <span>{Math.floor(uiSnapshot.runTimeMs / 1_000)}s</span>
          </aside>
        )}

        {isUpgradePaused && uiSnapshot.activeUpgradeOfferId && (
          <UpgradeScreen
            key={uiSnapshot.activeUpgradeOfferId}
            offerId={uiSnapshot.activeUpgradeOfferId}
            choices={uiSnapshot.upgradeChoices}
            equippedWeapons={uiSnapshot.equippedWeapons}
            maximumEquippedWeapons={uiSnapshot.maximumEquippedWeapons}
            pendingUpgradeCount={uiSnapshot.pendingUpgradeCount}
            recoverableError={uiSnapshot.recoverableError}
            onCommit={handleUpgradeCommit}
          />
        )}

        {isDeathReview && uiSnapshot.canEnterRunResult && (
          <DeathReviewPrompt onEnterRunResult={handleEnterRunResult} />
        )}

        {isGameOver && uiSnapshot.runResult && (
          <GameOverScreen
            result={uiSnapshot.runResult}
            onReturnToMainMenu={handleReturnToMainMenu}
          />
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
