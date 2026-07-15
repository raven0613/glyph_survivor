import { useEffect, useRef } from 'react'
import type {
  UiRunResult,
  UiRunResultWeapon,
} from '../../game/bridge/uiSnapshot.ts'
import {
  formatGameplayDuration,
  formatMetricNumber,
  formatModuleRank,
} from './runResultPresentation.ts'
import './GameOverScreen.scss'

interface GameOverScreenProps {
  readonly result: Readonly<UiRunResult>
  readonly onReturnToMainMenu: () => void
}

interface WeaponResultCardProps {
  readonly weapon: Readonly<UiRunResultWeapon>
  readonly loadoutIndex: number
}

function WeaponResultCard({ weapon, loadoutIndex }: WeaponResultCardProps) {
  return (
    <article
      className={`run-weapon-result${
        weapon.isHighestDamage ? ' run-weapon-result--highest' : ''
      }`}
    >
      {weapon.isHighestDamage && (
        <div
          className="run-weapon-result__crown"
          aria-label="Highest damage weapon"
        >
          <span aria-hidden="true">♛</span>
          Highest damage
        </div>
      )}

      <div className="run-weapon-result__identity">
        <span className="run-weapon-result__index" aria-hidden="true">
          {String(loadoutIndex + 1).padStart(2, '0')}
        </span>
        <span className="run-weapon-result__glyph" aria-hidden="true">
          {weapon.identityGlyph}
        </span>
        <div>
          <h2>{weapon.title}</h2>
          <p>Death-time loadout / Instance {weapon.instanceId}</p>
        </div>
      </div>

      <dl className="run-weapon-result__metrics">
        <div>
          <dt>Total damage</dt>
          <dd>{formatMetricNumber(weapon.totalDamage)}</dd>
        </div>
        <div>
          <dt>Equipped time</dt>
          <dd>{formatGameplayDuration(weapon.equippedGameplayTimeMs)}</dd>
        </div>
        <div>
          <dt>Equipped avg. DPS</dt>
          <dd>{formatMetricNumber(weapon.averageEquippedDps)}</dd>
        </div>
      </dl>

      <div className="run-weapon-result__modules">
        <h3>Module Slots</h3>
        <ol>
          {weapon.moduleSlots.map((slot, slotIndex) => (
            <li key={slot?.slotIndex ?? slotIndex}>
              <span>Slot {String(slotIndex + 1).padStart(2, '0')}</span>
              {slot ? (
                <>
                  <strong>{slot.title}</strong>
                  <span>Rank {formatModuleRank(slot.rank)}</span>
                </>
              ) : (
                <span className="run-weapon-result__empty-slot">Empty</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </article>
  )
}

export function GameOverScreen({
  result,
  onReturnToMainMenu,
}: GameOverScreenProps) {
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <section
      ref={dialogRef}
      className="game-over-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
      tabIndex={-1}
    >
      <header className="game-over-screen__heading">
        <p>Run archive / Final snapshot</p>
        <h1 id="game-over-title">Run terminated</h1>
        <p>Health depleted. Runtime statistics are now sealed.</p>
      </header>

      <dl className="game-over-screen__summary" aria-label="Run summary">
        <div>
          <dt>Gameplay time</dt>
          <dd>{formatGameplayDuration(result.gameplayTimeMs)}</dd>
        </div>
        <div>
          <dt>Enemies defeated</dt>
          <dd>{result.killCount}</dd>
        </div>
        <div>
          <dt>Final level</dt>
          <dd>LV.{result.finalPlayerLevel}</dd>
        </div>
      </dl>

      <div className="game-over-screen__weapons" aria-label="Final weapons">
        {result.weapons.map((weapon, index) => (
          <WeaponResultCard
            key={weapon.instanceId}
            weapon={weapon}
            loadoutIndex={index}
          />
        ))}
      </div>

      <div data-extension-slot="post-run" hidden />

      <footer className="game-over-screen__actions">
        <p>Only death-time Weapon Instances are included.</p>
        <button
          className="return-main-button"
          type="button"
          onClick={onReturnToMainMenu}
        >
          Return to main menu <span aria-hidden="true">→</span>
        </button>
      </footer>
    </section>
  )
}
